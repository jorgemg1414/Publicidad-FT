/**
 * Renombra todos los assets en Cloudinary de una carpeta a otra,
 * y actualiza el SQLite con las nuevas URLs / public_ids.
 *
 * Uso (desde /backend):
 *   FROM_FOLDER=publicidad-ft TO_FOLDER=ft-media node scripts/rename-cloudinary-folder.js
 *
 * Motivo: palabras como "publicidad", "ads", "banner" en la URL disparan
 * ad blockers (ERR_BLOCKED_BY_CLIENT). Usá un nombre neutral.
 *
 * Después de correrlo, actualizá CLOUDINARY_FOLDER en tu .env al nuevo valor.
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
  DB_PATH,
  FROM_FOLDER,
  TO_FOLDER
} = process.env

if (!FROM_FOLDER || !TO_FOLDER) {
  console.error('❌ Falta FROM_FOLDER o TO_FOLDER')
  console.error('   Ej: FROM_FOLDER=publicidad-ft TO_FOLDER=ft-media node scripts/rename-cloudinary-folder.js')
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
if (!fs.existsSync(dbPath)) {
  console.error(`❌ No existe el SQLite en ${dbPath}`)
  process.exit(1)
}
const db = new Database(dbPath)
db.pragma('journal_mode = WAL')

const stmtUpdateRow = db.prepare(
  'UPDATE images SET url = ?, public_id = ? WHERE public_id = ?'
)

// Lista todos los recursos de FROM_FOLDER (con paginación)
const listAllResources = async () => {
  const all = []
  let nextCursor = null
  do {
    const res = await cloudinary.api.resources({
      type: 'upload',
      prefix: `${FROM_FOLDER}/`,
      max_results: 500,
      next_cursor: nextCursor || undefined
    })
    all.push(...res.resources)
    nextCursor = res.next_cursor
  } while (nextCursor)
  return all
}

const main = async () => {
  console.log(`🔍 Listando recursos en ${FROM_FOLDER}/ ...`)
  const resources = await listAllResources()
  console.log(`   Encontrados ${resources.length} recursos.\n`)

  if (resources.length === 0) {
    console.log('No hay nada para renombrar.')
    db.close()
    return
  }

  let renamed = 0
  let failed = 0

  for (const r of resources) {
    const oldPublicId = r.public_id
    // oldPublicId ejemplo: "publicidad-ft/abc123"
    const filename = oldPublicId.substring(FROM_FOLDER.length + 1)
    const newPublicId = `${TO_FOLDER}/${filename}`

    try {
      process.stdout.write(`→ ${filename} ... `)
      const result = await cloudinary.uploader.rename(oldPublicId, newPublicId, {
        resource_type: 'image',
        overwrite: false
      })

      // Actualizar SQLite
      const info = stmtUpdateRow.run(result.secure_url, result.public_id, oldPublicId)
      process.stdout.write(`✓ (sqlite: ${info.changes} fila${info.changes !== 1 ? 's' : ''})\n`)
      renamed++
    } catch (e) {
      process.stdout.write(`❌ ${e.message}\n`)
      failed++
    }
  }

  console.log('\n=== RESUMEN ===')
  console.log(`   ✓ Renombradas: ${renamed}`)
  console.log(`   ❌ Fallidas: ${failed}`)
  console.log(`\n⚠ Acordate de actualizar CLOUDINARY_FOLDER=${TO_FOLDER} en tu .env`)
  db.close()
}

main().catch((e) => {
  console.error('Error fatal:', e)
  db.close()
  process.exit(1)
})
