import { ref, onMounted } from 'vue'
import { supabase, isConfigured } from '../supabase'

export function useImages() {
  const images = ref([])
  const loading = ref(false)
  const config = ref({
    interval: 5000,
    transition: 1000
  })

  const fetchImages = async () => {
    if (!isConfigured || !supabase) return
    loading.value = true
    const { data, error } = await supabase
      .from('images')
      .select('*')
      .order('created_at', { ascending: true })
    
    if (!error) {
      images.value = data
    }
    loading.value = false
  }

  const fetchConfig = async () => {
    if (!isConfigured || !supabase) return
    const { data } = await supabase
      .from('config')
      .select('*')
      .eq('id', 1)
      .single()
    
    if (data) {
      config.value = data
    }
  }

  const uploadImage = async (file) => {
    if (!isConfigured || !supabase) {
      throw new Error('Supabase no está configurado')
    }
    const fileExt = file.name.split('.').pop()
    const fileName = `${Date.now()}.${fileExt}`

    const { error: uploadError } = await supabase.storage
      .from('publicidad')
      .upload(fileName, file)

    if (uploadError) throw uploadError

    const { data: urlData } = supabase.storage
      .from('publicidad')
      .getPublicUrl(fileName)

    const { error: dbError } = await supabase
      .from('images')
      .insert([{ url: urlData.publicUrl, name: file.name }])

    if (dbError) throw dbError
    await fetchImages()
  }

  const togglePriority = async (id, currentValue) => {
    if (!isConfigured || !supabase) return
    await supabase
      .from('images')
      .update({ priority: !currentValue })
      .eq('id', id)
    await fetchImages()
  }

  const deleteImage = async (id, url) => {
    if (!isConfigured || !supabase) return
    const fileName = url.split('/').pop()
    
    await supabase.storage
      .from('publicidad')
      .remove([fileName])

    await supabase
      .from('images')
      .delete()
      .eq('id', id)

    await fetchImages()
  }

  const saveConfig = async () => {
    if (!isConfigured || !supabase) return
    await supabase
      .from('config')
      .upsert([{ id: 1, ...config.value }])
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
