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
app.use(express.json());

// Static frontend
app.use(express.static(path.join(__dirname, "..", "frontend")));

// --- Auth middleware ---
const requireAdmin = (req, res, next) => {
  const pw = req.headers["x-admin-password"];
  if (pw !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Invalid password" });
  }
  next();
};

// --- Routes ---
app.post("/api/auth/check", (req, res) => {
  const pw = req.body?.password;
  if (pw === ADMIN_PASSWORD) return res.json({ ok: true });
  res.status(401).json({ ok: false });
});

app.get("/api/nodes", async (_req, res) => {
  const { data, error } = await supabase
    .from("nodes")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.post("/api/nodes", requireAdmin, async (req, res) => {
  const body = req.body || {};
  const insert = {
    title: body.title || "New node",
    description: body.description || "",
    developer: body.developer || "Unassigned",
    deadline: body.deadline || null,
    status: body.status || "notstarted",
    progress: clampPct(body.progress),
    pos_x: Number.isFinite(body.pos_x) ? body.pos_x : 200,
    pos_y: Number.isFinite(body.pos_y) ? body.pos_y : 200,
    connections: Array.isArray(body.connections) ? body.connections : [],
  };
  const { data, error } = await supabase
    .from("nodes")
    .insert(insert)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

app.patch("/api/nodes/:id", requireAdmin, async (req, res) => {
  const allowed = [
    "title",
    "description",
    "developer",
    "deadline",
    "status",
    "progress",
    "pos_x",
    "pos_y",
    "connections",
  ];
  const patch = {};
  for (const k of allowed) {
    if (req.body[k] !== undefined) patch[k] = req.body[k];
  }
  if ("progress" in patch) {
    patch.progress = clampPct(patch.progress);
    // Auto-sync status when progress hits 100 / 0
    if (patch.progress === 100 && !patch.status) patch.status = "completed";
    if (patch.progress > 0 && patch.progress < 100 && !patch.status)
      patch.status = "progress";
  }
  const { data, error } = await supabase
    .from("nodes")
    .update(patch)
    .eq("id", req.params.id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.delete("/api/nodes/:id", requireAdmin, async (req, res) => {
  const { error } = await supabase
    .from("nodes")
    .delete()
    .eq("id", req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

function clampPct(v) {
  const n = Math.round(Number(v));
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

app.listen(PORT, () => {
  console.log(`✓ Trackker backend listening on http://localhost:${PORT}`);
  console.log(`  Public:  http://localhost:${PORT}/`);
  console.log(`  Admin:   http://localhost:${PORT}/admin.html`);
  console.log(`  Update:  http://localhost:${PORT}/update.html`);
});
