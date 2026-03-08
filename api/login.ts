import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createHash } from 'crypto'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { username, password } = req.body || {}
  const expectedUser = process.env.AUTH_USERNAME
  const expectedPass = process.env.AUTH_PASSWORD

  if (!expectedUser || !expectedPass) {
    // No auth configured, allow access (demo mode)
    return res.json({ ok: true, token: 'demo' })
  }

  if (username === expectedUser && password === expectedPass) {
    // Generate a simple token: hash of credentials + a secret
    const token = createHash('sha256')
      .update(`${username}:${password}:${process.env.AUTH_USERNAME}`)
      .digest('hex')
      .slice(0, 32)
    return res.json({ ok: true, token })
  }

  return res.status(401).json({ ok: false, error: '用户名或密码错误' })
}
