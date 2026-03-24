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
          <button type="submit" class="btn-login">Ingresar</button>
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
        <section class="upload-section" :class="{ disabled: !isConfigured }">
          <h2>Subir Imágenes</h2>
          <div 
            class="dropzone"
            :class="{ dragover: isDragover, disabled: !isConfigured }"
            @dragover.prevent="isDragover = true"
            @dragleave="isDragover = false"
            @drop.prevent="handleDrop"
            @click="!isConfigured || $refs.fileInput.click()"
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
          <h2>Imágenes ({{ images.length }})</h2>
          <div v-if="loading" class="loading">Cargando...</div>
          <div v-else-if="images.length === 0" class="empty">
            No hay imágenes. Sube algunas arriba.
          </div>
          <div v-else class="images-grid">
            <div v-for="img in images" :key="img.id" class="image-card" :class="{ priority: img.priority }">
              <img :src="img.url" :alt="img.name" />
              <div class="image-info">
                <span class="image-name">{{ img.name }}</span>
                <div class="image-actions">
                  <button
                    @click="togglePriority(img.id, img.priority)"
                    class="btn-priority"
                    :class="{ active: img.priority }"
                  >{{ img.priority ? 'PREF ✓' : 'PREF' }}</button>
                  <button @click="removeImage(img)" class="btn-delete">Eliminar</button>
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
import { ref } from 'vue'
import { useImages } from '../composables/useImages'
import { isConfigured } from '../supabase'

const { images, loading, config, uploadImage, deleteImage, togglePriority, saveConfig } = useImages()
const isDragover = ref(false)
const uploadError = ref('')
const fileInput = ref(null)
const password = ref('')
const isAuthenticated = ref(false)
const loginError = ref(false)

const adminPassword = import.meta.env.VITE_ADMIN_PASSWORD || 'admin'

const login = () => {
  if (password.value === adminPassword) {
    isAuthenticated.value = true
    loginError.value = false
  } else {
    loginError.value = true
  }
}

const logout = () => {
  isAuthenticated.value = false
  password.value = ''
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

const removeImage = async (img) => {
  if (confirm('¿Eliminar esta imagen?')) {
    await deleteImage(img.id, img.url)
  }
}
</script>

<style scoped>
.admin-container {
  min-height: 100vh;
  background: #1a1a2e;
  color: #fff;
}

.login-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
}

.login-box {
  background: #16213e;
  padding: 3rem;
  border-radius: 16px;
  text-align: center;
  width: 100%;
  max-width: 400px;
}

.login-box h1 {
  margin: 0 0 0.5rem;
  font-size: 1.5rem;
}

.login-box p {
  color: #ccc;
  margin-bottom: 1.5rem;
}

.password-input {
  width: 100%;
  padding: 1rem;
  border: 1px solid #0f3460;
  border-radius: 8px;
  background: #1a1a2e;
  color: #fff;
  font-size: 1rem;
  text-align: center;
  margin-bottom: 1rem;
}

.btn-login {
  width: 100%;
  padding: 1rem;
  background: #e94560;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  cursor: pointer;
  font-weight: 500;
}

.btn-login:hover {
  background: #d63d56;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem 2rem;
  background: #16213e;
  border-bottom: 1px solid #0f3460;
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
  background: #e94560;
  color: #fff;
  padding: 0.75rem 1.5rem;
  text-decoration: none;
  border-radius: 8px;
  font-weight: 500;
}

.btn-logout {
  background: transparent;
  color: #ccc;
  padding: 0.75rem 1.5rem;
  border: 1px solid #0f3460;
  border-radius: 8px;
  cursor: pointer;
}

.main {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

section {
  background: #16213e;
  border-radius: 12px;
  padding: 1.5rem;
  margin-bottom: 2rem;
}

section h2 {
  margin: 0 0 1rem;
  font-size: 1.25rem;
  color: #e94560;
}

.dropzone {
  border: 2px dashed #0f3460;
  border-radius: 12px;
  padding: 3rem;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s;
}

.dropzone:hover,
.dropzone.dragover {
  border-color: #e94560;
  background: rgba(233, 69, 96, 0.1);
}

.dropzone.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

section.disabled {
  opacity: 0.5;
  pointer-events: none;
}

.dropzone-content .icon {
  font-size: 3rem;
  display: block;
  margin-bottom: 1rem;
}

.dropzone-content p {
  margin: 0;
  color: #ccc;
}

.dropzone-content small {
  color: #666;
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
  color: #ccc;
  font-size: 0.9rem;
}

.config-item input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #0f3460;
  border-radius: 8px;
  background: #1a1a2e;
  color: #fff;
  font-size: 1rem;
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
  background: #1a1a2e;
  border-radius: 8px;
  overflow: hidden;
}

.image-card img {
  width: 100%;
  height: 150px;
  object-fit: cover;
}

.image-info {
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.image-actions {
  display: flex;
  gap: 0.4rem;
}

.image-name {
  font-size: 0.85rem;
  color: #ccc;
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
}

.btn-priority {
  background: #2a2a50;
  color: #bbb;
  border: 1px solid #666;
  padding: 0.4rem 0.6rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.75rem;
  font-weight: 600;
  transition: all 0.2s;
}

.btn-priority:hover {
  color: #f5c518;
  border-color: #f5c518;
}

.btn-priority.active {
  color: #f5c518;
  border-color: #f5c518;
  background: rgba(245, 197, 24, 0.1);
}

.image-card.priority {
  box-shadow: 0 0 0 2px #f5c518;
}
</style>
