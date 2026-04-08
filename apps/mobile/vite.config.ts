import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { resolve } from 'path';

export default defineConfig({
  plugins: [vue(), basicSsl()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  server: {
    host: true,
    https: {},
  },
  build: {
    outDir: 'dist',
  },
  optimizeDeps: {
    exclude: [
      '@aspect-build/capacitor-mlkit-text-recognition',
      '@capacitor-community/sqlite',
      '@capacitor/camera',
      '@capacitor/filesystem',
      '@capacitor/network',
    ],
  },
});
