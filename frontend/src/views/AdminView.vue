<template>
  <div class="admin-container">
    <div v-if="!isAuthenticated" class="login-container">
      <div class="login-box">
        <h1>Panel de Publicidad</h1>
        <p>Ingresa la contraseña para continuar</p>
        <form @submit.prevent="login">
          <input 
            type="password" 
            v-model="password" 
            placeholder="Contraseña"
            class="password-input"
          />
          <p v-if="loginError" class="error">Contraseña incorrecta</p>
          <button type="submit" class="btn-login" :disabled="loading">
            {{ loading ? 'Cargando...' : 'Ingresar' }}
          </button>
        </form>
      </div>
    </div>

    <template v-else>
      <header class="header">
        <h1>Panel de Publicidad</h1>
        <div class="header-actions">
          <router-link to="/" class="btn-preview">Ver Carrusel</router-link>
          <button @click="logout" class="btn-logout">Cerrar sesión</button>
        </div>
      </header>

      <main class="main">
        <section class="upload-section">
          <h2>Subir Imágenes</h2>
          <div 
            class="dropzone"
            :class="{ dragover: isDragover }"
            @dragover.prevent="isDragover = true"
            @dragleave="isDragover = false"
            @drop.prevent="handleDrop"
            @click="$refs.fileInput.click()"
          >
            <input 
              ref="fileInput" 
              type="file" 
              accept="image/*" 
              multiple 
              @change="handleFileSelect"
              hidden
            />
            <div class="dropzone-content">
              <span class="icon">📁</span>
              <p>Arrastra imágenes aquí o haz clic para seleccionar</p>
              <small>JPG, PNG, WEBP - Máx 10MB</small>
            </div>
          </div>
          <p v-if="uploadError" class="error">{{ uploadError }}</p>
        </section>

        <section class="config-section">
          <h2>Configuración</h2>
          <div class="config-grid">
            <div class="config-item">
              <label>Tiempo por imagen (milisegundos)</label>
              <input 
                type="number" 
                v-model.number="config.interval" 
                min="1000"
                step="1000"
                @change="saveConfig"
              />
            </div>
            <div class="config-item">
              <label>Transición (milisegundos)</label>
              <input 
                type="number" 
                v-model.number="config.transition" 
                min="100"
                step="100"
                @change="saveConfig"
              />
            </div>
          </div>
        </section>

        <section class="images-section">
          <div class="images-header">
            <h2>Imágenes ({{ images.length }})</h2>
            <button v-if="images.length > 0" @click="confirmDeleteAll" class="btn-delete-all">
              {{ deletingAll ? '¿Seguro? ✓' : 'Eliminar todas' }}
            </button>
          </div>
          <div v-if="loading && images.length === 0" class="loading">Cargando...</div>
          <div v-else-if="images.length === 0" class="empty">
            No hay imágenes. Sube algunas arriba.
          </div>
          <div v-else class="images-grid">
            <div v-for="img in images" :key="img.id" class="image-card">
              <img :src="img.url" :alt="img.name" />
              <div class="image-info">
                <span class="image-name">{{ img.name }}</span>
                <button v-if="confirmingDelete !== img.id" @click="confirmingDelete = img.id" class="btn-delete">Eliminar</button>
                <div v-else class="confirm-buttons">
                  <button @click="confirmingDelete = null" class="btn-cancel-delete">✕</button>
                  <button @click="deleteImage(img.id, img.url); confirmingDelete = null" class="btn-confirm-delete">✓</button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </template>

  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const API_URL = import.meta.env.VITE_API_URL || 'http://10.20.0.186:3000'

const images = ref([])
const loading = ref(false)
const config = ref({ interval: 5000, transition: 1000 })
const isDragover = ref(false)
const uploadError = ref('')
const fileInput = ref(null)
const password = ref('')
const isAuthenticated = ref(false)
const loginError = ref(false)
const token = ref(localStorage.getItem('adminToken') || '')
const confirmingDelete = ref(null)
const deletingAll = ref(false)

const login = async () => {
  loading.value = true
  loginError.value = false
  try {
    const res = await fetch(`${API_URL}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: password.value })
    })
    if (!res.ok) throw new Error('Contraseña incorrecta')
    const data = await res.json()
    token.value = data.token
    localStorage.setItem('adminToken', data.token)
    isAuthenticated.value = true
  } catch (e) {
    loginError.value = true
  }
  loading.value = false
}

const logout = () => {
  token.value = ''
  localStorage.removeItem('adminToken')
  isAuthenticated.value = false
  password.value = ''
}

const fetchImages = async () => {
  loading.value = true
  try {
    images.value = await fetch(`${API_URL}/api/images`).then(r => r.json())
  } catch (e) {
    console.error('Error:', e)
  }
  loading.value = false
}

const fetchConfig = async () => {
  try {
    const data = await fetch(`${API_URL}/api/config`).then(r => r.json())
    config.value = data
  } catch (e) {
    console.error('Error:', e)
  }
}

const saveConfig = async () => {
  try {
    await fetch(`${API_URL}/api/config`, {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token.value}`
      },
      body: JSON.stringify(config.value)
    })
  } catch (e) {
    console.error('Error:', e)
  }
}

const uploadImage = async (file) => {
  const formData = new FormData()
  formData.append('image', file)
  
  const result = await fetch(`${API_URL}/api/images`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token.value}` },
    body: formData
  })
  
  if (!result.ok) throw new Error('Error al subir')
  images.value = await result.json()
}

const deleteImage = async (id, url) => {
  try {
    const result = await fetch(`${API_URL}/api/images/${id}`, {
      method: 'DELETE',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token.value}`
      },
      body: JSON.stringify({ url })
    })
    
    if (!result.ok) {
      const err = await result.json()
      alert('Error: ' + (err.error || 'Error al eliminar'))
      return
    }
    images.value = await result.json()
  } catch (e) {
    alert('Error: ' + e.message)
  }
}

const handleFiles = async (files) => {
  uploadError.value = ''
  for (const file of files) {
    if (!file.type.startsWith('image/')) {
      uploadError.value = 'Solo se permiten imágenes'
      continue
    }
    if (file.size > 10 * 1024 * 1024) {
      uploadError.value = 'El archivo es demasiado grande (máx 10MB)'
      continue
    }
    try {
      await uploadImage(file)
    } catch (e) {
      uploadError.value = 'Error al subir: ' + e.message
    }
  }
}

const handleDrop = (e) => {
  isDragover.value = false
  handleFiles(e.dataTransfer.files)
}

const handleFileSelect = (e) => {
  handleFiles(e.target.files)
}

const confirmDeleteAll = async () => {
  if (deletingAll.value) {
    await deleteAllImages()
    deletingAll.value = false
  } else {
    deletingAll.value = true
  }
}

const deleteAllImages = async () => {
  try {
    const result = await fetch(`${API_URL}/api/images`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token.value}` }
    })
    if (!result.ok) {
      const err = await result.json()
      alert('Error: ' + (err.error || 'Error al eliminar'))
      return
    }
    images.value = await result.json()
  } catch (e) {
    alert('Error: ' + e.message)
  }
}



onMounted(() => {
  if (token.value) {
    isAuthenticated.value = true
  }
  fetchImages()
  fetchConfig()
})
</script>

<style scoped>
.admin-container {
  min-height: 100vh;
  background: #f0f4f8;
  color: #1a1a2e;
}

.login-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
}

.login-box {
  background: #fff;
  padding: 3rem;
  border-radius: 16px;
  text-align: center;
  width: 100%;
  max-width: 400px;
  box-shadow: 0 4px 20px rgba(10, 61, 158, 0.15);
}

.login-box h1 {
  margin: 0 0 0.5rem;
  font-size: 1.5rem;
  color: #0a3d9e;
}

.login-box p {
  color: #666;
  margin-bottom: 1.5rem;
}

.password-input {
  width: 100%;
  padding: 1rem;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  background: #f8f9fa;
  color: #1a1a2e;
  font-size: 1rem;
  text-align: center;
  margin-bottom: 1rem;
  transition: border-color 0.3s;
}

.password-input:focus {
  outline: none;
  border-color: #0a3d9e;
}

.btn-login {
  width: 100%;
  padding: 1rem;
  background: linear-gradient(135deg, #0a3d9e 0%, #1565c0 100%);
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  cursor: pointer;
  font-weight: 500;
  transition: transform 0.2s, box-shadow 0.2s;
}

.btn-login:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 15px rgba(10, 61, 158, 0.4);
}

.btn-login:disabled {
  background: #ccc;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem 2rem;
  background: linear-gradient(135deg, #0a3d9e 0%, #1565c0 100%);
  color: #fff;
  box-shadow: 0 4px 15px rgba(10, 61, 158, 0.3);
}

.header h1 {
  margin: 0;
  font-size: 1.5rem;
}

.header-actions {
  display: flex;
  gap: 1rem;
}

.btn-preview {
  background: #fff;
  color: #0a3d9e;
  padding: 0.75rem 1.5rem;
  text-decoration: none;
  border-radius: 8px;
  font-weight: 500;
  transition: background 0.3s;
}

.btn-preview:hover {
  background: #e8f0fe;
}

.btn-logout {
  background: transparent;
  color: #fff;
  padding: 0.75rem 1.5rem;
  border: 1px solid rgba(255, 255, 255, 0.5);
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.3s;
}

.btn-logout:hover {
  background: rgba(255, 255, 255, 0.1);
}

.main {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

section {
  background: #fff;
  border-radius: 12px;
  padding: 1.5rem;
  margin-bottom: 2rem;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.08);
}

section h2 {
  margin: 0;
  font-size: 1.25rem;
  color: #0a3d9e;
}

.images-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.btn-delete-all {
  background: #e94560;
  color: #fff;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: background 0.3s;
}

.btn-delete-all:hover {
  background: #d63d56;
}

.dropzone {
  border: 2px dashed #0a3d9e;
  border-radius: 12px;
  padding: 3rem;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s;
}

.dropzone:hover,
.dropzone.dragover {
  border-color: #1565c0;
  background: rgba(10, 61, 158, 0.05);
}

.dropzone-content .icon {
  font-size: 3rem;
  display: block;
  margin-bottom: 1rem;
}

.dropzone-content p {
  margin: 0;
  color: #666;
}

.dropzone-content small {
  color: #999;
}

.error {
  color: #e94560;
  margin-top: 1rem;
}

.config-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

.config-item label {
  display: block;
  margin-bottom: 0.5rem;
  color: #666;
  font-size: 0.9rem;
}

.config-item input {
  width: 100%;
  padding: 0.75rem;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  background: #f8f9fa;
  color: #1a1a2e;
  font-size: 1rem;
  transition: border-color 0.3s;
}

.config-item input:focus {
  outline: none;
  border-color: #0a3d9e;
}

.loading,
.empty {
  text-align: center;
  padding: 3rem;
  color: #666;
}

.images-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1rem;
}

.image-card {
  background: #fff;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transition: transform 0.2s, box-shadow 0.2s;
}

.image-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.15);
}

.image-card img {
  width: 100%;
  height: 150px;
  object-fit: cover;
}

.image-info {
  padding: 0.75rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #f8f9fa;
}

.image-name {
  font-size: 0.85rem;
  color: #666;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 120px;
}

.btn-delete {
  background: #e94560;
  color: #fff;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.85rem;
  transition: background 0.3s;
}

.btn-delete:hover {
  background: #d63d56;
}

.confirm-buttons {
  display: flex;
  gap: 0.5rem;
}

.btn-confirm-delete {
  background: #2ecc71;
  color: #fff;
  border: none;
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
}

.btn-cancel-delete {
  background: #999;
  color: #fff;
  border: none;
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
}
</style>


