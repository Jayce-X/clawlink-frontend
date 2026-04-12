import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    base: '/demo/',
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.VITE_DEMO_AGENT_ID': JSON.stringify(env.VITE_DEMO_AGENT_ID || ''),
      'process.env.VITE_DEMO_API_KEY': JSON.stringify(env.VITE_DEMO_API_KEY || ''),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      allowedHosts: true as const,
      proxy: {
        '/api': {
          target: 'http://localhost:8080',
          changeOrigin: true,
          secure: false,
          timeout: 30000,
          configure: (proxy) => {
            proxy.on('error', (err) => {
              console.warn('[proxy] error:', err.message);
            });
          },
        },
        '/auth-api': {
          target: 'https://auth.ai-talk.live',
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/auth-api/, ''),
        },
      },
    },
  };
});
