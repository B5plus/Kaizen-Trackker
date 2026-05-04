import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const {
  SUPABASE_URL,
  SUPABASE_SERVICE_KEY,
  ADMIN_PASSWORD = "change-me",
  PORT = 3000,
} = process.env;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

const app = express();
app.use(cors());
app.use(express.json({ limit: "64kb" }));

// Static frontend — no-cache for HTML/JS so deploys are picked up immediately
app.use(
  express.static(path.join(__dirname, "..", "frontend"), {
    setHeaders: (res, filePath) => {
      if (/\.(html|js|jsx)$/i.test(filePath)) {
        res.setHeader("Cache-Control", "no-store, must-revalidate");
      }
    },
  }),
);

// --- Simple in-memory rate limiter (auth endpoint only) ---
const authAttempts = new Map();
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;

function isRateLimited(ip) {
  const now = Date.now();
  const recent = (authAttempts.get(ip) || []).filter(t => now - t < RATE_WINDOW_MS);
  if (recent.length >= RATE_LIMIT) return true;
  recent.push(now);
  authAttempts.set(ip, recent);
  return false;
}

setInterval(() => {
  const now = Date.now();
  for (const [ip, times] of authAttempts) {
    const recent = times.filter(t => now - t < RATE_WINDOW_MS);
    if (recent.length === 0) authAttempts.delete(ip);
    else authAttempts.set(ip, recent);
  }
}, 300_000).unref();

// --- Input sanitization ---
const sanitizeStr = (v, max = 500) =>
  typeof v === "string" ? v.trim().slice(0, max) : "";

const sanitizeDate = (v) =>
  typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v.trim()) ? v.trim() : null;

const VALID_STATUS = new Set(["notstarted", "progress", "completed"]);

// --- Auth middleware ---
const requireAdmin = (req, res, next) => {
  if (req.headers["x-admin-password"] !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Invalid password" });
  }
  next();
};

// Wrap async route handlers so Express 4 catches their rejections
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// --- Routes ---
app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.post("/api/auth/check", (req, res) => {
  const ip = req.ip || req.socket?.remoteAddress || "unknown";
  if (isRateLimited(ip)) {
    return res.status(429).json({ error: "Too many attempts. Try again in a minute." });
  }
  if (req.body?.password === ADMIN_PASSWORD) return res.json({ ok: true });
  res.status(401).json({ ok: false });
});

app.get("/api/nodes", wrap(async (_req, res) => {
  const { data, error } = await supabase
    .from("nodes")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
}));

app.post("/api/nodes", requireAdmin, wrap(async (req, res) => {
  const body = req.body || {};
  const title = sanitizeStr(body.title, 200);
  const insert = {
    title: title || "New node",
    description: sanitizeStr(body.description, 2000),
    developer: sanitizeStr(body.developer, 100) || "Unassigned",
    deadline: sanitizeDate(body.deadline),
    status: VALID_STATUS.has(body.status) ? body.status : "notstarted",
    progress: clampPct(body.progress),
    pos_x: Number.isFinite(body.pos_x) ? Math.round(body.pos_x) : 200,
    pos_y: Number.isFinite(body.pos_y) ? Math.round(body.pos_y) : 200,
    connections: Array.isArray(body.connections)
      ? body.connections.filter(id => typeof id === "string").slice(0, 100)
      : [],
  };
  const { data, error } = await supabase.from("nodes").insert(insert).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
}));

app.patch("/api/nodes/:id", requireAdmin, wrap(async (req, res) => {
  const body = req.body || {};
  const patch = {};

  if (body.title !== undefined)       patch.title       = sanitizeStr(body.title, 200) || "New node";
  if (body.description !== undefined) patch.description = sanitizeStr(body.description, 2000);
  if (body.developer !== undefined)   patch.developer   = sanitizeStr(body.developer, 100);
  if (body.deadline !== undefined)    patch.deadline    = sanitizeDate(body.deadline);
  if (body.status !== undefined && VALID_STATUS.has(body.status)) patch.status = body.status;
  if (body.progress !== undefined)    patch.progress    = clampPct(body.progress);
  if (Number.isFinite(body.pos_x))    patch.pos_x       = Math.round(body.pos_x);
  if (Number.isFinite(body.pos_y))    patch.pos_y       = Math.round(body.pos_y);
  if (Array.isArray(body.connections)) {
    patch.connections = body.connections.filter(id => typeof id === "string").slice(0, 100);
  }

  if (Object.keys(patch).length === 0) {
    return res.status(400).json({ error: "No valid fields to update" });
  }

  // Bidirectional progress <-> status sync
  if ("progress" in patch && !("status" in patch)) {
    if (patch.progress === 100)     patch.status = "completed";
    else if (patch.progress > 0)    patch.status = "progress";
    else                            patch.status = "notstarted";
  } else if ("status" in patch && !("progress" in patch)) {
    if (patch.status === "completed")   patch.progress = 100;
    else if (patch.status === "notstarted") patch.progress = 0;
  }

  const { data, error } = await supabase
    .from("nodes")
    .update(patch)
    .eq("id", req.params.id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
}));

app.delete("/api/nodes/:id", requireAdmin, wrap(async (req, res) => {
  const { error } = await supabase.from("nodes").delete().eq("id", req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
}));

function clampPct(v) {
  const n = Math.round(Number(v));
  return Number.isNaN(n) ? 0 : Math.max(0, Math.min(100, n));
}

// --- Global error handler (catches JSON parse errors + anything from wrap()) ---
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  // Malformed JSON body
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Invalid JSON in request body" });
  }
  console.error("[error]", err.message || err);
  res.status(500).json({ error: "Internal server error" });
});

// Keep the process alive on unexpected errors rather than crashing
process.on("unhandledRejection", (reason) => {
  console.error("[unhandledRejection]", reason);
});
process.on("uncaughtException", (err) => {
  console.error("[uncaughtException]", err);
});

app.listen(PORT, () => {
  console.log(`✓ Trackker backend listening on http://localhost:${PORT}`);
  console.log(`  Public:  http://localhost:${PORT}/`);
  console.log(`  Admin:   http://localhost:${PORT}/admin.html`);
});
