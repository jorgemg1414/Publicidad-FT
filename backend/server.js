import express from 'express'
import cors from 'cors'
import multer from 'multer'
import dotenv from 'dotenv'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import jwt from 'jsonwebtoken'
import Database from 'better-sqlite3'
import { v2 as cloudinary } from 'cloudinary'

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = process.env.PORT || 3000
const JWT_SECRET = process.env.JWT_SECRET || 'secret-key-publicidad-ft'
const adminPassword = process.env.ADMIN_PASSWORD || 'admin'

// === Cloudinary ===
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
})

const CLOUDINARY_FOLDER = process.env.CLOUDINARY_FOLDER || 'publicidad-ft'

// === SQLite ===
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'db.sqlite')
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true })

const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')

db.exec(`
  CREATE TABLE IF NOT EXISTS images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT NOT NULL,
    public_id TEXT NOT NULL,
    name TEXT,
    priority INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS config (
    id INTEGER PRIMARY KEY,
    interval INTEGER NOT NULL DEFAULT 5000,
    transition INTEGER NOT NULL DEFAULT 1000
  );
`)

// Asegurar que exista config con id=1
db.prepare(`
  INSERT INTO config (id, interval, transition)
  VALUES (1, 5000, 1000)
  ON CONFLICT(id) DO NOTHING
`).run()

// Statements preparados
const stmtListImages = db.prepare('SELECT * FROM images ORDER BY created_at ASC')
const stmtInsertImage = db.prepare(
  'INSERT INTO images (url, public_id, name) VALUES (?, ?, ?)'
)
const stmtDeleteImage = db.prepare('DELETE FROM images WHERE id = ?')
const stmtGetImage = db.prepare('SELECT * FROM images WHERE id = ?')
const stmtAllImages = db.prepare('SELECT * FROM images')
const stmtDeleteAll = db.prepare('DELETE FROM images')
const stmtUpdatePriority = db.prepare('UPDATE images SET priority = ? WHERE id = ?')
const stmtGetConfig = db.prepare('SELECT * FROM config WHERE id = 1')
const stmtUpsertConfig = db.prepare(`
  INSERT INTO config (id, interval, transition) VALUES (1, ?, ?)
  ON CONFLICT(id) DO UPDATE SET interval = excluded.interval, transition = excluded.transition
`)

// Normaliza filas de imágenes (priority como booleano)
const normalizeImage = (row) => row && {
  ...row,
  priority: !!row.priority
}

// === Express setup ===
const storage = multer.memoryStorage()
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } })

app.use(cors())
app.use(express.json())

const authenticate = (req, res, next) => {
  const token = req.headers['authorization']?.replace('Bearer ', '')
  if (!token) {
    return res.status(401).json({ error: 'Token requerido' })
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    req.admin = decoded
    next()
  } catch (e) {
    res.status(401).json({ error: 'Token inválido' })
  }
}

// Sube un buffer a Cloudinary y devuelve { secure_url, public_id }
const uploadBufferToCloudinary = (buffer) => new Promise((resolve, reject) => {
  const stream = cloudinary.uploader.upload_stream(
    { folder: CLOUDINARY_FOLDER, resource_type: 'image' },
    (err, result) => err ? reject(err) : resolve(result)
  )
  stream.end(buffer)
})

// === Rutas ===
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' })
})

app.post('/api/login', (req, res) => {
  const { password } = req.body
  if (password === adminPassword) {
    const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '24h' })
    res.json({ token })
  } else {
    res.status(401).json({ error: 'Contraseña incorrecta' })
  }
})

app.get('/api/images', (req, res) => {
  try {
    const rows = stmtListImages.all().map(normalizeImage)
    res.json(rows)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.get('/api/config', (req, res) => {
  try {
    const cfg = stmtGetConfig.get()
    res.json(cfg || { interval: 5000, transition: 1000 })
  } catch (e) {
    res.json({ interval: 5000, transition: 1000 })
  }
})

app.post('/api/images', authenticate, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se proporcionó imagen' })
    }

    const result = await uploadBufferToCloudinary(req.file.buffer)
    stmtInsertImage.run(result.secure_url, result.public_id, req.file.originalname)

    const rows = stmtListImages.all().map(normalizeImage)
    res.json(rows)
  } catch (e) {
    console.error('Error subiendo imagen:', e)
    res.status(500).json({ error: e.message })
  }
})

app.delete('/api/images/:id', authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const img = stmtGetImage.get(id)

    if (img && img.public_id) {
      try {
        await cloudinary.uploader.destroy(img.public_id, { resource_type: 'image' })
      } catch (err) {
        console.warn('No se pudo borrar de Cloudinary:', err.message)
      }
    }

    stmtDeleteImage.run(id)
    const rows = stmtListImages.all().map(normalizeImage)
    res.json(rows)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.delete('/api/images', authenticate, async (req, res) => {
  try {
    const all = stmtAllImages.all()
    const publicIds = all.map(i => i.public_id).filter(Boolean)

    if (publicIds.length > 0) {
      try {
        await cloudinary.api.delete_resources(publicIds)
      } catch (err) {
        console.warn('No se pudo borrar todo de Cloudinary:', err.message)
      }
    }

    stmtDeleteAll.run()
    res.json([])
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.put('/api/images/:id/priority', authenticate, (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const { priority } = req.body
    stmtUpdatePriority.run(priority ? 1 : 0, id)
    const updated = normalizeImage(stmtGetImage.get(id))
    res.json(updated)
  } catch (e) {
    console.error('Error al actualizar prioridad:', e.message)
    res.status(500).json({ error: e.message })
  }
})

app.put('/api/config', authenticate, (req, res) => {
  try {
    const { interval, transition } = req.body
    stmtUpsertConfig.run(interval, transition)
    res.json({ interval, transition })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend corriendo en http://0.0.0.0:${PORT}`)
  console.log(`SQLite: ${DB_PATH}`)
})
