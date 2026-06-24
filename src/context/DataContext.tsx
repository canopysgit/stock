import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react'
import type { Stock, Trade, Settings, PortfolioStats, CashFlow, OtherAsset, AssetOverviewSummary } from '../types'
import * as store from '../lib/store'
import { computePortfolioStats, computeCashBalance, computeAssetOverview, computeGoldSummary } from '../lib/calculations'
import { fetchQuotes, fetchPeData, fetchTiantianNav, fetchGoldPriceCNY } from '../lib/quotes'

interface DataContextType {
  stocks: Stock[]
  trades: Trade[]
  settings: Settings
  cashFlows: CashFlow[]
  prices: Record<string, number>
  peData: Record<string, number>
  portfolioStats: PortfolioStats
  cashBalance: number
  otherAssets: OtherAsset[]
  goldPrice: number
  etfNavs: Record<string, number>
  assetOverview: AssetOverviewSummary
  refreshData: () => Promise<void>
  refreshPrices: () => Promise<void>
  refreshOtherPrices: () => Promise<void>
  addStock: (input: Omit<Stock, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Stock | null>
  updateStock: (id: string, input: Partial<Stock>) => Promise<Stock | null>
  deleteStock: (id: string) => Promise<void>
  addTrade: (input: Omit<Trade, 'id' | 'createdAt'>) => Promise<Trade | null>
  updateTrade: (id: string, input: Partial<Trade>) => Promise<Trade | null>
  deleteTrade: (id: string) => Promise<void>
  updateSettings: (input: Partial<Settings>) => Promise<Settings>
  updateStockStatus: (id: string, status: Stock['status']) => Promise<Stock | null>
  addCashFlow: (input: Omit<CashFlow, 'id' | 'createdAt'>) => Promise<CashFlow | null>
  deleteCashFlow: (id: string) => Promise<void>
  addOtherAsset: (input: Omit<OtherAsset, 'id' | 'createdAt'>) => Promise<OtherAsset | null>
  updateOtherAsset: (id: string, input: Partial<OtherAsset>) => Promise<OtherAsset | null>
  deleteOtherAsset: (id: string) => Promise<void>
  loading: boolean
}

const DataContext = createContext<DataContextType | null>(null)

export function DataProvider({ children }: { children: ReactNode }) {
  const [stocks, setStocks] = useState<Stock[]>([])
  const [trades, setTrades] = useState<Trade[]>([])
  const [settings, setSettings] = useState<Settings>({ cashBalance: 0 })
  const [cashFlows, setCashFlows] = useState<CashFlow[]>([])
  const [prices, setPrices] = useState<Record<string, number>>({})
  const [peData, setPeData] = useState<Record<string, number>>({})
  const [otherAssets, setOtherAssets] = useState<OtherAsset[]>([])
  const [goldPrice, setGoldPrice] = useState(0)
  const [etfNavs, setEtfNavs] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const initialLoad = useRef(true)

  const refreshData = useCallback(async () => {
    const [s, t, st, cf, oa] = await Promise.all([
      store.getStocks(),
      store.getTrades(),
      store.getSettings(),
      store.getCashFlows(),
      store.getOtherAssets(),
    ])
    setStocks(s)
    setTrades(t)
    setSettings(st)
    setCashFlows(cf)
    setOtherAssets(oa)
  }, [])

  const refreshPrices = useCallback(async () => {
    const allStocks = await store.getStocks()
    const codes = allStocks.filter((s) => s.code).map((s) => s.code)
    if (codes.length === 0) return
    setLoading(true)
    try {
      const [priceResult, peResult] = await Promise.all([
        fetchQuotes(codes),
        fetchPeData(codes),
      ])
      setPrices((prev) => ({ ...prev, ...priceResult }))
      setPeData((prev) => ({ ...prev, ...peResult }))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const init = async () => {
      setLoading(true)
      await refreshData()
      setLoading(false)
      if (initialLoad.current) {
        initialLoad.current = false
        refreshPrices()
        // Fetch gold price independently (doesn't depend on otherAssets)
        fetchGoldPriceCNY().then((p) => { if (p) setGoldPrice(p) })
      }
    }
    init()
  }, [refreshData, refreshPrices])

  const refreshOtherPrices = useCallback(async () => {
    try {
      const goldCNY = await fetchGoldPriceCNY()
      if (goldCNY) setGoldPrice(goldCNY)

      const currentAssets = await store.getOtherAssets()
      const etfCodes = currentAssets
        .filter((a: any) => a.assetType === 'fund' && a.code)
        .map((a: any) => a.code!)
      const uniqueCodes = [...new Set(etfCodes)]
      const navResults = await Promise.all(uniqueCodes.map(fetchTiantianNav))
      const newNavs: Record<string, number> = {}
      for (const r of navResults) {
        if (r) newNavs[r.code] = r.nav
      }
      setEtfNavs((prev) => ({ ...prev, ...newNavs }))
    } catch (e) {
      console.warn('refreshOtherPrices error:', e)
    }
  }, [])

  // Auto-refresh other prices after data loads
  const otherAssetsLoaded = useRef(false)
  useEffect(() => {
    if (!otherAssetsLoaded.current && otherAssets.length > 0) {
      otherAssetsLoaded.current = true
      refreshOtherPrices()
    }
  }, [otherAssets, refreshOtherPrices])

  const wrappedAddStock = useCallback(async (input: Omit<Stock, 'id' | 'createdAt' | 'updatedAt'>) => {
    const result = await store.addStock(input)
    await refreshData()
    return result
  }, [refreshData])

  const wrappedUpdateStock = useCallback(async (id: string, input: Partial<Stock>) => {
    const result = await store.updateStock(id, input)
    await refreshData()
    return result
  }, [refreshData])

  const wrappedDeleteStock = useCallback(async (id: string) => {
    await store.deleteStock(id)
    await refreshData()
  }, [refreshData])

  const wrappedAddTrade = useCallback(async (input: Omit<Trade, 'id' | 'createdAt'>) => {
    const result = await store.addTrade(input)
    if (result) {
      // Auto-create cash flow for buy/sell/dividend
      if (input.type === 'buy') {
        await store.addCashFlow({
          type: 'buy',
          amount: -(input.price * input.quantity),
          tradeId: result.id,
          stockId: input.stockId,
          flowDate: input.tradeDate,
          notes: `买入`,
        })
      } else if (input.type === 'sell') {
        await store.addCashFlow({
          type: 'sell',
          amount: input.price * input.quantity,
          tradeId: result.id,
          stockId: input.stockId,
          flowDate: input.tradeDate,
          notes: `卖出`,
        })
      } else if (input.type === 'dividend') {
        // For dividend, we need to calculate the actual cash received
        // The dividend amount = price (per-share) × quantity stored in notes or computed from current holdings
        // Since quantity is 0 for dividend trades, we pass the actual amount via notes convention
        // We'll use a special field: if quantity > 0, use it; otherwise compute from open lots
        const dividendQty = input.quantity > 0 ? input.quantity : 0
        if (dividendQty > 0) {
          await store.addCashFlow({
            type: 'dividend',
            amount: input.price * dividendQty,
            tradeId: result.id,
            stockId: input.stockId,
            flowDate: input.tradeDate,
            notes: `分红`,
          })
        }
      }
    }
    await refreshData()
    return result
  }, [refreshData])

  const wrappedUpdateTrade = useCallback(async (id: string, input: Partial<Trade>) => {
    // Delete old cash flow for this trade, then recreate after update
    await store.deleteCashFlowByTradeId(id)
    const result = await store.updateTrade(id, input)
    if (result) {
      // Recreate cash flow based on updated trade
      if (result.type === 'buy') {
        await store.addCashFlow({
          type: 'buy',
          amount: -(result.price * result.quantity),
          tradeId: result.id,
          stockId: result.stockId,
          flowDate: result.tradeDate,
          notes: `买入`,
        })
      } else if (result.type === 'sell') {
        await store.addCashFlow({
          type: 'sell',
          amount: result.price * result.quantity,
          tradeId: result.id,
          stockId: result.stockId,
          flowDate: result.tradeDate,
          notes: `卖出`,
        })
      }
      // Dividend cash flow handled differently — skipped on update for simplicity
    }
    await refreshData()
    return result
  }, [refreshData])

  const wrappedDeleteTrade = useCallback(async (id: string) => {
    // Cash flow with trade_id FK will cascade-delete automatically
    await store.deleteTrade(id)
    await refreshData()
  }, [refreshData])

  const wrappedUpdateSettings = useCallback(async (input: Partial<Settings>) => {
    const result = await store.updateSettings(input)
    await refreshData()
    return result
  }, [refreshData])

  const wrappedUpdateStockStatus = useCallback(async (id: string, status: Stock['status']) => {
    const result = await store.updateStockStatus(id, status)
    await refreshData()
    return result
  }, [refreshData])

  const wrappedAddCashFlow = useCallback(async (input: Omit<CashFlow, 'id' | 'createdAt'>) => {
    const result = await store.addCashFlow(input)
    await refreshData()
    return result
  }, [refreshData])

  const wrappedDeleteCashFlow = useCallback(async (id: string) => {
    await store.deleteCashFlow(id)
    await refreshData()
  }, [refreshData])

  const wrappedAddOtherAsset = useCallback(async (input: Omit<OtherAsset, 'id' | 'createdAt'>) => {
    const result = await store.addOtherAsset(input)
    await refreshData()
    return result
  }, [refreshData])

  const wrappedUpdateOtherAsset = useCallback(async (id: string, input: Partial<OtherAsset>) => {
    const result = await store.updateOtherAsset(id, input)
    await refreshData()
    return result
  }, [refreshData])

  const wrappedDeleteOtherAsset = useCallback(async (id: string) => {
    await store.deleteOtherAsset(id)
    await refreshData()
  }, [refreshData])

  // Compute cash balance from cash flows (if available), fallback to settings
  const cashBalance = cashFlows.length > 0 ? computeCashBalance(cashFlows) : settings.cashBalance
  const portfolioStats = computePortfolioStats(stocks, trades, prices, cashBalance)
  const assetOverview = computeAssetOverview(portfolioStats, otherAssets, goldPrice, etfNavs, cashBalance)

  return (
    <DataContext.Provider
      value={{
        stocks,
        trades,
        settings,
        cashFlows,
        prices,
        peData,
        portfolioStats,
        cashBalance,
        otherAssets,
        goldPrice,
        etfNavs,
        assetOverview,
        refreshData,
        refreshPrices,
        refreshOtherPrices,
        addStock: wrappedAddStock,
        updateStock: wrappedUpdateStock,
        deleteStock: wrappedDeleteStock,
        addTrade: wrappedAddTrade,
        updateTrade: wrappedUpdateTrade,
        deleteTrade: wrappedDeleteTrade,
        updateSettings: wrappedUpdateSettings,
        updateStockStatus: wrappedUpdateStockStatus,
        addCashFlow: wrappedAddCashFlow,
        deleteCashFlow: wrappedDeleteCashFlow,
        addOtherAsset: wrappedAddOtherAsset,
        updateOtherAsset: wrappedUpdateOtherAsset,
        deleteOtherAsset: wrappedDeleteOtherAsset,
        loading,
      }}
    >
      {children}
    </DataContext.Provider>
  )
}

export function useData() {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData must be used within DataProvider')
  return ctx
}
