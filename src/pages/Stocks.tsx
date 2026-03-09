import { useState } from 'react'
import { useData } from '../context/DataContext'
import Modal from '../components/common/Modal'
import type { Stock, StockTier, StockStatus } from '../types'
import { TIER_PCT, calcValuationPrices } from '../lib/calculations'
import { lookupStockInfo } from '../lib/quotes'
import { Plus, Edit2, Trash2, Search, Download } from 'lucide-react'

const emptyForm = {
  code: '',
  name: '',
  industry: '',
  tier: 'mid' as StockTier,
  status: 'watching' as StockStatus,
  notes: '',
}

const statusLabels: Record<StockStatus, string> = {
  watching: '观察中',
  holding: '持仓中',
  cleared: '已清仓',
}

export default function Stocks() {
  const { stocks, prices, peData, portfolioStats, addStock, updateStock, deleteStock } = useData()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<'' | StockStatus>('')
  const [lookingUp, setLookingUp] = useState(false)

  const handleLookup = async () => {
    const code = form.code.trim()
    if (!code || code.length < 6) return
    setLookingUp(true)
    try {
      const info = await lookupStockInfo(code)
      if (info) {
        setForm((f) => ({
          ...f,
          code: info.code,
          name: info.name || f.name,
          industry: info.industry || f.industry,
        }))
      } else {
        alert('未找到该股票，请检查代码')
      }
    } finally {
      setLookingUp(false)
    }
  }

  const openAdd = () => {
    setForm(emptyForm)
    setEditingId(null)
    setModalOpen(true)
  }

  const openEdit = (stock: Stock) => {
    setForm({
      code: stock.code,
      name: stock.name,
      industry: stock.industry,
      tier: stock.tier,
      status: stock.status,
      notes: stock.notes,
    })
    setEditingId(stock.id)
    setModalOpen(true)
  }

  const handleSave = async () => {
    const data = {
      code: form.code.trim(),
      name: form.name.trim(),
      industry: form.industry.trim(),
      tier: form.tier,
      status: form.status,
      notes: form.notes,
      eps: null as number | null,
      peHigh: null as number | null,
      peMid: null as number | null,
      peLow: null as number | null,
      conditionPrice1: null as number | null,
      conditionPrice2: null as number | null,
    }
    if (!data.code || !data.name) return

    if (editingId) {
      // Only update basic fields, preserve valuation params
      await updateStock(editingId, {
        code: data.code,
        name: data.name,
        industry: data.industry,
        tier: data.tier,
        status: data.status,
        notes: data.notes,
      })
    } else {
      await addStock(data)
    }
    setModalOpen(false)
  }

  const handleDelete = async (id: string) => {
    if (confirm('确认删除该股票？相关交易记录也会一并删除。')) {
      await deleteStock(id)
    }
  }

  // Build position percentage map for sorting
  const posPctMap: Record<string, number> = {}
  for (const pos of portfolioStats.positions) {
    posPctMap[pos.stock.id] = pos.positionPct
  }

  const filtered = stocks
    .filter((s) => {
      if (filterStatus && s.status !== filterStatus) return false
      if (search) {
        const q = search.toLowerCase()
        return s.code.toLowerCase().includes(q) || s.name.toLowerCase().includes(q) || s.industry.toLowerCase().includes(q)
      }
      return true
    })
    .sort((a, b) => {
      // Group: holding first, then watching, then cleared
      const order: Record<StockStatus, number> = { holding: 0, watching: 1, cleared: 2 }
      if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status]
      // Within holding: sort by position pct descending
      if (a.status === 'holding') return (posPctMap[b.id] || 0) - (posPctMap[a.id] || 0)
      return 0
    })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg lg:text-xl font-semibold shrink-0">股票管理</h2>
        <button onClick={openAdd} className="flex items-center gap-2 px-3 lg:px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm transition-colors whitespace-nowrap">
          <Plus size={16} /> 添加
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 lg:gap-3">
        <div className="relative flex-1 min-w-[160px] max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索代码、名称、行业..."
            className="w-full bg-bg-secondary border border-border rounded-lg pl-9 pr-3 py-2 text-sm text-text-primary placeholder-text-muted/50 focus:outline-none focus:border-accent"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as any)}
          className="bg-bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-text-primary"
        >
          <option value="">全部状态</option>
          <option value="watching">观察中</option>
          <option value="holding">持仓中</option>
          <option value="cleared">已清仓</option>
        </select>
      </div>

      {/* Stock cards */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-text-muted">
          <p className="text-lg">{stocks.length === 0 ? '暂无股票' : '没有匹配的股票'}</p>
          {stocks.length === 0 && <p className="text-sm mt-2">点击右上角「添加股票」开始</p>}
        </div>
      ) : (() => {
        const holdingStocks = filtered.filter((s) => s.status === 'holding')
        const watchingStocks = filtered.filter((s) => s.status === 'watching')
        const clearedStocks = filtered.filter((s) => s.status === 'cleared')
        return (
          <div className="space-y-4">
            {holdingStocks.length > 0 && (
              <>
                {(!filterStatus || filterStatus !== 'holding') && (watchingStocks.length > 0 || clearedStocks.length > 0) && (
                  <h3 className="text-xs font-medium text-text-muted uppercase tracking-wider">持仓中 ({holdingStocks.length})</h3>
                )}
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                  {holdingStocks.map((stock) => (
                    <StockCard key={stock.id} stock={stock} positionPct={posPctMap[stock.id]} currentPrice={prices[stock.code] || 0} currentPe={peData[stock.code] || 0} onEdit={() => openEdit(stock)} onDelete={() => handleDelete(stock.id)} />
                  ))}
                </div>
              </>
            )}
            {watchingStocks.length > 0 && (
              <>
                {(!filterStatus || filterStatus !== 'watching') && (holdingStocks.length > 0 || clearedStocks.length > 0) && (
                  <h3 className="text-xs font-medium text-text-muted uppercase tracking-wider mt-2">观察中 ({watchingStocks.length})</h3>
                )}
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                  {watchingStocks.map((stock) => (
                    <StockCard key={stock.id} stock={stock} currentPrice={prices[stock.code] || 0} currentPe={peData[stock.code] || 0} onEdit={() => openEdit(stock)} onDelete={() => handleDelete(stock.id)} />
                  ))}
                </div>
              </>
            )}
            {clearedStocks.length > 0 && (
              <>
                {(!filterStatus || filterStatus !== 'cleared') && (holdingStocks.length > 0 || watchingStocks.length > 0) && (
                  <h3 className="text-xs font-medium text-text-muted uppercase tracking-wider mt-2">已清仓 ({clearedStocks.length})</h3>
                )}
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                  {clearedStocks.map((stock) => (
                    <StockCard key={stock.id} stock={stock} currentPrice={prices[stock.code] || 0} currentPe={peData[stock.code] || 0} onEdit={() => openEdit(stock)} onDelete={() => handleDelete(stock.id)} />
                  ))}
                </div>
              </>
            )}
          </div>
        )
      })()}

      {/* Add/Edit modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? '编辑股票' : '添加股票'}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-text-muted mb-1">股票代码</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleLookup() } }}
                  placeholder="如 600519"
                  className="flex-1 bg-bg-tertiary border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted/50 focus:outline-none focus:border-accent"
                />
                <button
                  type="button"
                  onClick={handleLookup}
                  disabled={lookingUp || !form.code.trim()}
                  className="px-3 py-2 bg-accent/10 text-accent hover:bg-accent/20 rounded-lg text-sm transition-colors disabled:opacity-50 shrink-0"
                >
                  <Download size={14} className={lookingUp ? 'animate-spin' : ''} />
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">股票名称</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="自动填充或手动输入"
                className="w-full bg-bg-tertiary border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted/50 focus:outline-none focus:border-accent"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-text-muted mb-1">行业分类</label>
              <input
                type="text"
                value={form.industry}
                onChange={(e) => setForm({ ...form, industry: e.target.value })}
                placeholder="如 白酒"
                className="w-full bg-bg-tertiary border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted/50 focus:outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">重要性评级</label>
              <select
                value={form.tier}
                onChange={(e) => setForm({ ...form, tier: e.target.value as StockTier })}
                className="w-full bg-bg-tertiary border border-border rounded-lg px-3 py-2 text-sm text-text-primary"
              >
                <option value="core">核心 (15%)</option>
                <option value="high">高 (10%)</option>
                <option value="mid">中 (6%)</option>
                <option value="low">低 (3%)</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-text-muted mb-1">状态</label>
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as StockStatus })}
              className="w-full bg-bg-tertiary border border-border rounded-lg px-3 py-2 text-sm text-text-primary"
            >
              <option value="watching">观察中</option>
              <option value="holding">持仓中</option>
              <option value="cleared">已清仓</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-text-muted mb-1">备注</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="投资逻辑、关注要点、研究笔记..."
              rows={4}
              className="w-full bg-bg-tertiary border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted/50 focus:outline-none focus:border-accent resize-none"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-text-secondary hover:text-text-primary text-sm transition-colors">
              取消
            </button>
            <button onClick={handleSave} className="px-6 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm transition-colors">
              保存
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function StockCard({ stock, positionPct, currentPrice, currentPe, onEdit, onDelete }: {
  stock: Stock
  positionPct?: number
  currentPrice: number
  currentPe: number
  onEdit: () => void
  onDelete: () => void
}) {
  const tierLabel = stock.tier === 'core' ? '核心' : stock.tier === 'high' ? '高' : stock.tier === 'mid' ? '中' : '低'
  const statusColor = stock.status === 'holding'
    ? 'bg-accent/15 text-accent-hover'
    : stock.status === 'watching'
    ? 'bg-warning/15 text-warning'
    : 'bg-text-muted/15 text-text-muted'

  const hasValuation = stock.eps && stock.peHigh && stock.peMid && stock.peLow

  return (
    <div className="bg-bg-secondary rounded-xl border border-border p-5 space-y-3 hover:border-accent/30 transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-text-primary">{stock.name}</h3>
            <span className={`text-xs px-1.5 py-0.5 rounded ${statusColor}`}>
              {statusLabels[stock.status]}
            </span>
          </div>
          <p className="text-xs text-text-muted mt-0.5">{stock.code} · {stock.industry || '未分类'}</p>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={onEdit} className="p-1.5 text-text-muted hover:text-text-primary hover:bg-bg-hover rounded transition-colors">
            <Edit2 size={14} />
          </button>
          <button onClick={onDelete} className="p-1.5 text-text-muted hover:text-profit hover:bg-profit-bg rounded transition-colors">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Info row */}
      <div className="flex items-center gap-4 text-sm">
        {positionPct != null && (
          <div>
            <span className="text-text-muted text-xs">仓位</span>
            <span className="ml-1 font-mono text-text-primary">{positionPct.toFixed(1)}%</span>
          </div>
        )}
        <div>
          <span className="text-text-muted text-xs">评级</span>
          <span className="ml-1 text-text-primary">{tierLabel} ({TIER_PCT[stock.tier]}%)</span>
        </div>
        {currentPrice > 0 && (
          <div>
            <span className="text-text-muted text-xs">现价</span>
            <span className="ml-1 font-mono text-text-primary">{currentPrice.toFixed(2)}</span>
          </div>
        )}
        {currentPe > 0 && (
          <div>
            <span className="text-text-muted text-xs">PE(TTM)</span>
            <span className="ml-1 font-mono text-text-primary">{currentPe.toFixed(2)}</span>
          </div>
        )}
      </div>

      {/* Valuation prices */}
      {hasValuation && (() => {
        const vp = calcValuationPrices(stock.eps!, stock.peHigh!, stock.peMid!, stock.peLow!)
        return (
          <div className="flex items-center gap-3 text-xs">
            <div>
              <span className="text-text-muted">低估值</span>
              <span className="ml-1 font-mono text-loss">{vp.low.p1.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-text-muted">中估值</span>
              <span className="ml-1 font-mono text-warning">{vp.mid.p1.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-text-muted">高估值</span>
              <span className="ml-1 font-mono text-profit">{vp.high.p1.toFixed(2)}</span>
            </div>
          </div>
        )
      })()}

      {/* Notes */}
      {stock.notes && (
        <div className="pt-2 border-t border-border/50">
          <p className="text-xs text-text-secondary leading-relaxed line-clamp-3">{stock.notes}</p>
        </div>
      )}

      {/* Condition prices */}
      {(stock.conditionPrice1 || stock.conditionPrice2) && (
        <div className="flex gap-3 text-xs">
          {stock.conditionPrice1 && (
            <span className="text-text-muted">条件单1: <span className="font-mono text-text-secondary">{stock.conditionPrice1}</span></span>
          )}
          {stock.conditionPrice2 && (
            <span className="text-text-muted">条件单2: <span className="font-mono text-text-secondary">{stock.conditionPrice2}</span></span>
          )}
        </div>
      )}
    </div>
  )
}
