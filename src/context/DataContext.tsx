import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react'
import type { Stock, Trade, Settings, PortfolioStats } from '../types'
import * as store from '../lib/store'
import { computePortfolioStats } from '../lib/calculations'
import { fetchQuotes, fetchPeData } from '../lib/quotes'

interface DataContextType {
  stocks: Stock[]
  trades: Trade[]
  settings: Settings
  prices: Record<string, number>
  peData: Record<string, number>
  portfolioStats: PortfolioStats
  refreshData: () => Promise<void>
  refreshPrices: () => Promise<void>
  addStock: (input: Omit<Stock, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Stock | null>
  updateStock: (id: string, input: Partial<Stock>) => Promise<Stock | null>
  deleteStock: (id: string) => Promise<void>
  addTrade: (input: Omit<Trade, 'id' | 'createdAt'>) => Promise<Trade | null>
  updateTrade: (id: string, input: Partial<Trade>) => Promise<Trade | null>
  deleteTrade: (id: string) => Promise<void>
  updateSettings: (input: Partial<Settings>) => Promise<Settings>
  updateStockStatus: (id: string, status: Stock['status']) => Promise<Stock | null>
  loading: boolean
}

const DataContext = createContext<DataContextType | null>(null)

export function DataProvider({ children }: { children: ReactNode }) {
  const [stocks, setStocks] = useState<Stock[]>([])
  const [trades, setTrades] = useState<Trade[]>([])
  const [settings, setSettings] = useState<Settings>({ cashBalance: 0 })
  const [prices, setPrices] = useState<Record<string, number>>({})
  const [peData, setPeData] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const initialLoad = useRef(true)

  const refreshData = useCallback(async () => {
    const [s, t, st] = await Promise.all([
      store.getStocks(),
      store.getTrades(),
      store.getSettings(),
    ])
    setStocks(s)
    setTrades(t)
    setSettings(st)
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
      }
    }
    init()
  }, [refreshData, refreshPrices])

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
    await refreshData()
    return result
  }, [refreshData])

  const wrappedUpdateTrade = useCallback(async (id: string, input: Partial<Trade>) => {
    const result = await store.updateTrade(id, input)
    await refreshData()
    return result
  }, [refreshData])

  const wrappedDeleteTrade = useCallback(async (id: string) => {
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

  const portfolioStats = computePortfolioStats(stocks, trades, prices, settings.cashBalance)

  return (
    <DataContext.Provider
      value={{
        stocks,
        trades,
        settings,
        prices,
        peData,
        portfolioStats,
        refreshData,
        refreshPrices,
        addStock: wrappedAddStock,
        updateStock: wrappedUpdateStock,
        deleteStock: wrappedDeleteStock,
        addTrade: wrappedAddTrade,
        updateTrade: wrappedUpdateTrade,
        deleteTrade: wrappedDeleteTrade,
        updateSettings: wrappedUpdateSettings,
        updateStockStatus: wrappedUpdateStockStatus,
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
