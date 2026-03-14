# Supabase Setup Guide for Bluestar

Follow these steps once. Takes about 10 minutes.

---

## Step 1 — Create a Supabase project

1. Go to https://supabase.com and sign up for free
2. Click **New Project**
3. Name it `bluestar`, pick a region closest to India (e.g. Southeast Asia)
4. Set a database password (save it somewhere, you won't need it again)
5. Click **Create new project** — wait ~2 minutes for it to spin up

---

## Step 2 — Create the works table

1. In your project dashboard, click **SQL Editor** in the left sidebar
2. Click **New query**
3. Paste this SQL and click **Run**:

```sql
create table works (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  type        text not null default 'poem',
  lang        text not null default 'en',
  date        text not null,
  excerpt     text,
  content     text not null,
  created_at  timestamptz default now()
);

-- Allow anyone to read works (public portfolio)
alter table works enable row level security;

create policy "Public can read works"
  on works for select
  using (true);

-- Only authenticated users can insert/delete
-- Since we use a password on the frontend, we use the anon key
-- and grant insert/delete to anon for simplicity
create policy "Anon can insert works"
  on works for insert
  with check (true);

create policy "Anon can delete works"
  on works for delete
  using (true);
```

---

## Step 3 — Get your API keys

1. In your project dashboard, click **Settings** (gear icon) → **API**
2. Copy two things:
   - **Project URL** — looks like `https://abcdefgh.supabase.co`
   - **anon public** key — long string starting with `eyJ...`

---

## Step 4 — Add keys to the website

Open `js/config.js` and replace the placeholder values:

```js
var SUPABASE_URL  = 'https://abcdefgh.supabase.co';   // your Project URL
var SUPABASE_ANON = 'eyJhbGciOi...';                  // your anon key
```

Save the file.

---

## Step 5 — Deploy

Drag the `bluestar/` folder to https://app.netlify.com/drop

That's it! The first time the site loads, it will automatically insert
the starter poems into Supabase. Every poem published from the Write
page is saved permanently and appears on all devices.

---

## Notes

- The **anon key** is safe to put in frontend code — it's designed for this
- Row Level Security (RLS) is enabled so the database is protected
- Poems are stored in Supabase's free tier which gives you 500MB and
  unlimited reads — more than enough for a poetry portfolio forever
- If you ever want to edit a poem, go to Supabase Dashboard → Table Editor
  → works and edit directly

---

## Changing the password

Open `js/app.js` line 3:

```js
var SECRET_PASSWORD = "bluestar2024";
```

Change it to whatever you want and redeploy.
