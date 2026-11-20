import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Two pages: the app (index.html, plain CSS) and the resume editor (resume-editor.html, Tailwind, kept exactly as designed).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { proxy: { '/api': 'http://localhost:3000' } },
  build: { chunkSizeWarningLimit: 1500, rollupOptions: { input: { main: 'index.html', resumeEditor: 'resume-editor.html' } } },
});
