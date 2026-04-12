import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/tenant-app/',
  build: {
    outDir: '../public/tenant-app',
    emptyOutDir: true,
  },
})
