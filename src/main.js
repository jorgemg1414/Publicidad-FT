import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import './style.css'

createApp(App).use(router).mount('#app')

// Desregistrar cualquier Service Worker previo (antes cacheábamos Supabase y
// luego Cloudinary con un SW propio, pero Cloudinary ya ofrece CDN + cache
// por headers, así que el SW agregaba complejidad sin beneficio real).
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => registration.unregister())
  })
}
