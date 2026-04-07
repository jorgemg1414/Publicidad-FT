import { ref, onMounted } from 'vue'
import { api, isConfigured } from '../api'

export function useImages() {
  const images = ref([])
  const loading = ref(false)
  const config = ref({
    interval: 5000,
    transition: 1000
  })

  const fetchImages = async () => {
    if (!isConfigured) return
    loading.value = true
    try {
      images.value = await api.getImages()
    } catch (e) {
      console.error('Error cargando imágenes:', e)
    }
    loading.value = false
  }

  const fetchConfig = async () => {
    if (!isConfigured) return
    try {
      const data = await api.getConfig()
      if (data) config.value = data
    } catch (e) {
      console.error('Error cargando config:', e)
    }
  }

  const uploadImage = async (file) => {
    if (!isConfigured) {
      throw new Error('API no está configurada')
    }
    images.value = await api.uploadImage(file)
  }

  const togglePriority = async (id, currentValue) => {
    if (!isConfigured) return
    await api.setPriority(id, !currentValue)
    await fetchImages()
  }

  const deleteImage = async (id) => {
    if (!isConfigured) return
    images.value = await api.deleteImage(id)
  }

  const saveConfig = async () => {
    if (!isConfigured) return
    try {
      await api.saveConfig(config.value)
    } catch (e) {
      console.error('Error guardando config:', e)
    }
  }

  onMounted(() => {
    fetchImages()
    fetchConfig()
  })

  return {
    images,
    loading,
    config,
    fetchImages,
    uploadImage,
    deleteImage,
    togglePriority,
    saveConfig
  }
}
