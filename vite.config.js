import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  // The source caches hold some 100k files: watching them stalls the dev server's first requests for minutes on Windows.
  server: { watch: { ignored: ['**/.cache/**', '**/dist/**'] } },
  build: { rolldownOptions: { input: ['index.html', 'lab.html', 'editor.html'] } }
});
