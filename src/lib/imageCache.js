/**
 * Caché de imágenes basado en IndexedDB.
 *
 * Flujo:
 *   1. getImageBlobUrl(url) busca la imagen en IndexedDB.
 *   2. Si está cacheada, devuelve un blob URL local.
 *   3. Si no, la descarga de Cloudinary, la guarda en IDB y devuelve el blob URL.
 *
 * Ventaja vs cache HTTP del navegador: persiste entre sesiones y es mucho menos
 * propenso a ser expulsado. Ideal para un carrusel que reproduce las mismas
 * imágenes todo el día.
 */

const DB_NAME = 'publicidad-ft-cache'
const STORE = 'images'
const DB_VERSION = 1

let dbPromise = null

function openDb() {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    if (!('indexedDB' in globalThis)) {
      reject(new Error('IndexedDB no disponible'))
      return
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

function txRun(mode, fn) {
  return openDb().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode)
    const store = tx.objectStore(STORE)
    const req = fn(store)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  }))
}

async function getCached(url) {
  try {
    return await txRun('readonly', store => store.get(url))
  } catch {
    return null
  }
}

async function setCached(url, blob) {
  try {
    await txRun('readwrite', store => store.put(blob, url))
  } catch (e) {
    // Si el quota está lleno u otro error, seguimos funcionando sin caché
    console.warn('No se pudo guardar en IndexedDB:', e)
  }
}

async function deleteCached(url) {
  try {
    await txRun('readwrite', store => store.delete(url))
  } catch {}
}

async function listKeys() {
  try {
    return await txRun('readonly', store => store.getAllKeys())
  } catch {
    return []
  }
}

/**
 * Descarga un blob con reintentos. Garantiza que la descarga sea completa
 * (valida Content-Length contra el tamaño real del blob cuando está disponible).
 */
async function fetchBlobWithRetry(url, { retries = 3, timeoutMs = 30000 } = {}) {
  let lastErr
  for (let attempt = 0; attempt < retries; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const res = await fetch(url, { cache: 'no-store', signal: controller.signal })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const expected = parseInt(res.headers.get('content-length') || '0', 10)
      const blob = await res.blob()

      if (blob.size === 0) throw new Error('Blob vacío')
      if (expected > 0 && blob.size !== expected) {
        throw new Error(`Tamaño incompleto: ${blob.size}/${expected}`)
      }

      clearTimeout(timer)
      return blob
    } catch (e) {
      clearTimeout(timer)
      lastErr = e
      if (attempt < retries - 1) {
        // Backoff: 1s, 2s, 4s...
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)))
      }
    }
  }
  throw lastErr
}

/**
 * Devuelve un blob URL listo para usar en <img src>, solo cuando la imagen
 * está COMPLETAMENTE descargada y decodificada en memoria.
 *
 * - Si está en IndexedDB, la reutiliza (instantáneo).
 * - Si no, la descarga con reintentos, valida integridad y la cachea.
 * - Si falla definitivamente, devuelve null (el caller debe filtrarla).
 */
export async function getImageBlobUrl(url) {
  try {
    let blob = await getCached(url)
    if (!blob || blob.size === 0) {
      blob = await fetchBlobWithRetry(url)
      await setCached(url, blob)
    }

    const blobUrl = URL.createObjectURL(blob)

    // Pre-decodificar: forzamos al navegador a tener el bitmap listo en memoria
    // antes de retornar. Esto evita el "cuadrito progresivo" en conexión lenta.
    try {
      const img = new Image()
      img.src = blobUrl
      if (img.decode) await img.decode()
    } catch {
      // Si decode() no está soportado o falla, no es crítico — la imagen igual
      // ya está completa como blob.
    }

    return blobUrl
  } catch (e) {
    console.warn('getImageBlobUrl falló definitivamente:', url, e.message)
    return null
  }
}

/**
 * Elimina del caché todas las URLs que no estén en activeUrls.
 * Útil para purgar imágenes borradas del backend y evitar que el caché crezca infinito.
 */
export async function pruneCache(activeUrls) {
  try {
    const keys = await listKeys()
    const active = new Set(activeUrls)
    for (const key of keys) {
      if (!active.has(key)) {
        await deleteCached(key)
      }
    }
  } catch (e) {
    console.warn('pruneCache fallo:', e)
  }
}

/**
 * Revoca un blob URL generado por URL.createObjectURL para liberar memoria.
 */
export function revokeBlobUrl(blobUrl) {
  if (typeof blobUrl === 'string' && blobUrl.startsWith('blob:')) {
    URL.revokeObjectURL(blobUrl)
  }
}
