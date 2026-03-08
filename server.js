import express from 'express'
import { createProxyMiddleware } from 'http-proxy-middleware'
import { createHash } from 'crypto'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import fs from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PORT = 5173

const AUTH_USERNAME = process.env.AUTH_USERNAME || ''
const AUTH_PASSWORD = process.env.AUTH_PASSWORD || ''

const app = express()

// Login API
app.post('/api/login', express.json(), (req, res) => {
  const { username, password } = req.body || {}
  if (!AUTH_USERNAME || !AUTH_PASSWORD) {
    return res.json({ ok: true, token: 'demo' })
  }
  if (username === AUTH_USERNAME && password === AUTH_PASSWORD) {
    const token = createHash('sha256')
      .update(`${username}:${password}:${AUTH_USERNAME}`)
      .digest('hex')
      .slice(0, 32)
    return res.json({ ok: true, token })
  }
  return res.status(401).json({ ok: false, error: '用户名或密码错误' })
})

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
