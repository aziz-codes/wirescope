import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

// The playground imports wirescope straight from ../src, so edits hot-reload.
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { wirescope: fileURLToPath(new URL('../src/index.ts', import.meta.url)) },
  },
  server: { port: 5199, host: true },
  preview: { port: 5199, host: true },
})
