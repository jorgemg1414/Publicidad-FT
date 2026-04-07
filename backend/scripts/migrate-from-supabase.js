/**
 * FASE 1 — Migración Supabase → Cloudinary + SQLite
 *
 * Uso (desde /backend):
 *   SUPABASE_URL=https://xxx.supabase.co \
 *   SUPABASE_ANON_KEY=eyJhbGc... \
 *   node scripts/migrate-from-supabase.js
 *
 * Qué hace:
 *  1. Lee todas las filas de la tabla `images` de Supabase (REST API).
 *  2. Descarga cada imagen desde su URL pública.
 *  3. La sube a Cloudinary con context { priority, original_name, supabase_id }.
 *  4. Inserta la fila en el SQLite local (DB_PATH del .env del backend).
 *  5. Lee la tabla `config` y la copia al SQLite.
 *
 * Seguro contra re-ejecución: salta imágenes ya subidas (mismo supabase_id en context).
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
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET,
  CLOUDINARY_FOLDER = 'publicidad-ft',
  DB_PATH
} = process.env

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Falta SUPABASE_URL o SUPABASE_ANON_KEY en variables de entorno.')
  console.error('   Ejecutá: SUPABASE_URL=... SUPABASE_ANON_KEY=... node scripts/migrate-from-supabase.js')
  process.exit(1)
}

if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
  console.error('❌ Faltan credenciales de Cloudinary en .env')
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
const stmtUpsertConfig = db.prepare(`
  INSERT INTO config (id, interval, transition) VALUES (1, ?, ?)
  ON CONFLICT(id) DO UPDATE SET interval = excluded.interval, transition = excluded.transition
`)

// === Helpers ===
const supabaseFetch = async (table) => {
  const url = `${SUPABASE_URL}/rest/v1/${table}?select=*`
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`
    }
  })
  if (!res.ok) throw new Error(`Supabase ${table}: ${res.status} ${await res.text()}`)
  return res.json()
}

const downloadBuffer = async (url) => {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Descarga fallida (${res.status}): ${url}`)
  const arrayBuf = await res.arrayBuffer()
  return Buffer.from(arrayBuf)
}

const uploadToCloudinary = (buffer, context) => new Promise((resolve, reject) => {
  const stream = cloudinary.uploader.upload_stream(
    {
      folder: CLOUDINARY_FOLDER,
      resource_type: 'image',
      context
    },
    (err, result) => err ? reject(err) : resolve(result)
  )
  stream.end(buffer)
})

// Busca en Cloudinary si ya subimos esta imagen antes (por supabase_id en context)
const findExistingInCloudinary = async (supabaseId) => {
  try {
    const result = await cloudinary.search
      .expression(`folder:${CLOUDINARY_FOLDER} AND context.supabase_id=${supabaseId}`)
      .max_results(1)
      .execute()
    return result.resources[0] || null
  } catch {
    return null
  }
}

// === Main ===
const main = async () => {
  console.log('🔍 Leyendo imágenes de Supabase...')
  const images = await supabaseFetch('images')
  console.log(`   Encontradas ${images.length} imágenes.\n`)

  // Ordenar por created_at para preservar el orden original
  images.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))

  let migrated = 0
  let skipped = 0
  let failed = 0

  for (const img of images) {
    const label = `[${img.id}] ${img.name || '(sin nombre)'}`
    try {
      // ¿Ya existe en Cloudinary?
      const existing = await findExistingInCloudinary(img.id)
      let cloudinaryResult

      if (existing) {
        console.log(`⏭  ${label} — ya estaba en Cloudinary, reutilizando`)
        cloudinaryResult = existing
      } else {
        process.stdout.write(`⬇  ${label} — descargando... `)
        const buffer = await downloadBuffer(img.url)
        process.stdout.write(`subiendo... `)
        cloudinaryResult = await uploadToCloudinary(buffer, {
          supabase_id: String(img.id),
          priority: img.priority ? '1' : '0',
          original_name: img.name || ''
        })
        process.stdout.write(`✓\n`)
      }

      // ¿Ya está en SQLite?
      if (stmtExistsByPublicId.get(cloudinaryResult.public_id)) {
        console.log(`   ya estaba en SQLite, salto insert`)
        skipped++
        continue
      }

      stmtInsertImage.run(
        cloudinaryResult.secure_url,
        cloudinaryResult.public_id,
        img.name || null,
        img.priority ? 1 : 0,
        img.created_at || new Date().toISOString()
      )
      migrated++
    } catch (e) {
      console.error(`❌ ${label} — ${e.message}`)
      failed++
    }
  }

  console.log('\n🔍 Leyendo config de Supabase...')
  try {
    const configs = await supabaseFetch('config')
    const cfg = configs.find(c => c.id === 1) || configs[0]
    if (cfg) {
      stmtUpsertConfig.run(cfg.interval || 5000, cfg.transition || 1000)
      console.log(`   Config guardada: interval=${cfg.interval}, transition=${cfg.transition}`)
    }
  } catch (e) {
    console.warn(`   ⚠ No se pudo migrar config: ${e.message}`)
  }

  console.log('\n=== RESUMEN ===')
  console.log(`   ✓ Migradas: ${migrated}`)
  console.log(`   ⏭ Saltadas (ya existían): ${skipped}`)
  console.log(`   ❌ Fallidas: ${failed}`)
  console.log(`\nSQLite: ${dbPath}`)
  db.close()
}

main().catch(e => {
  console.error('Error fatal:', e)
  db.close()
  process.exit(1)
})
