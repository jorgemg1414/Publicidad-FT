<template>
  <div class="carousel-container">
    <div v-if="!isConfigured" class="setup-message">
      <p>⚙️ Configuración requerida</p>
      <small>Añade VITE_API_URL en el archivo .env</small>
    </div>
    <div v-else-if="error" class="error-message">
      <p>⚠️ Error de conexión</p>
      <small>{{ error }}</small>
    </div>
    <Transition v-else name="fade" mode="out-in">
      <img
        v-if="currentImageSrc"
        :key="currentImage.id"
        :src="currentImageSrc"
        :alt="currentImage.name"
        class="carousel-image"
      />
      <div v-else class="no-images">
        <p>Cargando imágenes...</p>
      </div>
    </Transition>
    
    <div class="brand">
      <span>Publicidad</span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { api, isConfigured } from '../api'
import { getImageBlobUrl, pruneCache, revokeBlobUrl } from '../lib/imageCache'

// Cada cuánto consultar al backend por cambios (en milisegundos)
const POLL_INTERVAL = 15000

const images = ref([])
const playlist = ref([])
const currentIndex = ref(0)
const config = ref({ interval: 10000, transition: 1000 })
const error = ref(null)
// Mapa: URL original de Cloudinary -> blob URL local (desde IndexedDB)
const blobUrls = ref(new Map())
let timer = null
let pollTimer = null
// Firma del último estado conocido (para detectar cambios sin comparar todo)
let lastSignature = ''

const buildPlaylist = (imgs) => {
  const list = []
  imgs.forEach(img => {
    const times = img.priority ? 3 : 1
    for (let i = 0; i < times; i++) list.push(img)
  })
  return list
}

// Firma simple: ids + prioridades. Cambia si se agrega, borra o se marca PREF.
const signatureOf = (imgs) =>
  imgs.map(i => `${i.id}:${i.priority ? 1 : 0}`).join(',')

const currentImage = computed(() => playlist.value[currentIndex.value] || null)
const currentImageSrc = computed(() => {
  const img = currentImage.value
  if (!img) return null
  return blobUrls.value.get(img.url) || null
})

/**
 * Resuelve el listado del backend a blob URLs, reutilizando los que ya están
 * en memoria (para no re-descargar imágenes existentes) y liberando los que
 * quedaron huérfanos. No mueve currentIndex; eso lo hace el watcher de images.
 */
const syncImages = async (data) => {
  // 1. Limpiar del caché IDB imágenes que ya no están en el backend
  pruneCache(data.map(i => i.url)).catch(() => {})

  // 2. Nuevo mapa de blob URLs: reusa los existentes, descarga solo los nuevos
  const nextBlobs = new Map()
  const resolved = await Promise.all(data.map(async (img) => {
    const existing = blobUrls.value.get(img.url)
    if (existing) {
      nextBlobs.set(img.url, existing)
      return img
    }
    const blobUrl = await getImageBlobUrl(img.url)
    if (!blobUrl) return null
    nextBlobs.set(img.url, blobUrl)
    return img
  }))

  // 3. Revocar los blob URLs huérfanos (imágenes borradas del backend)
  blobUrls.value.forEach((blobUrl, origUrl) => {
    if (!nextBlobs.has(origUrl)) revokeBlobUrl(blobUrl)
  })

  blobUrls.value = nextBlobs
  // Mejor un carrusel con N-2 imágenes bien que uno con N donde 2 estén rotas
  images.value = resolved.filter(Boolean)
  lastSignature = signatureOf(images.value)
}

/** Carga inicial — usado solo en onMounted. */
const fetchData = async () => {
  try {
    const data = await api.getImages()
    if (data) await syncImages(data)

    const cfg = await api.getConfig()
    if (cfg) config.value = cfg
  } catch (e) {
    console.error('Error cargando datos:', e)
    error.value = e.message
  }
}

/**
 * Poll: revisa si hubo cambios en backend y actualiza sin tocar
 * el estado del carrusel si no hay novedades. Silencioso ante errores
 * para no romper el display cuando hay fallas de red temporales.
 */
const pollForUpdates = async () => {
  try {
    const data = await api.getImages()
    if (!data) return

    const newSig = signatureOf(data)
    if (newSig !== lastSignature) {
      console.log('[poll] cambios detectados, actualizando carrusel')
      await syncImages(data)
    }

    // Chequear config también (por si cambiaste el intervalo desde admin)
    const cfg = await api.getConfig()
    if (cfg && (cfg.interval !== config.value.interval || cfg.transition !== config.value.transition)) {
      config.value = cfg
    }
  } catch (e) {
    // Silencioso a propósito: seguimos mostrando lo que ya tenemos
    console.warn('[poll] falló, reintentamos en el próximo ciclo:', e.message)
  }
}

const nextImage = () => {
  if (playlist.value.length > 0) {
    currentIndex.value = (currentIndex.value + 1) % playlist.value.length
  }
}

const startTimer = () => {
  stopTimer()
  if (playlist.value.length > 0) {
    timer = setInterval(nextImage, config.value.interval)
  }
}

const stopTimer = () => {
  if (timer) clearInterval(timer)
}

// Cuando cambia la lista de imágenes, rebuilda la playlist manteniendo
// la posición actual si la imagen que estaba mostrándose sigue existiendo.
watch(images, (newImages) => {
  const currentId = playlist.value[currentIndex.value]?.id
  playlist.value = buildPlaylist(newImages)

  if (currentId !== undefined) {
    const newIdx = playlist.value.findIndex(img => img.id === currentId)
    currentIndex.value = newIdx >= 0 ? newIdx : 0
  } else {
    currentIndex.value = 0
  }

  if (newImages.length > 0 && !timer) {
    startTimer()
  } else if (newImages.length === 0) {
    stopTimer()
  }
})

watch(config, () => {
  if (images.value.length > 0) {
    startTimer()
  }
}, { deep: true })

onMounted(async () => {
  await fetchData()
  // Iniciar polling después de la carga inicial
  pollTimer = setInterval(pollForUpdates, POLL_INTERVAL)
})

onUnmounted(() => {
  stopTimer()
  if (pollTimer) clearInterval(pollTimer)
  // Liberar memoria: revocar todos los blob URLs generados
  blobUrls.value.forEach(url => revokeBlobUrl(url))
  blobUrls.value.clear()
})
</script>

<style scoped>
.carousel-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100dvh;
  background: #000;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.carousel-image {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.no-images {
  color: #666;
  font-size: 2rem;
  text-align: center;
}

.setup-message {
  color: #666;
  text-align: center;
}

.setup-message p {
  font-size: 2rem;
  margin-bottom: 1rem;
}

.setup-message small {
  display: block;
  font-size: 1rem;
}

.error-message {
  color: #e94560;
  text-align: center;
}

.error-message p {
  font-size: 2rem;
  margin-bottom: 1rem;
}

.error-message small {
  display: block;
  color: #666;
  font-size: 1rem;
  margin-bottom: 0.5rem;
}

.brand {
  position: fixed;
  bottom: 20px;
  right: 30px;
  color: rgba(255, 255, 255, 0.3);
  font-size: 1rem;
  font-weight: 300;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity v-bind('config.transition + "ms"');
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
