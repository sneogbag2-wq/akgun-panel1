import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? '/akgun-panel1/' : '/',
  plugins: [react()],
  esbuild: {
    drop: ['console', 'debugger'],
  },
  build: {
    // Initial navigation does not need charting, spreadsheet export, Markdown, or
    // the full icon catalog. Keep these stable dependencies in cacheable chunks so
    // the application entry stays below Vite's 500 kB guidance threshold.
    rolldownOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('recharts')) return 'charts';
          if (id.includes('xlsx')) return 'spreadsheet';
          if (id.includes('react-markdown') || id.includes('remark-gfm')) return 'markdown';
          if (id.includes('lucide-react')) return 'icons';
          if (id.includes('react') || id.includes('scheduler')) return 'react-vendor';
          return undefined;
        }
      }
    }
  },
  server: {
    watch: {
      ignored: ['**/*.zip'],
    },
  },
  test: {
    // jsdom ortamı — FileReader, File gibi browser API'lerini sağlar
    environment: 'jsdom',
    globals: true,
    environmentOptions: {
      jsdom: { url: 'http://localhost' },
    },
  },
})
