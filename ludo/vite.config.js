import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

// `vite build --mode php` makes the static + PHP bundle for shared hosting (cPanel);
// the default build talks to the Node.js Socket.IO server.
export default defineConfig(({ mode }) => {
  const php = mode === 'php';
  return {
    root: 'client',
    base: './',
    publicDir: false,
    resolve: {
      alias: {
        '#transport': fileURLToPath(new URL(`client/src/transport-${php ? 'poll' : 'socket'}.js`, import.meta.url)),
      },
    },
    build: {
      outDir: php ? '../build/cpanel' : '../dist',
      emptyOutDir: true,
      chunkSizeWarningLimit: 1200,
    },
    server: {
      port: 5173,
      proxy: {
        '/socket.io': { target: 'http://localhost:3000', ws: true },
      },
    },
  };
});
