import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')

  // A production bundle with no API URL would build fine and then show a blank
  // page in the browser. Catch it here instead.
  if (mode === 'production' && !env.VITE_API_URL) {
    throw new Error(
      'VITE_API_URL must be set for a production build.\n' +
        'Example: VITE_API_URL="https://api.yourdomain.com/api" npm run build'
    )
  }

  return {
    plugins: [react(), tailwindcss()],

    build: {
      // The lazy route chunks are small; the libraries behind them are not.
      // Splitting the big vendors out means a return visitor re-downloads only
      // the app code that actually changed.
      rollupOptions: {
        output: {
          manualChunks: {
            react: ['react', 'react-dom', 'react-router-dom'],
            charts: ['recharts'],
          },
        },
      },
      // Sized just above the recharts vendor chunk, which is large but loads
      // only with the pages that draw charts. Anything else crossing this line
      // is an app-code regression worth looking at.
      chunkSizeWarningLimit: 450,
      sourcemap: mode !== 'production',
    },

    server: {
      port: 5173,
    },
  }
})
