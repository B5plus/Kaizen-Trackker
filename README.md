# Trackker — Project Node Tracker

Tiny full-stack app to track tasks ("nodes") on a single project.
**Supabase** (Postgres) + **Node.js / Express** backend + plain **React via CDN** frontend.

## Pages

| Path          | Who                  | What                                                                                                      |
| ------------- | -------------------- | --------------------------------------------------------------------------------------------------------- |
| `/`           | Public / client      | Read-only **node graph** view. Connected nodes show description, developer, deadline, status, progress %. |
| `/admin.html` | Developer (password) | Full CRUD: add / edit / delete nodes, set position on the graph, edit all fields.                         |

## Folder structure

```
.
├── backend/
│   ├── server.js          # Express API (proxies to Supabase)
│   ├── package.json
│   └── .env.example
├── frontend/
│   ├── index.html         # Public node graph
│   ├── admin.html         # Manage nodes
│   ├── app.jsx            # Public page React
│   ├── admin.jsx          # Admin page React
│   └── styles.css         # Shared styles
└── sql/
    └── schema.sql         # Run this once in Supabase SQL editor
```

## Setup (10 minutes)

### 1. Create the Supabase table

1. Go to your Supabase project → **SQL Editor**
2. Paste the contents of `sql/schema.sql`
3. Click **Run**

### 2. Configure the backend

```bash
cd backend
cp .env.example .env
# Edit .env and fill in:
#   SUPABASE_URL=https://YOUR-PROJECT.supabase.co
#   SUPABASE_SERVICE_KEY=eyJ...   (Settings → API → service_role key)
#   ADMIN_PASSWORD=pick-anything

npm install
npm start
```

Backend runs on `http://localhost:3000` and also serves the frontend.

### 3. Open the app

- Public graph: <http://localhost:3000/>
- Admin: <http://localhost:3000/admin.html>

When the admin page asks for a password, type whatever you put in `ADMIN_PASSWORD`.

## API

All endpoints are JSON. Mutating endpoints require an `x-admin-password` header.

| Method | Path             | Purpose                             |
| ------ | ---------------- | ----------------------------------- |
| GET    | `/api/nodes`     | List all nodes                      |
| POST   | `/api/nodes`     | Create a node _(password required)_ |
| PATCH  | `/api/nodes/:id` | Update fields _(password required)_ |
| DELETE | `/api/nodes/:id` | Delete a node _(password required)_ |

## Notes

- The free-form layout means every node has `pos_x` / `pos_y` columns — drag a node in `/admin.html` to move it; the public graph reflects the same coordinates.
- Connections live in a `connections` JSON array on each node (list of node IDs it points to).
- The `service_role` key lives only on the backend — the frontend never touches Supabase directly.
# Kaizen-Trackker
