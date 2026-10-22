import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Vite config for LinguaMate Web.
// - `base` lets the same build target GitHub Pages sub-paths or Vercel root.
// - `/api` is proxied to the local BFF during development so the browser never
//   sees the Coze token.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiTarget = env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:8787';

  return {
    plugins: [react()],
    base: env.VITE_BASE_PATH || '/',
    server: {
      port: 5173,
      strictPort: false,
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
        },
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
    },
  };
});
