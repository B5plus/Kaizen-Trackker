-- Trackker — schema
-- Run this once in Supabase SQL editor.

create table if not exists nodes (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  description  text default '',
  developer    text default '',
  deadline     date,
  status       text not null default 'notstarted'
                check (status in ('notstarted','progress','completed')),
  progress     int  not null default 0
                check (progress between 0 and 100),
  pos_x        int  not null default 200,
  pos_y        int  not null default 200,
  connections  jsonb not null default '[]'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Auto-bump updated_at
create or replace function set_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

drop trigger if exists trg_nodes_updated_at on nodes;
create trigger trg_nodes_updated_at
  before update on nodes
  for each row execute function set_updated_at();

-- Sample seed data
insert into nodes (title, description, developer, deadline, status, progress, pos_x, pos_y, connections)
values
  ('Discovery & specs',     'Stakeholder interviews, requirements doc.',  'Sarah Chen',  '2026-05-08', 'completed', 100, 120, 200, '[]'),
  ('UI design',             'Wireframes, hi-fi mocks, design tokens.',    'Mei Tanaka',  '2026-05-20', 'completed', 100, 360, 120, '[]'),
  ('Backend API',           'REST endpoints, auth, database schema.',     'James Patel', '2026-06-05', 'progress',   65, 360, 280, '[]'),
  ('Frontend build',        'React app wired to API.',                    'Diego Rojas', '2026-06-20', 'progress',   30, 600, 200, '[]'),
  ('QA & launch',           'Bug bash, deploy, monitor.',                 'Unassigned',  '2026-07-01', 'notstarted',  0, 840, 200, '[]')
on conflict do nothing;

-- Wire up connections (Discovery -> UI Design + Backend, UI -> Frontend, Backend -> Frontend, Frontend -> QA)
-- Run this AFTER the inserts above (and only on a fresh seed)
do $$
declare
  d uuid; ui uuid; be uuid; fe uuid; qa uuid;
begin
  select id into d  from nodes where title = 'Discovery & specs' limit 1;
  select id into ui from nodes where title = 'UI design'         limit 1;
  select id into be from nodes where title = 'Backend API'       limit 1;
  select id into fe from nodes where title = 'Frontend build'    limit 1;
  select id into qa from nodes where title = 'QA & launch'       limit 1;
  if d is not null then
    update nodes set connections = to_jsonb(array[ui::text, be::text]) where id = d;
    update nodes set connections = to_jsonb(array[fe::text]) where id = ui;
    update nodes set connections = to_jsonb(array[fe::text]) where id = be;
    update nodes set connections = to_jsonb(array[qa::text]) where id = fe;
  end if;
end $$;
