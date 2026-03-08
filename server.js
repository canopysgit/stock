import express from 'express'
import { createProxyMiddleware } from 'http-proxy-middleware'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import fs from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PORT = 5173

const app = express()

// Proxy Sina Finance API
app.use('/api/sina', createProxyMiddleware({
  target: 'https://hq.sinajs.cn',
  changeOrigin: true,
  pathRewrite: { '^/api/sina': '' },
  headers: { Referer: 'https://finance.sina.com.cn' },
}))

// Proxy East Money API (EPS forecasts + PE data)
app.use('/api/eastmoney', createProxyMiddleware({
  target: 'https://datacenter-web.eastmoney.com',
  changeOrigin: true,
  pathRewrite: { '^/api/eastmoney': '' },
}))

// Serve static files from dist with CORS headers
app.use(express.static(join(__dirname, 'dist'), {
  setHeaders: (res) => {
    res.setHeader('Access-Control-Allow-Origin', '*')
  }
}))

// SPA fallback - serve index.html for all non-file routes
app.use((req, res, next) => {
  if (req.method !== 'GET') return next()
  const indexPath = join(__dirname, 'dist', 'index.html')
  // Remove crossorigin attributes that break proxy CORS
  let html = fs.readFileSync(indexPath, 'utf-8')
  html = html.replace(/ crossorigin/g, '')
  res.setHeader('Content-Type', 'text/html')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.send(html)
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`StockPilot server running at http://localhost:${PORT}`)
})
