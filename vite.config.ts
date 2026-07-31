import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: ['src/**/*.{ts,tsx,vue}'],
      exclude: ['src/**/*.{test,spec}.{ts,tsx}', 'src/types/**'],
    },
  },
  build: {
    // Disable source maps in production to prevent source code exposure
    sourcemap: false,
    
    // Increase chunk size warning limit (optional, but helps with large deps like Firebase)
    chunkSizeWarningLimit: 600,
    
    rollupOptions: {
      output: {
        // Manual chunks for better code splitting
        manualChunks: {
          // Separate Vue and Vue Flow into their own chunks
          'vue-vendor': ['vue'],
          'vue-flow': [
            '@vue-flow/core',
            '@vue-flow/background',
            '@vue-flow/controls',
            '@vue-flow/minimap'
          ],
          // Firebase gets its own chunk (it's large)
          'firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore'],
          // UI libraries
          'ui-libs': ['@phosphor-icons/vue', 'marked', 'dompurify'],
          // Utilities
          'utils': ['uuid']
        },
        // Optimize chunk file names
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      }
    },
    
    // Enable minification
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // Remove console logs in production
        drop_debugger: true,
        pure_funcs: ['console.debug'] // Remove console.debug
      }
    }
  },
  
  // Optimize dependencies
  optimizeDeps: {
    include: [
      'vue',
      '@vue-flow/core',
      '@vue-flow/background',
      '@vue-flow/controls',
      '@vue-flow/minimap',
      'firebase/app',
      'firebase/auth',
      'firebase/firestore',
      '@phosphor-icons/vue',
      'marked',
      'dompurify',
      'uuid'
    ]
  }
})
