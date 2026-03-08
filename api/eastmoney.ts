import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Extract the path after /api/eastmoney/
  const url = req.url || ''
  const path = url.replace(/^\/api\/eastmoney\/?/, '')
  if (!path) return res.status(400).send('Missing path')

  try {
    const resp = await fetch(`https://datacenter-web.eastmoney.com/${path}`)
    const text = await resp.text()
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.send(text)
  } catch (e: any) {
    res.status(500).send(e.message)
  }
}
