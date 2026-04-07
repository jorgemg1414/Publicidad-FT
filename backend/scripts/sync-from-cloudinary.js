/**
 * FASE 2 — Reconstruir SQLite desde Cloudinary
 *
 * Uso: Se ejecuta UNA vez en Railway después del primer deploy, para poblar
 * el SQLite del volumen (/data/db.sqlite) con las imágenes que ya fueron
 * subidas a Cloudinary en la Fase 1.
 *
 *   railway run node scripts/sync-from-cloudinary.js
 *
 * (O ssh al contenedor y ejecutar manualmente)
 *
 * Qué hace:
 *  - Lista todos los recursos de la carpeta CLOUDINARY_FOLDER.
 *  - Lee el context de cada uno (priority, original_name, supabase_id).
 *  - Los inserta en SQLite respetando el orden original (por created_at de Cloudinary).
 *  - Idempotente: no duplica si el public_id ya existe.
 */

import 'dotenv/config'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import Database from 'better-sqlite3'
import { v2 as cloudinary } from 'cloudinary'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const {
  CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET,
  CLOUDINARY_FOLDER = 'publicidad-ft',
  DB_PATH
} = process.env

if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
  console.error('❌ Faltan credenciales de Cloudinary en variables de entorno')
  process.exit(1)
}

cloudinary.config({
  cloud_name: CLOUDINARY_CLOUD_NAME,
  api_key: CLOUDINARY_API_KEY,
  api_secret: CLOUDINARY_API_SECRET,
  secure: true
})

// === SQLite ===
const dbPath = DB_PATH || path.join(__dirname, '..', 'data', 'db.sqlite')
fs.mkdirSync(path.dirname(dbPath), { recursive: true })
const db = new Database(dbPath)
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

const stmtInsertImage = db.prepare(
  'INSERT INTO images (url, public_id, name, priority, created_at) VALUES (?, ?, ?, ?, ?)'
)
const stmtExistsByPublicId = db.prepare('SELECT 1 FROM images WHERE public_id = ?')

// Lista TODOS los recursos de la carpeta (con paginación)
const listAllResources = async () => {
  const all = []
  let nextCursor = null

  do {
    const res = await cloudinary.api.resources({
      type: 'upload',
      prefix: `${CLOUDINARY_FOLDER}/`,
      max_results: 500,
      context: true,
      next_cursor: nextCursor || undefined
    })
    all.push(...res.resources)
    nextCursor = res.next_cursor
  } while (nextCursor)

  return all
}

const main = async () => {
  console.log(`🔍 Listando recursos en Cloudinary (carpeta: ${CLOUDINARY_FOLDER})...`)
  const resources = await listAllResources()
  console.log(`   Encontrados ${resources.length} recursos.\n`)

  // Ordenar por fecha de creación para mantener orden
  resources.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))

  let inserted = 0
  let skipped = 0

  for (const r of resources) {
    if (stmtExistsByPublicId.get(r.public_id)) {
      skipped++
      continue
    }

    const ctx = r.context?.custom || {}
    const priority = ctx.priority === '1' ? 1 : 0
    const name = ctx.original_name || r.public_id.split('/').pop()

    stmtInsertImage.run(
      r.secure_url,
      r.public_id,
      name,
      priority,
      r.created_at || new Date().toISOString()
    )
    inserted++
    console.log(`✓ ${name}${priority ? ' ⭐' : ''}`)
  }

  console.log('\n=== RESUMEN ===')
  console.log(`   ✓ Insertadas: ${inserted}`)
  console.log(`   ⏭ Ya existían: ${skipped}`)
  console.log(`\nSQLite: ${dbPath}`)
  db.close()
}

main().catch(e => {
  console.error('Error fatal:', e)
  db.close()
  process.exit(1)
})
