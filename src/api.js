const API_URL = import.meta.env.VITE_API_URL || ''

export const isConfigured = !!API_URL

const TOKEN_KEY = 'publicidad_admin_token'

export const getToken = () => localStorage.getItem(TOKEN_KEY)
export const setToken = (token) => localStorage.setItem(TOKEN_KEY, token)
export const clearToken = () => localStorage.removeItem(TOKEN_KEY)

const authHeaders = () => {
  const token = getToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

const handle = async (res) => {
  if (!res.ok) {
    let msg = `HTTP ${res.status}`
    try {
      const j = await res.json()
      if (j.error) msg = j.error
    } catch {}
    throw new Error(msg)
  }
  return res.json()
}

export const api = {
  async login(password) {
    const res = await fetch(`${API_URL}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    })
    return handle(res)
  },

  async getImages() {
    const res = await fetch(`${API_URL}/api/images`)
    return handle(res)
  },

  async getConfig() {
    const res = await fetch(`${API_URL}/api/config`)
    return handle(res)
  },

  async uploadImage(file) {
    const formData = new FormData()
    formData.append('image', file)
    const res = await fetch(`${API_URL}/api/images`, {
      method: 'POST',
      headers: { ...authHeaders() },
      body: formData
    })
    return handle(res)
  },

  async deleteImage(id) {
    const res = await fetch(`${API_URL}/api/images/${id}`, {
      method: 'DELETE',
      headers: { ...authHeaders() }
    })
    return handle(res)
  },

  async setPriority(id, priority) {
    const res = await fetch(`${API_URL}/api/images/${id}/priority`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders()
      },
      body: JSON.stringify({ priority })
    })
    return handle(res)
  },

  async saveConfig(config) {
    const res = await fetch(`${API_URL}/api/config`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders()
      },
      body: JSON.stringify(config)
    })
    return handle(res)
  }
}
