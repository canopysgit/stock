import { supabase } from './supabase'
import type { Stock, Trade, Settings, StockStatus } from '../types'

// --- Demo data (shown when no Supabase credentials configured) ---
const DEMO_STOCK: Stock = {
  id: 'demo-1', code: '000001', name: '示例股票', industry: '示例行业',
  tier: 'mid', eps: 2.5, peHigh: 15, peMid: 10, peLow: 7,
  conditionPrice1: 20, conditionPrice2: 35, valuationUpdatedAt: '2024-01-01', status: 'holding',
  notes: '请部署到您自己的服务器并配置 Supabase 环境变量',
  createdAt: '2024-01-01', updatedAt: '2024-01-01',
}
const DEMO_TRADE: Trade = {
  id: 'demo-t1', stockId: 'demo-1', type: 'buy', tradeDate: '2024-06-15',
  price: 25.50, quantity: 400, notes: '示例交易', createdAt: '2024-06-15',
}

function isDemo(): boolean { return !supabase }

// --- Helper: convert DB row (snake_case) to app type (camelCase) ---
function dbToStock(row: any): Stock {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    industry: row.industry || '',
    tier: row.tier || 'mid',
    eps: row.eps != null ? Number(row.eps) : null,
    peHigh: row.pe_high != null ? Number(row.pe_high) : null,
    peMid: row.pe_mid != null ? Number(row.pe_mid) : null,
    peLow: row.pe_low != null ? Number(row.pe_low) : null,
    conditionPrice1: row.condition_price_1 != null ? Number(row.condition_price_1) : null,
    conditionPrice2: row.condition_price_2 != null ? Number(row.condition_price_2) : null,
    valuationUpdatedAt: row.valuation_updated_at || null,
    status: row.status || 'watching',
    notes: row.notes || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function stockToDb(data: Partial<Stock>): Record<string, any> {
  const map: Record<string, any> = {}
  if (data.code !== undefined) map.code = data.code
  if (data.name !== undefined) map.name = data.name
  if (data.industry !== undefined) map.industry = data.industry
  if (data.tier !== undefined) map.tier = data.tier
  if (data.eps !== undefined) map.eps = data.eps
  if (data.peHigh !== undefined) map.pe_high = data.peHigh
  if (data.peMid !== undefined) map.pe_mid = data.peMid
  if (data.peLow !== undefined) map.pe_low = data.peLow
  if (data.conditionPrice1 !== undefined) map.condition_price_1 = data.conditionPrice1
  if (data.conditionPrice2 !== undefined) map.condition_price_2 = data.conditionPrice2
  if (data.valuationUpdatedAt !== undefined) map.valuation_updated_at = data.valuationUpdatedAt
  if (data.status !== undefined) map.status = data.status
  if (data.notes !== undefined) map.notes = data.notes
  return map
}

function dbToTrade(row: any): Trade {
  return {
    id: row.id,
    stockId: row.stock_id,
    type: row.type,
    tradeDate: row.trade_date,
    price: Number(row.price),
    quantity: Number(row.quantity),
    notes: row.notes || '',
    createdAt: row.created_at,
  }
}

// --- Stocks ---
export async function getStocks(): Promise<Stock[]> {
  if (isDemo()) return [DEMO_STOCK]
  const { data, error } = await supabase!
    .from('stocks')
    .select('*')
    .order('created_at', { ascending: true })
  if (error) { console.error('getStocks error:', error); return [] }
  return (data || []).map(dbToStock)
}

export async function addStock(input: Omit<Stock, 'id' | 'createdAt' | 'updatedAt'>): Promise<Stock | null> {
  if (isDemo()) return null
  const row = stockToDb(input as Partial<Stock>)
  const { data, error } = await supabase!
    .from('stocks')
    .insert(row)
    .select()
    .single()
  if (error) { console.error('addStock error:', error); return null }
  return dbToStock(data)
}

export async function updateStock(id: string, input: Partial<Stock>): Promise<Stock | null> {
  if (isDemo()) return null
  const row = { ...stockToDb(input), updated_at: new Date().toISOString() }
  const { data, error } = await supabase!
    .from('stocks')
    .update(row)
    .eq('id', id)
    .select()
    .single()
  if (error) { console.error('updateStock error:', error); return null }
  return dbToStock(data)
}

export async function updateStockStatus(id: string, status: StockStatus): Promise<Stock | null> {
  return updateStock(id, { status } as Partial<Stock>)
}

export async function deleteStock(id: string): Promise<void> {
  if (isDemo()) return
  const { error } = await supabase!.from('stocks').delete().eq('id', id)
  if (error) console.error('deleteStock error:', error)
}

// --- Trades ---
export async function getTrades(): Promise<Trade[]> {
  if (isDemo()) return [DEMO_TRADE]
  const { data, error } = await supabase!
    .from('trades')
    .select('*')
    .order('trade_date', { ascending: true })
  if (error) { console.error('getTrades error:', error); return [] }
  return (data || []).map(dbToTrade)
}

export async function addTrade(input: Omit<Trade, 'id' | 'createdAt'>): Promise<Trade | null> {
  if (isDemo()) return null
  const row = {
    stock_id: input.stockId,
    type: input.type,
    trade_date: input.tradeDate,
    price: input.price,
    quantity: input.quantity,
    notes: input.notes || '',
  }
  const { data, error } = await supabase!
    .from('trades')
    .insert(row)
    .select()
    .single()
  if (error) { console.error('addTrade error:', error); return null }
  return dbToTrade(data)
}

export async function updateTrade(id: string, input: Partial<Trade>): Promise<Trade | null> {
  if (isDemo()) return null
  const row: Record<string, any> = {}
  if (input.stockId !== undefined) row.stock_id = input.stockId
  if (input.type !== undefined) row.type = input.type
  if (input.tradeDate !== undefined) row.trade_date = input.tradeDate
  if (input.price !== undefined) row.price = input.price
  if (input.quantity !== undefined) row.quantity = input.quantity
  if (input.notes !== undefined) row.notes = input.notes
  const { data, error } = await supabase!
    .from('trades')
    .update(row)
    .eq('id', id)
    .select()
    .single()
  if (error) { console.error('updateTrade error:', error); return null }
  return dbToTrade(data)
}

export async function deleteTrade(id: string): Promise<void> {
  if (isDemo()) return
  const { error } = await supabase!.from('trades').delete().eq('id', id)
  if (error) console.error('deleteTrade error:', error)
}

// --- Settings ---
export async function getSettings(): Promise<Settings> {
  if (isDemo()) return { cashBalance: 10000 }
  const { data, error } = await supabase!
    .from('settings')
    .select('*')
    .limit(1)
    .single()
  if (error || !data) return { cashBalance: 0 }
  return { cashBalance: Number(data.cash_balance) || 0 }
}

export async function updateSettings(input: Partial<Settings>): Promise<Settings> {
  if (isDemo()) return { cashBalance: input.cashBalance || 0 }
  const row: Record<string, any> = { updated_at: new Date().toISOString() }
  if (input.cashBalance !== undefined) row.cash_balance = input.cashBalance

  const { data: existing } = await supabase!.from('settings').select('id').limit(1).single()
  if (existing) {
    await supabase!.from('settings').update(row).eq('id', existing.id)
  } else {
    await supabase!.from('settings').insert({ cash_balance: input.cashBalance || 0 })
  }
  return getSettings()
}
