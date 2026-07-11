import { createRouter, createWebHistory } from 'vue-router'
import LandingView from './views/LandingView.vue'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: LandingView },
    { path: '/play', component: () => import('./views/GameView.vue') },
    { path: '/dev', component: () => import('./views/DevView.vue') },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})
