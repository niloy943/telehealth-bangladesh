import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: '../frontend',
    emptyOutDir: true,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-motion': ['framer-motion'],
          'vendor-icons': ['lucide-react']
        }
      }
    }
  },
  server: {
    port: 3000,
    host: '0.0.0.0',
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        secure: false,
      },
      '/ep-api': {
        target: 'http://127.0.0.1:5002',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/ep-api/, ''),
      },
      '/ws': {
        target: 'ws://127.0.0.1:8000',
        ws: true,
      }
    }
  }
});
