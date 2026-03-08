// Fetch analyst consensus EPS forecast from East Money (东方财富) API

export interface EpsForecast {
  stockCode: string
  stockName: string
  forecasts: {
    year: number
    eps: number
    isActual: boolean // true = actual reported, false = forecast
  }[]
  analystCount: number // number of analyst organizations
}

export async function fetchEpsForecast(stockCode: string): Promise<EpsForecast | null> {
  const code = stockCode.replace(/\D/g, '')

  try {
    const url = `/api/eastmoney/api/data/v1/get?reportName=RPT_WEB_RESPREDICT&columns=SECURITY_CODE,SECURITY_NAME_ABBR,EPS1,EPS2,EPS3,EPS4,YEAR1,YEAR2,YEAR3,YEAR4,YEAR_MARK1,YEAR_MARK2,YEAR_MARK3,YEAR_MARK4,RATING_ORG_NUM&filter=(SECURITY_CODE%3D%22${code}%22)`

    const resp = await fetch(url)
    if (!resp.ok) return null

    const json = await resp.json()
    if (!json?.result?.data?.length) return null

    const row = json.result.data[0]
    const forecasts: EpsForecast['forecasts'] = []

    for (let i = 1; i <= 4; i++) {
      const eps = row[`EPS${i}`]
      const year = row[`YEAR${i}`]
      const mark = row[`YEAR_MARK${i}`]
      if (eps != null && year != null) {
        forecasts.push({
          year,
          eps: Math.round(eps * 100) / 100,
          isActual: mark === 'A',
        })
      }
    }

    return {
      stockCode: code,
      stockName: row.SECURITY_NAME_ABBR || '',
      forecasts,
      analystCount: row.RATING_ORG_NUM || 0,
    }
  } catch (e) {
    console.warn('Failed to fetch EPS forecast:', e)
    return null
  }
}
