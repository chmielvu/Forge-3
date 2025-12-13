import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor': ['react', 'react-dom', 'framer-motion', 'lucide-react'],
          'gemini': ['@google/genai'],
          '3d': ['three', '@react-three/fiber', '@react-three/drei'],
          'charts': ['recharts', 'd3']
        }
      }
    }
  }
});