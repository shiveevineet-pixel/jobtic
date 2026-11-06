import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import ttsHandler from './api/tts'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'tts-api-server',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url && req.url.startsWith('/api/tts')) {
            void ttsHandler(req, res);
            return;
          }
          next();
        });
      },
    },
  ],
  // Native builds generate HTML too; those files must not reload the live studio.
  server: {
    watch: {
      ignored: ['**/android/**', '**/android-sdk/**', '**/jdk-21/**', '**/tools/apk_template/**', '**/*.apk'],
    },
  },
})
