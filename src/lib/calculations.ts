import type {
  Stock, Trade, StockTier, ValuationPrices, ValuationComparison,
  LotInfo, PositionSummary, ClearedSummary, PortfolioStats, CashFlow,
  OtherAsset, GoldSummary, EtfSummary, AssetOverviewSummary,
} from '../types'

// --- Tier target percentages ---
export const TIER_PCT: Record<StockTier, number> = {
  core: 15,
  high: 10,
  mid: 6,
  low: 3,
}

// --- Valuation model ---
export function calcValuationPrices(eps: number, peHigh: number, peMid: number, peLow: number): ValuationPrices {
  const calc = (pe: number) => {
    const p1 = eps * pe
    const p2 = p1 / 1.2
    const p3 = p2 - (p1 - p2) / 2
    return { p1: round2(p1), p2: round2(p2), p3: round2(p3) }
  }
  return { high: calc(peHigh), mid: calc(peMid), low: calc(peLow) }
}

export function calcValuationComparisons(
  prices: ValuationPrices,
  currentPrice: number,
): ValuationComparison[][] {
  const labels = ['高估', '中估', '低估'] as const
  const keys = ['high', 'mid', 'low'] as const
  const tierLabels = ['合理价', '打折价', '低吸价']

  return keys.map((key, i) => {
    const tier = prices[key]
    return [tier.p1, tier.p2, tier.p3].map((price, j) => ({
      price,
      diff: currentPrice === 0 ? 0 : round2(((price - currentPrice) / currentPrice) * 100),
      label: `${labels[i]}${tierLabels[j]}`,
    }))
  })
}

// --- FIFO lot matching ---
interface InternalLot {
  tradeId: string
  buyDate: string
  buyPrice: number       // original purchase price, never modified
  costAdjustment: number // per-share cost delta from dividend/split trades only
  originalQty: number
  remainingQty: number
}

export function computeLots(trades: Trade[]): {
  openLots: InternalLot[]
  realizedPnl: { buyTradeId: string; buyPrice: number; sellPrice: number; sellDate: string; qty: number }[]
  costAdjustment: number // total cost offset from adjust trades (position-level only, not per-lot)
  totalDividend: number  // cumulative dividend income for this position
} {
  const sorted = [...trades].sort((a, b) => {
    const d = a.tradeDate.localeCompare(b.tradeDate)
    if (d !== 0) return d
    return a.createdAt.localeCompare(b.createdAt)
  })

  const openLots: InternalLot[] = []
  const realizedPnl: { buyTradeId: string; buyPrice: number; sellPrice: number; sellDate: string; qty: number }[] = []
  let costAdjustment = 0
  let totalDividend = 0

  for (const trade of sorted) {
    if (trade.type === 'buy') {
      openLots.push({
        tradeId: trade.id,
        buyDate: trade.tradeDate,
        buyPrice: trade.price,
        costAdjustment: 0,
        originalQty: trade.quantity,
        remainingQty: trade.quantity,
      })
    } else if (trade.type === 'sell') {
      let qtyToSell = trade.quantity
      for (const lot of openLots) {
        if (qtyToSell <= 0) break
        if (lot.remainingQty <= 0) continue
        const matched = Math.min(lot.remainingQty, qtyToSell)
        lot.remainingQty -= matched
        qtyToSell -= matched
        realizedPnl.push({
          buyTradeId: lot.tradeId,
          buyPrice: lot.buyPrice + lot.costAdjustment,
          sellPrice: trade.price,
          sellDate: trade.tradeDate,
          qty: matched,
        })
      }
    } else if (trade.type === 'adjust') {
      // Adjust is a position-level cost correction, does not touch per-lot display
      costAdjustment += trade.price * openLots.reduce((s, l) => s + l.remainingQty, 0)
    } else if (trade.type === 'dividend') {
      // Dividend is a per-lot event: each lot's cost is reduced by per-share dividend
      const openQty = openLots.reduce((s, l) => s + l.remainingQty, 0)
      totalDividend += trade.price * openQty
      for (const lot of openLots) {
        lot.costAdjustment -= trade.price
      }
    } else if (trade.type === 'split') {
      // Split: scale quantities and both buyPrice and costAdjustment
      const ratio = trade.price
      if (ratio > 0) {
        for (const lot of openLots) {
          lot.originalQty = Math.round(lot.originalQty * ratio)
          lot.remainingQty = Math.round(lot.remainingQty * ratio)
          lot.buyPrice = lot.buyPrice / ratio
          lot.costAdjustment = lot.costAdjustment / ratio
        }
      }
    }
  }

  return { openLots: openLots.filter((l) => l.remainingQty > 0), realizedPnl, costAdjustment, totalDividend }
}

// --- Position summary ---
export function computePositionSummary(
  stock: Stock,
  trades: Trade[],
  marketPrice: number,
  totalCapital: number,
): PositionSummary {
  const stockTrades = trades.filter((t) => t.stockId === stock.id)
  const { openLots, realizedPnl: realizedPnlRaw, costAdjustment, totalDividend } = computeLots(stockTrades)

  const totalQty = openLots.reduce((s, l) => s + l.remainingQty, 0)
  const rawLotCost = openLots.reduce((s, l) => s + l.remainingQty * l.buyPrice, 0)
  // totalCost = raw cost + position-level adjust - dividends (for position-level accounting)
  const totalCost = rawLotCost + costAdjustment - totalDividend
  const avgCost = totalQty > 0 ? totalCost / totalQty : 0
  const marketValue = totalQty * marketPrice
  const positionPct = totalCapital > 0 ? (marketValue / totalCapital) * 100 : 0
  const targetPct = TIER_PCT[stock.tier]
  const adjustPct = targetPct - positionPct
  const adjustAmount = (adjustPct / 100) * totalCapital

  const buyTrades = stockTrades.filter((t) => t.type === 'buy').sort((a, b) => b.tradeDate.localeCompare(a.tradeDate))
  const lastBuyDate = buyTrades.length > 0 ? buyTrades[0].tradeDate : null
  const buyPrices = buyTrades.map((t) => t.price)

  const realizedPnl = realizedPnlRaw.reduce((s, r) => s + (r.sellPrice - r.buyPrice) * r.qty, 0)

  // Per-lot PnL: adjustedBuyPrice = buyPrice + per-lot cost adjustments (dividend/split only, no adjust)
  const lots: LotInfo[] = openLots.map((l) => {
    const adjustedBuyPrice = round3(l.buyPrice + l.costAdjustment)
    return {
      tradeId: l.tradeId,
      buyDate: l.buyDate,
      buyPrice: l.buyPrice,
      adjustedBuyPrice,
      originalQty: l.originalQty,
      remainingQty: l.remainingQty,
      floatingPnl: (marketPrice - adjustedBuyPrice) * l.remainingQty,
      floatingPnlPct: adjustedBuyPrice > 0 ? ((marketPrice - adjustedBuyPrice) / adjustedBuyPrice) * 100 : 0,
    }
  })

  // floatingPnl = sum of lot PnL (real per-lot returns, no adjust)
  const floatingPnl = lots.reduce((s, l) => s + l.floatingPnl, 0)
  const floatingPnlPct = rawLotCost > 0 ? (floatingPnl / rawLotCost) * 100 : 0
  // positionFloatingPnl = marketValue - totalCost (includes adjust, matches software)
  const positionFloatingPnl = marketValue - totalCost
  const positionFloatingPnlPct = totalCost > 0 ? (positionFloatingPnl / totalCost) * 100 : 0

  return {
    stock,
    totalQty,
    avgCost: round3(avgCost),
    totalCost: round2(totalCost),
    costAdjustment: round2(costAdjustment),
    totalDividend: round2(totalDividend),
    realizedPnl: round2(realizedPnl),
    marketPrice,
    marketValue: round2(marketValue),
    floatingPnl: round2(floatingPnl),
    floatingPnlPct: round2(floatingPnlPct),
    positionFloatingPnl: round2(positionFloatingPnl),
    positionFloatingPnlPct: round2(positionFloatingPnlPct),
    positionPct: round2(positionPct),
    targetPct,
    adjustPct: round2(adjustPct),
    adjustAmount: round2(adjustAmount),
    lastBuyDate,
    lots,
    buyPrices,
  }
}

// --- Portfolio stats ---
export function computePortfolioStats(
  stocks: Stock[],
  trades: Trade[],
  prices: Record<string, number>,
  cashBalance: number,
): PortfolioStats {
  const holdingStocks = stocks.filter((s) => s.status === 'holding')

  // First pass: compute market values to get total capital
  const rawPositions = holdingStocks.map((stock) => {
    const stockTrades = trades.filter((t) => t.stockId === stock.id)
    const { openLots } = computeLots(stockTrades)
    const totalQty = openLots.reduce((s, l) => s + l.remainingQty, 0)
    const marketPrice = prices[stock.code] || 0
    return { stock, totalQty, marketPrice, marketValue: totalQty * marketPrice }
  }).filter((p) => p.totalQty > 0)

  const totalMarketValue = rawPositions.reduce((s, p) => s + p.marketValue, 0)
  const totalCapital = totalMarketValue + cashBalance

  // Second pass: compute full summaries with correct totalCapital
  const positions = rawPositions.map((p) =>
    computePositionSummary(p.stock, trades, p.marketPrice, totalCapital),
  )

  const totalCost = positions.reduce((s, p) => s + p.totalCost, 0)
  const totalPnl = positions.reduce((s, p) => s + p.positionFloatingPnl, 0)
  const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0

  return {
    totalMarketValue: round2(totalMarketValue),
    totalCost: round2(totalCost),
    totalPnl: round2(totalPnl),
    totalPnlPct: round2(totalPnlPct),
    totalCapital: round2(totalCapital),
    holdingCount: positions.length,
    positions,
  }
}

// --- Cleared summaries ---
export function computeClearedSummaries(
  stocks: Stock[],
  trades: Trade[],
): ClearedSummary[] {
  return stocks
    .filter((s) => s.status === 'cleared')
    .map((stock) => {
      const stockTrades = [...trades.filter((t) => t.stockId === stock.id)]
        .sort((a, b) => a.tradeDate.localeCompare(b.tradeDate))

      const buyTrades = stockTrades.filter((t) => t.type === 'buy')
      const sellTrades = stockTrades.filter((t) => t.type === 'sell')

      const firstBuyDate = buyTrades[0]?.tradeDate || ''
      const lastSellDate = sellTrades[sellTrades.length - 1]?.tradeDate || ''

      const holdingDays = firstBuyDate && lastSellDate
        ? Math.max(1, daysBetween(firstBuyDate, lastSellDate))
        : 0

      const totalInvested = buyTrades.reduce((s, t) => s + t.price * t.quantity, 0)
      const totalReceived = sellTrades.reduce((s, t) => s + t.price * t.quantity, 0)
      const pnlAmount = totalReceived - totalInvested
      const pnlPct = totalInvested > 0 ? (pnlAmount / totalInvested) * 100 : 0
      const annualizedPnlPct = holdingDays > 0 ? (pnlPct / holdingDays) * 365 : 0

      return {
        stock,
        tradeCount: stockTrades.length,
        firstBuyDate,
        lastSellDate,
        holdingDays,
        totalInvested: round2(totalInvested),
        totalReceived: round2(totalReceived),
        pnlAmount: round2(pnlAmount),
        pnlPct: round2(pnlPct),
        annualizedPnlPct: round2(annualizedPnlPct),
        trades: stockTrades,
      }
    })
}

// --- Cash balance from flows ---
export function computeCashBalance(cashFlows: CashFlow[]): number {
  return round2(cashFlows.reduce((sum, f) => sum + f.amount, 0))
}

// --- Helpers ---
function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000
}

function daysBetween(a: string, b: string): number {
  const da = new Date(a)
  const db = new Date(b)
  return Math.round((db.getTime() - da.getTime()) / (1000 * 60 * 60 * 24))
}

// --- Gold summary ---
export function computeGoldSummary(trades: OtherAsset[]): GoldSummary {
  const totalGrams = trades.reduce((s, t) => s + t.quantity, 0)
  const totalCost = trades.reduce((s, t) => s + t.totalCost, 0)
  const avgCostPerGram = totalGrams > 0 ? totalCost / totalGrams : 0
  return { totalGrams, avgCostPerGram: round3(avgCostPerGram), totalCost: round2(totalCost), trades }
}

// --- ETF summary ---
export function computeEtfSummary(etfs: OtherAsset[]): EtfSummary[] {
  const grouped = new Map<string, { code: string; name: string; totalShares: number; totalCost: number }>()
  for (const e of etfs) {
    const key = e.code || e.name
    const existing = grouped.get(key)
    if (existing) {
      existing.totalShares += e.quantity
      existing.totalCost += e.totalCost
    } else {
      grouped.set(key, {
        code: e.code || '',
        name: e.name,
        totalShares: e.quantity,
        totalCost: e.totalCost,
      })
    }
  }
  return Array.from(grouped.values()).map((g) => ({
    ...g,
    avgCostPerShare: g.totalShares > 0 ? round3(g.totalCost / g.totalShares) : 0,
    totalCost: round2(g.totalCost),
  }))
}

// --- Asset overview ---
export function computeAssetOverview(
  portfolioStats: PortfolioStats,
  otherAssets: OtherAsset[],
  goldPricePerGram: number,
  etfNavs: Record<string, number>,
  cashBalance: number,
): AssetOverviewSummary {
  const stockMarketValue = portfolioStats.totalMarketValue
  const stockPnl = portfolioStats.totalPnl

  const goldAssets = otherAssets.filter((a) => a.assetType === 'gold')
  const goldSummary = computeGoldSummary(goldAssets)
  // CMB gold account: sell price = mid price - 9.2 (includes spread 2.5 + FX markup ~6.7)
  const goldSellPrice = goldPricePerGram - 9.2
  const goldValue = round2(goldSummary.totalGrams * goldSellPrice)
  const goldPnl = round2(goldValue - goldSummary.totalCost)

  const etfAssets = otherAssets.filter((a) => a.assetType === 'fund')
  const etfSummary = computeEtfSummary(etfAssets)
  let etfValue = 0
  let etfCost = 0
  for (const e of etfSummary) {
    const nav = etfNavs[e.code] || 0
    etfValue += e.totalShares * nav
    etfCost += e.totalCost
  }
  etfValue = round2(etfValue)
  etfCost = round2(etfCost)
  const etfPnl = round2(etfValue - etfCost)

  const depositAssets = otherAssets.filter((a) => a.assetType === 'deposit')
  const depositAmount = depositAssets.reduce((s, a) => s + a.quantity, 0)

  const totalAssets = round2(stockMarketValue + goldValue + etfValue + depositAmount + cashBalance)
  const totalPnl = round2(stockPnl + goldPnl + etfPnl)
  const totalCostBasis = round2(portfolioStats.totalCost + goldSummary.totalCost + etfCost)
  const totalPnlPct = totalCostBasis > 0 ? (totalPnl / totalCostBasis) * 100 : 0

  return {
    totalAssets,
    totalPnl,
    totalPnlPct: round2(totalPnlPct),
    stockMarketValue: round2(stockMarketValue),
    stockPnl: round2(stockPnl),
    goldValue,
    goldPnl,
    etfValue,
    etfPnl,
    depositAmount: round2(depositAmount),
    cashBalance: round2(cashBalance),
  }
}
