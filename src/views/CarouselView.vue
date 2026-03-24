<template>
  <div class="carousel-container">
    <div v-if="!isConfigured" class="setup-message">
      <p>⚙️ Configuración requerida</p>
      <small>Añade las credenciales de Supabase en el archivo .env</small>
    </div>
    <div v-else-if="error" class="error-message">
      <p>⚠️ Error de conexión</p>
      <small>{{ error }}</small>
    </div>
    <Transition v-else name="fade" mode="out-in">
      <img 
        v-if="currentImage" 
        :key="currentImage.id" 
        :src="currentImage.url" 
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
import { supabase, isConfigured } from '../supabase'

const images = ref([])
const playlist = ref([])
const currentIndex = ref(0)
const isLoaded = ref(false)
const config = ref({ interval: 10000, transition: 1000 })
const error = ref(null)
let timer = null

const buildPlaylist = (imgs) => {
  const list = []
  imgs.forEach(img => {
    const times = img.priority ? 3 : 1
    for (let i = 0; i < times; i++) list.push(img)
  })
  return list
}

const currentImage = computed(() => playlist.value[currentIndex.value] || null)

const fetchData = async () => {
  try {
    const { data, error: fetchError } = await supabase
      .from('images')
      .select('*')
      .order('created_at', { ascending: true })
    
    if (fetchError) throw fetchError
    if (data) {
      images.value = data
      playlist.value = buildPlaylist(data)
      preLoadImages(data)
    }

    const { data: cfg } = await supabase
      .from('config')
      .select('*')
      .eq('id', 1)
      .single()
    
    if (cfg) config.value = cfg
  } catch (e) {
    console.error('Error cargando datos:', e)
    error.value = e.message
  }
}

const preLoadImages = (imgs) => {
  imgs.forEach(img => {
    const preload = new Image()
    preload.src = img.url
  })
  isLoaded.value = true
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

watch(images, (newImages) => {
  playlist.value = buildPlaylist(newImages)
  if (newImages.length > 0 && !timer) {
    startTimer()
  }
})

watch(config, () => {
  if (images.value.length > 0) {
    startTimer()
  }
}, { deep: true })

onMounted(() => {
  fetchData()
})

onUnmounted(stopTimer)
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
