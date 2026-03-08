export type StockTier = 'core' | 'high' | 'mid' | 'low'
export type StockStatus = 'watching' | 'holding' | 'cleared'
export type TradeType = 'buy' | 'sell' | 'adjust' | 'dividend'

export interface Stock {
  id: string
  code: string
  name: string
  industry: string
  tier: StockTier
  eps: number | null
  peHigh: number | null
  peMid: number | null
  peLow: number | null
  conditionPrice1: number | null
  conditionPrice2: number | null
  valuationUpdatedAt: string | null
  status: StockStatus
  notes: string
  createdAt: string
  updatedAt: string
}

export interface Trade {
  id: string
  stockId: string
  type: TradeType
  tradeDate: string
  price: number
  quantity: number
  notes: string
  createdAt: string
}

export interface Settings {
  cashBalance: number
}

// --- Computed types ---

export interface ValuationPrices {
  high: { p1: number; p2: number; p3: number }
  mid: { p1: number; p2: number; p3: number }
  low: { p1: number; p2: number; p3: number }
}

export interface ValuationComparison {
  price: number
  diff: number // (currentPrice - targetPrice) / targetPrice
  label: string
}

export interface LotInfo {
  tradeId: string
  buyDate: string
  buyPrice: number
  originalQty: number
  remainingQty: number
  floatingPnl: number
  floatingPnlPct: number
}

export interface RealizedLotInfo {
  tradeId: string
  buyDate: string
  buyPrice: number
  sellPrice: number
  sellDate: string
  quantity: number
  realizedPnl: number
  realizedPnlPct: number
}

export interface PositionSummary {
  stock: Stock
  totalQty: number
  avgCost: number
  totalCost: number
  costAdjustment: number
  marketPrice: number
  marketValue: number
  floatingPnl: number
  floatingPnlPct: number
  positionPct: number
  targetPct: number
  adjustPct: number
  adjustAmount: number
  lastBuyDate: string | null
  lots: LotInfo[]
  buyPrices: number[]
}

export interface ClearedSummary {
  stock: Stock
  tradeCount: number
  firstBuyDate: string
  lastSellDate: string
  holdingDays: number
  totalInvested: number
  totalReceived: number
  pnlAmount: number
  pnlPct: number
  annualizedPnlPct: number
  trades: Trade[]
}

export interface PortfolioStats {
  totalMarketValue: number
  totalCost: number
  totalPnl: number
  totalPnlPct: number
  totalCapital: number
  holdingCount: number
  positions: PositionSummary[]
}
