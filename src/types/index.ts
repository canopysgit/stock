export type StockTier = 'core' | 'high' | 'mid' | 'low'
export type StockStatus = 'watching' | 'holding' | 'cleared'
export type TradeType = 'buy' | 'sell' | 'adjust' | 'dividend' | 'split'

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

export type CashFlowType = 'deposit' | 'withdraw' | 'buy' | 'sell' | 'dividend'

export interface CashFlow {
  id: string
  type: CashFlowType
  amount: number // positive = money in, negative = money out
  tradeId: string | null
  stockId: string | null
  flowDate: string
  notes: string
  createdAt: string
}

export type OtherAssetType = 'gold' | 'fund' | 'deposit'

export interface OtherAsset {
  id: string
  name: string
  assetType: OtherAssetType
  code: string | null
  quantity: number
  avgCost: number
  totalCost: number
  currentPrice: number
  account: string
  notes: string
  createdAt: string
  updatedAt: string
}

export interface GoldSummary {
  totalGrams: number
  avgCostPerGram: number
  totalCost: number
  trades: OtherAsset[]
}

export interface EtfSummary {
  code: string
  name: string
  totalShares: number
  totalCost: number
  avgCostPerShare: number
}

export interface AssetOverviewSummary {
  totalAssets: number
  totalPnl: number
  totalPnlPct: number
  stockMarketValue: number
  stockPnl: number
  goldValue: number
  goldPnl: number
  etfValue: number
  etfPnl: number
  depositAmount: number
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
  adjustedBuyPrice: number
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
  totalDividend: number
  realizedPnl: number
  marketPrice: number
  marketValue: number
  floatingPnl: number       // sum of lot PnL (real per-lot returns)
  floatingPnlPct: number    // based on raw lot cost
  positionFloatingPnl: number // position-level: marketValue - totalCost (software number)
  positionFloatingPnlPct: number // positionFloatingPnl / totalCost
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
