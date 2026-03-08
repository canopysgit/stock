import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Plugin to fix HTML for proxy compatibility:
// 1. Remove crossorigin attributes (breaks CORS through proxy)
// 2. Change type="module" to regular script (ES modules enforce CORS)
function proxyCompatible() {
  return {
    name: 'proxy-compatible',
    enforce: 'post' as const,
    transformIndexHtml(html: string) {
      return html
        .replace(/ crossorigin/g, '')
        .replace('<script type="module" ', '<script defer ')
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), proxyCompatible()],
  build: {
    modulePreload: false,
    rollupOptions: {
      output: {
        format: 'iife',
        inlineDynamicImports: true,
      },
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: true,
    proxy: {
      '/api/sina': {
        target: 'https://hq.sinajs.cn',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/sina/, ''),
        headers: {
          Referer: 'https://finance.sina.com.cn',
        },
      },
      '/api/eastmoney': {
        target: 'https://datacenter-web.eastmoney.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/eastmoney/, ''),
      },
    },
  },
})
