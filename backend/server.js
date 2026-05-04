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
  REQUEST_TIMEOUT_MS = "15000",
} = process.env;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("FATAL: Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

// Verify Supabase is reachable at startup (warn only — don't block)
supabase
  .from("nodes")
  .select("id")
  .limit(1)
  .then(({ error }) => {
    if (error) console.warn(`[startup] Supabase check failed: ${error.message}`);
    else       console.log("[startup] Supabase connection OK");
  })
  .catch((err) => console.warn("[startup] Supabase check threw:", err.message));

// ─────────────────────────────────────────────
// App setup
// ─────────────────────────────────────────────
const TIMEOUT_MS = Math.max(1000, parseInt(REQUEST_TIMEOUT_MS, 10) || 15000);
let shuttingDown = false;

const app = express();
app.use(cors());
app.use(express.json({ limit: "64kb" }));

// Abort slow requests so stalled Supabase calls don't pile up
app.use((_req, res, next) => {
  res.setTimeout(TIMEOUT_MS, () => {
    if (!res.headersSent) res.status(503).json({ error: "Request timed out" });
  });
  next();
});

// Refuse new work during graceful shutdown
app.use((_req, res, next) => {
  if (shuttingDown) {
    return res.status(503).set("Connection", "close").json({ error: "Server is restarting, try again shortly" });
  }
  next();
});

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

// ─────────────────────────────────────────────
// Rate limiter (auth endpoint only)
// ─────────────────────────────────────────────
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

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
const sanitizeStr = (v, max = 500) =>
  typeof v === "string" ? v.trim().slice(0, max) : "";

const sanitizeDate = (v) =>
  typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v.trim()) ? v.trim() : null;

const VALID_STATUS = new Set(["notstarted", "progress", "completed"]);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function clampPct(v) {
  const n = Math.round(Number(v));
  return Number.isNaN(n) ? 0 : Math.max(0, Math.min(100, n));
}

// Map known Supabase PostgREST codes to proper HTTP statuses
function httpStatus(error) {
  if (!error) return 500;
  const code = error.code;
  if (code === "PGRST116") return 404; // .single() found no row
  if (code === "23505")    return 409; // unique constraint violation
  if (code === "42501")    return 403; // RLS policy rejection
  return 500;
}

// ─────────────────────────────────────────────
// Middleware
// ─────────────────────────────────────────────
const requireAdmin = (req, res, next) => {
  if (req.headers["x-admin-password"] !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Invalid password" });
  }
  next();
};

// Validates UUID format before hitting Supabase
const validateId = (req, res, next) => {
  if (!UUID_RE.test(req.params.id)) {
    return res.status(400).json({ error: "Invalid node ID" });
  }
  next();
};

// Wraps async handlers — Express 4 won't catch async throws without this
const wrap = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// ─────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────
app.get("/api/health", (_req, res) =>
  res.json({ ok: true, uptime: Math.floor(process.uptime()) })
);

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
  if (error) return res.status(httpStatus(error)).json({ error: error.message });
  res.json(data);
}));

app.post("/api/nodes", requireAdmin, wrap(async (req, res) => {
  const body = req.body || {};
  const insert = {
    title:       sanitizeStr(body.title, 200) || "New node",
    description: sanitizeStr(body.description, 2000),
    developer:   sanitizeStr(body.developer, 100) || "Unassigned",
    deadline:    sanitizeDate(body.deadline),
    status:      VALID_STATUS.has(body.status) ? body.status : "notstarted",
    progress:    clampPct(body.progress),
    pos_x:       Number.isFinite(body.pos_x) ? Math.round(body.pos_x) : 200,
    pos_y:       Number.isFinite(body.pos_y) ? Math.round(body.pos_y) : 200,
    connections: Array.isArray(body.connections)
      ? body.connections.filter(id => typeof id === "string").slice(0, 100)
      : [],
  };
  const { data, error } = await supabase.from("nodes").insert(insert).select().single();
  if (error) return res.status(httpStatus(error)).json({ error: error.message });
  res.status(201).json(data);
}));

app.patch("/api/nodes/:id", requireAdmin, validateId, wrap(async (req, res) => {
  const body = req.body || {};
  const patch = {};

  if (body.title       !== undefined) patch.title       = sanitizeStr(body.title, 200) || "New node";
  if (body.description !== undefined) patch.description = sanitizeStr(body.description, 2000);
  if (body.developer   !== undefined) patch.developer   = sanitizeStr(body.developer, 100);
  if (body.deadline    !== undefined) patch.deadline    = sanitizeDate(body.deadline);
  if (body.status !== undefined && VALID_STATUS.has(body.status)) patch.status = body.status;
  if (body.progress    !== undefined) patch.progress    = clampPct(body.progress);
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
    if (patch.progress === 100)  patch.status = "completed";
    else if (patch.progress > 0) patch.status = "progress";
    else                         patch.status = "notstarted";
  } else if ("status" in patch && !("progress" in patch)) {
    if (patch.status === "completed")   patch.progress = 100;
    else if (patch.status === "notstarted") patch.progress = 0;
  }

  const { data, error } = await supabase
    .from("nodes").update(patch).eq("id", req.params.id).select().single();
  if (error) return res.status(httpStatus(error)).json({ error: error.message });
  res.json(data);
}));

app.delete("/api/nodes/:id", requireAdmin, validateId, wrap(async (req, res) => {
  const { error } = await supabase.from("nodes").delete().eq("id", req.params.id);
  if (error) return res.status(httpStatus(error)).json({ error: error.message });
  res.json({ ok: true });
}));

// Unknown /api/* → JSON 404 (not HTML from static handler)
app.use("/api", (_req, res) => res.status(404).json({ error: "Not found" }));

// ─────────────────────────────────────────────
// Global error handler
// ─────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  if (res.headersSent) return; // response already started — can't change headers
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Invalid JSON in request body" });
  }
  console.error(`[error] ${req.method} ${req.path} —`, err.message || err);
  res.status(500).json({ error: "Internal server error" });
});

// ─────────────────────────────────────────────
// Process safety net
// ─────────────────────────────────────────────
process.on("unhandledRejection", (reason) => {
  console.error("[unhandledRejection]", reason);
});
process.on("uncaughtException", (err) => {
  console.error("[uncaughtException]", err);
  // Don't exit — log and keep going for non-fatal errors
});

// ─────────────────────────────────────────────
// Start + graceful shutdown
// ─────────────────────────────────────────────
const server = app.listen(PORT, () => {
  console.log(`✓ Trackker backend listening on http://localhost:${PORT}`);
  console.log(`  Public: http://localhost:${PORT}/`);
  console.log(`  Admin:  http://localhost:${PORT}/admin.html`);
});

// Prevent load-balancer / proxy keep-alive race conditions
server.keepAliveTimeout = 65_000;
server.headersTimeout   = 66_000;

function gracefulShutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[${signal}] Graceful shutdown — draining in-flight requests…`);

  server.close(() => {
    console.log("All connections closed. Exiting cleanly.");
    process.exit(0);
  });

  // Force-exit after 10 s if connections won't drain
  setTimeout(() => {
    console.error("Shutdown timeout reached. Forcing exit.");
    process.exit(1);
  }, 10_000).unref();
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT",  () => gracefulShutdown("SIGINT"));
