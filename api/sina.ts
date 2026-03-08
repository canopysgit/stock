import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Extract the path after /api/sina/
  const url = req.url || ''
  const path = url.replace(/^\/api\/sina\/?/, '')
  if (!path) return res.status(400).send('Missing path')

  try {
    const resp = await fetch(`https://hq.sinajs.cn/${path}`, {
      headers: { Referer: 'https://finance.sina.com.cn' },
    })
    const buf = await resp.arrayBuffer()
    res.setHeader('Content-Type', 'text/plain; charset=gbk')
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.send(Buffer.from(buf))
  } catch (e: any) {
    res.status(500).send(e.message)
  }
}
