// A-stock quote fetching via Sina Finance API (proxied through Vite dev server)

export interface QuoteResult {
  code: string
  name: string
  price: number
  change: number
  changePct: number
  open: number
  high: number
  low: number
  volume: number
  timestamp: string
}

function codeToSinaSymbol(code: string): string {
  const c = code.replace(/\D/g, '')
  if (c.startsWith('6') || c.startsWith('9')) return `sh${c}`
  if (c.startsWith('0') || c.startsWith('3') || c.startsWith('2')) return `sz${c}`
  if (c.startsWith('4') || c.startsWith('8')) return `bj${c}` // Beijing exchange
  return `sh${c}`
}

export async function fetchQuotes(codes: string[]): Promise<Record<string, number>> {
  if (codes.length === 0) return {}

  const symbols = codes.map(codeToSinaSymbol).join(',')
  const result: Record<string, number> = {}

  try {
    const resp = await fetch(`/api/sina/list=${symbols}`, {
      headers: { Referer: 'https://finance.sina.com.cn' },
    })
    const text = await resp.text()

    const lines = text.split('\n').filter(Boolean)
    for (const line of lines) {
      const match = line.match(/hq_str_(\w+)="(.+)"/)
      if (!match) continue

      const symbol = match[1]
      const rawCode = symbol.replace(/^(sh|sz|bj)/, '')
      const parts = match[2].split(',')

      if (parts.length >= 4) {
        const price = parseFloat(parts[3])
        if (!isNaN(price) && price > 0) {
          result[rawCode] = price
        }
      }
    }
  } catch (e) {
    console.warn('Failed to fetch quotes:', e)
  }

  return result
}

export async function fetchSingleQuote(code: string): Promise<number | null> {
  const result = await fetchQuotes([code])
  return result[code.replace(/\D/g, '')] ?? null
}

// --- Stock info lookup (name + industry) ---

export interface StockInfo {
  code: string
  name: string
  industry: string
}

export async function lookupStockInfo(code: string): Promise<StockInfo | null> {
  const c = code.replace(/\D/g, '')
  if (c.length !== 6) return null

  // Step 1: Get stock name from Sina API (returns GBK encoding)
  const symbol = codeToSinaSymbol(c)
  let name = ''
  try {
    const resp = await fetch(`/api/sina/list=${symbol}`, {
      headers: { Referer: 'https://finance.sina.com.cn' },
    })
    const buf = await resp.arrayBuffer()
    const text = new TextDecoder('gbk').decode(buf)
    const match = text.match(/hq_str_\w+="([^,]+)/)
    if (match && match[1]) {
      name = match[1]
    }
  } catch {}
  if (!name) return null

  // Step 2: Get industry from East Money
  let industry = ''
  try {
    const secuCode = codeToSecuCode(c)
    const resp = await fetch(
      `/api/eastmoney/api/data/v1/get?reportName=RPT_F10_BASIC_ORGINFO&columns=SECUCODE,EM2016&filter=(SECUCODE%3D%22${secuCode}%22)&pageSize=1&source=WEB&client=WEB`,
    )
    const json = await resp.json()
    if (json.success && json.result?.data?.[0]?.EM2016) {
      // EM2016 format: "食品饮料-食品-食品综合", take the top-level category
      const parts = json.result.data[0].EM2016.split('-')
      industry = parts[0] || ''
    }
  } catch {}

  return { code: c, name, industry }
}

// --- PE (TTM) fetching via East Money datacenter API ---

function codeToSecuCode(code: string): string {
  const c = code.replace(/\D/g, '')
  if (c.startsWith('6') || c.startsWith('9')) return `${c}.SH`
  if (c.startsWith('0') || c.startsWith('3') || c.startsWith('2')) return `${c}.SZ`
  if (c.startsWith('4') || c.startsWith('8')) return `${c}.BJ`
  return `${c}.SH`
}

export async function fetchPeData(codes: string[]): Promise<Record<string, number>> {
  if (codes.length === 0) return {}

  const result: Record<string, number> = {}

  // Fetch PE for each stock individually (the API filters by one stock at a time)
  // Batch them in parallel for efficiency
  const fetches = codes.map(async (code) => {
    try {
      const secuCode = codeToSecuCode(code)
      const resp = await fetch(
        `/api/eastmoney/api/data/v1/get?reportName=RPT_VALUEANALYSIS_DET&columns=SECUCODE,PE_TTM&filter=(SECUCODE%3D%22${secuCode}%22)&pageSize=1&sortColumns=TRADE_DATE&sortTypes=-1&source=WEB&client=WEB`,
      )
      const json = await resp.json()
      if (json.success && json.result?.data?.[0]) {
        const pe = json.result.data[0].PE_TTM
        if (typeof pe === 'number' && pe > 0) {
          const rawCode = code.replace(/\D/g, '')
          result[rawCode] = Math.round(pe * 100) / 100
        }
      }
    } catch {
      // Silently skip failed PE fetches
    }
  })

  await Promise.all(fetches)
  return result
}
