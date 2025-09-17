import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react()],
  build: {
    
    outDir: resolve(__dirname, './dist'),
    emptyOutDir: true,
  },
  // Deployed at the site root
  base: '/',
  
  /*
  server: {
    proxy: {
      '/api': 'http://localhost:8000',
    },
  },
  */
})
