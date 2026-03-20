<template>
  <div class="carousel-container">
    <div class="background-pattern"></div>
    <div v-if="loading && images.length === 0" class="loading">
      <p>Cargando...</p>
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
        <p>No hay imágenes</p>
      </div>
    </Transition>
    
    <header class="header">
      <div class="header-logo">
        <img src="/ft-icono.png" alt="Logo" class="logo-icon">
        <span class="farm-name"><span class="farm-text">Farmacia</span> <span class="tep-text">Tepa</span></span>
      </div>
      <div class="header-right">
        <span class="material-icon location-icon">language</span>
        <span class="address">Visita: farmaciatepa.com.mx</span>
      </div>
    </header>

    <footer class="footer">
      <span class="material-icon">call</span> 378-782-1528
    </footer>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'

const API_URL = import.meta.env.VITE_API_URL || 'http://10.20.0.186:3000'

const images = ref([])
const currentIndex = ref(0)
const loading = ref(true)
const config = ref({ interval: 5000, transition: 1000 })
let timer = null

const currentImage = computed(() => images.value[currentIndex.value] || null)

const fetchData = async () => {
  try {
    const [imagesRes, configRes] = await Promise.all([
      fetch(`${API_URL}/api/images`).then(r => r.json()),
      fetch(`${API_URL}/api/config`).then(r => r.json())
    ])
    images.value = imagesRes
    config.value = configRes
    preLoadImages(imagesRes)
  } catch (e) {
    console.error('Error:', e)
  } finally {
    loading.value = false
  }
}

const preLoadImages = (imgs) => {
  imgs.forEach(img => {
    new Image().src = img.url
  })
}

const nextImage = () => {
  if (images.value.length > 0) {
    currentIndex.value = (currentIndex.value + 1) % images.value.length
  }
}

const startTimer = () => {
  stopTimer()
  if (images.value.length > 0) {
    timer = setInterval(nextImage, config.value.interval)
  }
}

const stopTimer = () => {
  if (timer) clearInterval(timer)
}

watch(images, (newImages) => {
  if (newImages.length > 0) {
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

onUnmounted(() => {
  stopTimer()
})
</script>

<style scoped>
.carousel-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: 
    linear-gradient(135deg, rgba(10, 61, 158, 0.05) 0%, rgba(255, 255, 255, 0) 50%, rgba(10, 61, 158, 0.05) 100%),
    linear-gradient(45deg, rgba(10, 61, 158, 0.03) 0%, rgba(255, 255, 255, 0) 50%, rgba(10, 61, 158, 0.03) 100%),
    radial-gradient(circle at 10% 10%, rgba(10, 61, 158, 0.08) 0%, transparent 25%),
    radial-gradient(circle at 90% 90%, rgba(10, 61, 158, 0.08) 0%, transparent 25%),
    radial-gradient(circle at 50% 50%, rgba(10, 61, 158, 0.04) 0%, transparent 50%),
    #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.background-pattern {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  opacity: 0.3;
  background-image: 
    radial-gradient(circle, rgba(10, 61, 158, 0.15) 1px, transparent 1px),
    radial-gradient(circle, rgba(10, 61, 158, 0.1) 1px, transparent 1px);
  background-size: 30px 30px, 60px 60px;
  background-position: 0 0, 15px 15px;
}

.carousel-image {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  position: relative;
  z-index: 10;
}

.no-images,
.loading {
  color: #666;
  font-size: 2rem;
  text-align: center;
}

.header {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  background: linear-gradient(135deg, #0a3d9e 0%, #1565c0 50%, #0a3d9e 100%);
  color: #fff;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 2rem;
  z-index: 100;
  box-shadow: 0 4px 15px rgba(10, 61, 158, 0.3);
}

.header-logo {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.logo-icon {
  width: 40px;
  height: 40px;
  object-fit: contain;
  border-radius: 50%;
}

.farm-name {
  font-size: 1.5rem;
  font-weight: bold;
}

.farm-text {
  color: #ff8c00;
}

.tep-text {
  color: #64b5f6;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.location-icon {
  font-size: 1.3rem;
}

.address {
  font-size: 1.3rem;
}

.footer {
  position: fixed;
  bottom: 0;
  left: 0;
  width: 100%;
  background: linear-gradient(135deg, #0a3d9e 0%, #1565c0 50%, #0a3d9e 100%);
  color: #fff;
  text-align: center;
  padding: 1rem;
  font-size: 1.2rem;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  box-shadow: 0 -4px 15px rgba(10, 61, 158, 0.3);
}

.material-icon {
  font-family: 'Material Icons';
  font-size: 1.5rem;
  vertical-align: middle;
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
