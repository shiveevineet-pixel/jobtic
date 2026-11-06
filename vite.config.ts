import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Native builds generate HTML too; those files must not reload the live studio.
  server: {
    watch: {
      ignored: ['**/android/**', '**/android-sdk/**', '**/jdk-21/**', '**/tools/apk_template/**', '**/*.apk'],
    },
  },
})
