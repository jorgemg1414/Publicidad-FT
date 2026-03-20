import { createRouter, createWebHistory } from 'vue-router'
import CarouselView from '../views/CarouselView.vue'
import AdminView from '../views/AdminView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'carousel',
      component: CarouselView
    },
    {
      path: '/admin',
      name: 'admin',
      component: AdminView
    }
  ]
})

export default router
