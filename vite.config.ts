import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Default base is './' so asset paths are relative (required for VS Code webview).
// Override for GitHub Pages: VITE_BASE=/sysml-v2-visualizer/ npm run build
export default defineConfig({
  plugins: [react()],
  base: process.env['VITE_BASE'] ?? './',
})
