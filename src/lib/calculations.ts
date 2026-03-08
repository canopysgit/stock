import type {
  Stock, Trade, StockTier, ValuationPrices, ValuationComparison,
  LotInfo, PositionSummary, ClearedSummary, PortfolioStats,
} from '../types'

// --- Tier target percentages ---
export const TIER_PCT: Record<StockTier, number> = {
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
  buyPrice: number
  originalQty: number
  remainingQty: number
}

export function computeLots(trades: Trade[]): {
  openLots: InternalLot[]
  realizedPnl: { buyTradeId: string; buyPrice: number; sellPrice: number; sellDate: string; qty: number }[]
  costAdjustment: number // total cost offset from adjust/dividend trades
} {
  const sorted = [...trades].sort((a, b) => {
    const d = a.tradeDate.localeCompare(b.tradeDate)
    if (d !== 0) return d
    return a.createdAt.localeCompare(b.createdAt)
  })

  const openLots: InternalLot[] = []
  const realizedPnl: { buyTradeId: string; buyPrice: number; sellPrice: number; sellDate: string; qty: number }[] = []
  let costAdjustment = 0

  for (const trade of sorted) {
    if (trade.type === 'buy') {
      openLots.push({
        tradeId: trade.id,
        buyDate: trade.tradeDate,
        buyPrice: trade.price,
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
          buyPrice: lot.buyPrice,
          sellPrice: trade.price,
          sellDate: trade.tradeDate,
          qty: matched,
        })
      }
    } else if (trade.type === 'adjust') {
      // Cost adjustment as total offset: price = per-share delta, multiply by current open qty
      const openQty = openLots.reduce((s, l) => s + l.remainingQty, 0)
      costAdjustment += trade.price * openQty
    } else if (trade.type === 'dividend') {
      // Dividend reduces cost: price = per-share dividend, multiply by current open qty
      const openQty = openLots.reduce((s, l) => s + l.remainingQty, 0)
      costAdjustment -= trade.price * openQty
    }
  }

  return { openLots: openLots.filter((l) => l.remainingQty > 0), realizedPnl, costAdjustment }
}

// --- Position summary ---
export function computePositionSummary(
  stock: Stock,
  trades: Trade[],
  marketPrice: number,
  totalCapital: number,
): PositionSummary {
  const stockTrades = trades.filter((t) => t.stockId === stock.id)
  const { openLots, costAdjustment } = computeLots(stockTrades)

  const totalQty = openLots.reduce((s, l) => s + l.remainingQty, 0)
  const rawLotCost = openLots.reduce((s, l) => s + l.remainingQty * l.buyPrice, 0)
  const totalCost = rawLotCost + costAdjustment // adjusted total cost
  const avgCost = totalQty > 0 ? totalCost / totalQty : 0
  const marketValue = totalQty * marketPrice
  const floatingPnl = marketValue - totalCost
  const floatingPnlPct = totalCost > 0 ? (floatingPnl / totalCost) * 100 : 0
  const positionPct = totalCapital > 0 ? (marketValue / totalCapital) * 100 : 0
  const targetPct = TIER_PCT[stock.tier]
  const adjustPct = targetPct - positionPct
  const adjustAmount = (adjustPct / 100) * totalCapital

  const buyTrades = stockTrades.filter((t) => t.type === 'buy').sort((a, b) => b.tradeDate.localeCompare(a.tradeDate))
  const lastBuyDate = buyTrades.length > 0 ? buyTrades[0].tradeDate : null
  const buyPrices = buyTrades.map((t) => t.price)

  // Per-lot PnL: use original buy prices (not adjusted)
  // Cost adjustment is shown at the position level, not per-lot
  const lots: LotInfo[] = openLots.map((l) => ({
    tradeId: l.tradeId,
    buyDate: l.buyDate,
    buyPrice: l.buyPrice, // original buy price, never modified
    originalQty: l.originalQty,
    remainingQty: l.remainingQty,
    floatingPnl: (marketPrice - l.buyPrice) * l.remainingQty,
    floatingPnlPct: l.buyPrice > 0 ? ((marketPrice - l.buyPrice) / l.buyPrice) * 100 : 0,
  }))

  return {
    stock,
    totalQty,
    avgCost: round3(avgCost),
    totalCost: round2(totalCost),
    costAdjustment: round2(costAdjustment),
    marketPrice,
    marketValue: round2(marketValue),
    floatingPnl: round2(floatingPnl),
    floatingPnlPct: round2(floatingPnlPct),
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
  const totalPnl = positions.reduce((s, p) => s + p.floatingPnl, 0)
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
