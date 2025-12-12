import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@features': path.resolve(__dirname, './src/features'),
      '@shared': path.resolve(__dirname, './src/shared'),
      '@assets': path.resolve(__dirname, './src/assets'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Split heavy 3D libraries into separate chunk
          'three': ['three', '@react-three/fiber', '@react-three/drei', '@react-three/postprocessing'],
          // Split charting library (commented out - not currently used)
          // 'recharts': ['recharts'],
          // Split animation libraries (commented out - check if used)
          // 'animations': ['framer-motion', 'gsap'],
          // Split React vendors
          'react-vendor': ['react', 'react-dom'],
        },
      },
    },
    // Increase chunk size warning limit to 200KB to match target
    chunkSizeWarningLimit: 200,
  },
})
