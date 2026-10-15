import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  publicDir: false,
  build: {
    outDir: '.local/build',
    rolldownOptions: {
      input: 'source.html',
      output: {entryFileNames: 'assets/app.js', chunkFileNames: 'assets/[name].js', assetFileNames: 'assets/[name][extname]'}
    }
  }
});
