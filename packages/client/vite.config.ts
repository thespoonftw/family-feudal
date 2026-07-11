import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5174,
    proxy: {
      '/socket.io': {
        target: 'http://localhost:3002',
        ws: true,
      },
      '/api': {
        target: 'http://localhost:3002',
      },
    },
  },
})
