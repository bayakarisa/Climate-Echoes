import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { Pool } from 'pg'
import fs from 'fs'
import path from 'path'
import url from 'url'

dotenv.config()

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const port = process.env.PORT || 4000

// Middleware
app.use(cors())
app.use(express.json({ limit: '10mb' }))

// DB
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  host: process.env.PGHOST,
  port: process.env.PGPORT ? Number(process.env.PGPORT) : undefined,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
  ssl: process.env.PGSSL === 'require' ? { rejectUnauthorized: false } : undefined
})

async function query(sql, params) {
  const client = await pool.connect()
  try {
    const res = await client.query(sql, params)
    return res
  } finally {
    client.release()
  }
}

// Validation helpers
function assert(condition, message, status = 400) {
  if (!condition) {
    const err = new Error(message)
    err.status = status
    throw err
  }
}

function sanitizeInt(value, field) {
  const n = Number(value)
  assert(Number.isInteger(n), `${field} must be an integer`)
  return n
}

// Migrations
const migrationsSql = `
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  age INTEGER CHECK (age >= 14 AND age <= 30),
  country TEXT,
  bio TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS submissions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  theme TEXT,
  media_url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected'))
);

CREATE TABLE IF NOT EXISTS gallery (
  id SERIAL PRIMARY KEY,
  submission_id INTEGER NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  featured BOOLEAN DEFAULT false,
  published_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS events (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  date TIMESTAMPTZ,
  location TEXT,
  link TEXT
);

CREATE TABLE IF NOT EXISTS partners (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  logo_url TEXT,
  website TEXT
);

CREATE TABLE IF NOT EXISTS contacts (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
`

async function migrate() {
  await query(migrationsSql)
  console.log('Migrations applied')
}

// Routes
app.get('/health', async (req, res) => {
  try {
    await query('SELECT 1')
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message })
  }
})

// Users CRUD
app.get('/api/users', async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM users ORDER BY id DESC')
    res.json(rows)
  } catch (e) { next(e) }
})

app.get('/api/users/:id', async (req, res, next) => {
  try {
    const id = sanitizeInt(req.params.id, 'id')
    const { rows } = await query('SELECT * FROM users WHERE id=$1', [id])
    assert(rows.length, 'User not found', 404)
    res.json(rows[0])
  } catch (e) { next(e) }
})

app.post('/api/users', async (req, res, next) => {
  try {
    const { name, email, age, country, bio } = req.body
    assert(name && email, 'name and email are required')
    if (age !== undefined && age !== null) {
      const a = sanitizeInt(age, 'age')
      assert(a >= 14 && a <= 30, 'age must be between 14 and 30')
    }
    const { rows } = await query(
      'INSERT INTO users(name,email,age,country,bio) VALUES($1,$2,$3,$4,$5) RETURNING *',
      [name, email, age ?? null, country ?? null, bio ?? null]
    )
    res.status(201).json(rows[0])
  } catch (e) { next(e) }
})

app.put('/api/users/:id', async (req, res, next) => {
  try {
    const id = sanitizeInt(req.params.id, 'id')
    const { name, email, age, country, bio } = req.body
    if (age !== undefined && age !== null) {
      const a = sanitizeInt(age, 'age')
      assert(a >= 14 && a <= 30, 'age must be between 14 and 30')
    }
    const { rows } = await query(
      `UPDATE users SET name=COALESCE($1,name), email=COALESCE($2,email), age=$3, country=COALESCE($4,country), bio=COALESCE($5,bio)
       WHERE id=$6 RETURNING *`,
      [name ?? null, email ?? null, age ?? null, country ?? null, bio ?? null, id]
    )
    assert(rows.length, 'User not found', 404)
    res.json(rows[0])
  } catch (e) { next(e) }
})

app.delete('/api/users/:id', async (req, res, next) => {
  try {
    const id = sanitizeInt(req.params.id, 'id')
    const { rowCount } = await query('DELETE FROM users WHERE id=$1', [id])
    assert(rowCount, 'User not found', 404)
    res.status(204).send()
  } catch (e) { next(e) }
})

// Submissions CRUD
app.get('/api/submissions', async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM submissions ORDER BY id DESC')
    res.json(rows)
  } catch (e) { next(e) }
})

app.get('/api/submissions/:id', async (req, res, next) => {
  try {
    const id = sanitizeInt(req.params.id, 'id')
    const { rows } = await query('SELECT * FROM submissions WHERE id=$1', [id])
    assert(rows.length, 'Submission not found', 404)
    res.json(rows[0])
  } catch (e) { next(e) }
})

app.post('/api/submissions', async (req, res, next) => {
  try {
    const { user_id, title, description, theme, media_url, status } = req.body
    assert(title && description && media_url, 'title, description, media_url are required')
    if (user_id !== undefined && user_id !== null) sanitizeInt(user_id, 'user_id')
    if (status) assert(['pending','approved','rejected'].includes(status), 'invalid status')
    const { rows } = await query(
      `INSERT INTO submissions(user_id,title,description,theme,media_url,status)
       VALUES($1,$2,$3,$4,$5,COALESCE($6,'pending')) RETURNING *`,
      [user_id ?? null, title, description, theme ?? null, media_url, status ?? null]
    )
    res.status(201).json(rows[0])
  } catch (e) { next(e) }
})

app.put('/api/submissions/:id', async (req, res, next) => {
  try {
    const id = sanitizeInt(req.params.id, 'id')
    const { user_id, title, description, theme, media_url, status } = req.body
    if (user_id !== undefined && user_id !== null) sanitizeInt(user_id, 'user_id')
    if (status) assert(['pending','approved','rejected'].includes(status), 'invalid status')
    const { rows } = await query(
      `UPDATE submissions SET
        user_id=$1, title=COALESCE($2,title), description=COALESCE($3,description),
        theme=COALESCE($4,theme), media_url=COALESCE($5,media_url), status=COALESCE($6,status)
       WHERE id=$7 RETURNING *`,
      [user_id ?? null, title ?? null, description ?? null, theme ?? null, media_url ?? null, status ?? null, id]
    )
    assert(rows.length, 'Submission not found', 404)
    res.json(rows[0])
  } catch (e) { next(e) }
})

app.delete('/api/submissions/:id', async (req, res, next) => {
  try {
    const id = sanitizeInt(req.params.id, 'id')
    const { rowCount } = await query('DELETE FROM submissions WHERE id=$1', [id])
    assert(rowCount, 'Submission not found', 404)
    res.status(204).send()
  } catch (e) { next(e) }
})

// Gallery (approved submissions only)
app.get('/api/gallery', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT s.* FROM submissions s WHERE s.status='approved' ORDER BY s.created_at DESC`
    )
    res.json(rows)
  } catch (e) { next(e) }
})

// Events CRUD
app.get('/api/events', async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM events ORDER BY date DESC NULLS LAST, id DESC')
    res.json(rows)
  } catch (e) { next(e) }
})

app.get('/api/events/:id', async (req, res, next) => {
  try {
    const id = sanitizeInt(req.params.id, 'id')
    const { rows } = await query('SELECT * FROM events WHERE id=$1', [id])
    assert(rows.length, 'Event not found', 404)
    res.json(rows[0])
  } catch (e) { next(e) }
})

app.post('/api/events', async (req, res, next) => {
  try {
    const { title, description, date, location, link } = req.body
    assert(title, 'title is required')
    const { rows } = await query(
      `INSERT INTO events(title,description,date,location,link) VALUES($1,$2,$3,$4,$5) RETURNING *`,
      [title, description ?? null, date ?? null, location ?? null, link ?? null]
    )
    res.status(201).json(rows[0])
  } catch (e) { next(e) }
})

app.put('/api/events/:id', async (req, res, next) => {
  try {
    const id = sanitizeInt(req.params.id, 'id')
    const { title, description, date, location, link } = req.body
    const { rows } = await query(
      `UPDATE events SET title=COALESCE($1,title), description=COALESCE($2,description), date=$3, location=COALESCE($4,location), link=COALESCE($5,link)
       WHERE id=$6 RETURNING *`,
      [title ?? null, description ?? null, date ?? null, location ?? null, link ?? null, id]
    )
    assert(rows.length, 'Event not found', 404)
    res.json(rows[0])
  } catch (e) { next(e) }
})

app.delete('/api/events/:id', async (req, res, next) => {
  try {
    const id = sanitizeInt(req.params.id, 'id')
    const { rowCount } = await query('DELETE FROM events WHERE id=$1', [id])
    assert(rowCount, 'Event not found', 404)
    res.status(204).send()
  } catch (e) { next(e) }
})

// Partners CRUD
app.get('/api/partners', async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM partners ORDER BY id DESC')
    res.json(rows)
  } catch (e) { next(e) }
})

app.get('/api/partners/:id', async (req, res, next) => {
  try {
    const id = sanitizeInt(req.params.id, 'id')
    const { rows } = await query('SELECT * FROM partners WHERE id=$1', [id])
    assert(rows.length, 'Partner not found', 404)
    res.json(rows[0])
  } catch (e) { next(e) }
})

app.post('/api/partners', async (req, res, next) => {
  try {
    const { name, description, logo_url, website } = req.body
    assert(name, 'name is required')
    const { rows } = await query(
      `INSERT INTO partners(name,description,logo_url,website) VALUES($1,$2,$3,$4) RETURNING *`,
      [name, description ?? null, logo_url ?? null, website ?? null]
    )
    res.status(201).json(rows[0])
  } catch (e) { next(e) }
})

app.put('/api/partners/:id', async (req, res, next) => {
  try {
    const id = sanitizeInt(req.params.id, 'id')
    const { name, description, logo_url, website } = req.body
    const { rows } = await query(
      `UPDATE partners SET name=COALESCE($1,name), description=COALESCE($2,description), logo_url=COALESCE($3,logo_url), website=COALESCE($4,website)
       WHERE id=$5 RETURNING *`,
      [name ?? null, description ?? null, logo_url ?? null, website ?? null, id]
    )
    assert(rows.length, 'Partner not found', 404)
    res.json(rows[0])
  } catch (e) { next(e) }
})

app.delete('/api/partners/:id', async (req, res, next) => {
  try {
    const id = sanitizeInt(req.params.id, 'id')
    const { rowCount } = await query('DELETE FROM partners WHERE id=$1', [id])
    assert(rowCount, 'Partner not found', 404)
    res.status(204).send()
  } catch (e) { next(e) }
})

// Contact messages
app.get('/api/contact', async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM contacts ORDER BY created_at DESC')
    res.json(rows)
  } catch (e) { next(e) }
})

app.post('/api/contact', async (req, res, next) => {
  try {
    const { name, email, message } = req.body
    assert(name && email && message, 'name, email, message are required')
    const { rows } = await query(
      `INSERT INTO contacts(name,email,message) VALUES($1,$2,$3) RETURNING *`,
      [name, email, message]
    )
    res.status(201).json(rows[0])
  } catch (e) { next(e) }
})

// Error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err.status || 500
  res.status(status).json({ error: err.message || 'Internal Server Error' })
})

// CLI entry
const arg = process.argv[2]
if (arg === 'migrate') {
  migrate().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
} else {
  // Ensure DB is reachable and run migrations on start (optional)
  migrate().then(() => {
    app.listen(port, () => console.log(`API listening on :${port}`))
  }).catch(err => {
    console.error('DB migration/startup error:', err)
    process.exit(1)
  })
}




