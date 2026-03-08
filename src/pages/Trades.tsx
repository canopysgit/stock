import { useState, useMemo } from 'react'
import { useData } from '../context/DataContext'
import Modal from '../components/common/Modal'
import type { TradeType } from '../types'
import { Plus, Trash2, Edit2 } from 'lucide-react'

export default function Trades() {
  const { stocks, trades, addTrade, updateTrade, deleteTrade, updateStockStatus } = useData()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [filterStock, setFilterStock] = useState('')
  const [filterType, setFilterType] = useState<'' | TradeType>('')

  const [form, setForm] = useState({
    stockId: '',
    type: 'buy' as TradeType,
    tradeDate: new Date().toISOString().split('T')[0],
    price: '',
    quantity: '',
    notes: '',
  })

  const openAdd = () => {
    setForm({
      stockId: stocks[0]?.id || '',
      type: 'buy',
      tradeDate: new Date().toISOString().split('T')[0],
      price: '',
      quantity: '',
      notes: '',
    })
    setEditingId(null)
    setModalOpen(true)
  }

  const openEdit = (trade: typeof trades[0]) => {
    setForm({
      stockId: trade.stockId,
      type: trade.type,
      tradeDate: trade.tradeDate,
      price: trade.price.toString(),
      quantity: trade.quantity.toString(),
      notes: trade.notes,
    })
    setEditingId(trade.id)
    setModalOpen(true)
  }

  const handleSave = async () => {
    const price = parseFloat(form.price)
    const quantity = parseInt(form.quantity)
    if (!form.stockId || isNaN(price)) return
    // For adjust/dividend: quantity can be 0 (ignored), price is per-share amount
    if (form.type === 'adjust' || form.type === 'dividend') {
      if (price === 0) return
    } else {
      if (price <= 0 || isNaN(quantity) || quantity <= 0) return
    }

    const data = {
      stockId: form.stockId,
      type: form.type,
      tradeDate: form.tradeDate,
      price,
      quantity: (form.type === 'adjust' || form.type === 'dividend') ? 0 : quantity,
      notes: form.notes,
    }

    if (editingId) {
      await updateTrade(editingId, data)
    } else {
      await addTrade(data)
      // Auto-set stock status to 'holding' if it's a buy
      if (form.type === 'buy') {
        const stock = stocks.find((s) => s.id === form.stockId)
        if (stock && stock.status === 'watching') {
          await updateStockStatus(stock.id, 'holding')
        }
      }
    }
    setModalOpen(false)
  }

  const handleDeleteTrade = async (id: string) => {
    if (confirm('确认删除该交易记录？')) {
      await deleteTrade(id)
    }
  }

  const stockMap = useMemo(() => {
    const map: Record<string, string> = {}
    for (const s of stocks) map[s.id] = s.name
    return map
  }, [stocks])

  const filteredTrades = useMemo(() => {
    return [...trades]
      .filter((t) => {
        if (filterStock && t.stockId !== filterStock) return false
        if (filterType && t.type !== filterType) return false
        return true
      })
      .sort((a, b) => {
        const d = b.tradeDate.localeCompare(a.tradeDate)
        if (d !== 0) return d
        return b.createdAt.localeCompare(a.createdAt)
      })
  }, [trades, filterStock, filterType])

  const holdingOrWatching = stocks.filter((s) => s.status !== 'cleared')

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg md:text-xl font-semibold shrink-0">交易记录</h2>
        <button onClick={openAdd} className="flex items-center gap-2 px-3 md:px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm transition-colors whitespace-nowrap">
          <Plus size={16} /> 新增
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 md:gap-3">
        <select
          value={filterStock}
          onChange={(e) => setFilterStock(e.target.value)}
          className="bg-bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-text-primary flex-1 min-w-[120px]"
        >
          <option value="">全部股票</option>
          {stocks.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as any)}
          className="bg-bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-text-primary"
        >
          <option value="">全部类型</option>
          <option value="buy">买入</option>
          <option value="sell">卖出</option>
          <option value="adjust">成本调整</option>
          <option value="dividend">分红</option>
        </select>
      </div>

      {/* Trades table */}
      <div className="bg-bg-secondary rounded-xl border border-border overflow-x-auto">
        <table className="w-full text-sm min-w-[700px]">
          <thead>
            <tr className="border-b border-border text-text-muted">
              <th className="text-left px-4 py-3 font-medium">日期</th>
              <th className="text-left px-4 py-3 font-medium">股票</th>
              <th className="text-center px-4 py-3 font-medium">类型</th>
              <th className="text-right px-4 py-3 font-medium">价格</th>
              <th className="text-right px-4 py-3 font-medium">数量</th>
              <th className="text-right px-4 py-3 font-medium">金额</th>
              <th className="text-left px-4 py-3 font-medium">备注</th>
              <th className="text-center px-4 py-3 font-medium w-20">操作</th>
            </tr>
          </thead>
          <tbody>
            {filteredTrades.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-12 text-text-muted">暂无交易记录</td>
              </tr>
            ) : (
              filteredTrades.map((trade) => (
                <tr key={trade.id} className="border-b border-border/50 hover:bg-bg-hover/50">
                  <td className="px-4 py-3 font-mono text-text-secondary">{trade.tradeDate}</td>
                  <td className="px-4 py-3 text-text-primary">{stockMap[trade.stockId] || '未知'}</td>
                  <td className="text-center px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      trade.type === 'buy' ? 'bg-profit-bg text-profit' :
                      trade.type === 'sell' ? 'bg-loss-bg text-loss' :
                      trade.type === 'dividend' ? 'bg-accent/10 text-accent' :
                      'bg-warning/15 text-warning'
                    }`}>
                      {trade.type === 'buy' ? '买入' : trade.type === 'sell' ? '卖出' : trade.type === 'dividend' ? '分红' : '调整'}
                    </span>
                  </td>
                  <td className="text-right px-4 py-3 font-mono">
                    {(trade.type === 'adjust' || trade.type === 'dividend') ? (
                      <span>{trade.type === 'dividend' ? '' : (trade.price > 0 ? '+' : '')}{trade.price.toFixed(2)}/股</span>
                    ) : trade.price.toFixed(2)}
                  </td>
                  <td className="text-right px-4 py-3 font-mono">
                    {(trade.type === 'adjust' || trade.type === 'dividend') ? '-' : trade.quantity}
                  </td>
                  <td className="text-right px-4 py-3 font-mono">
                    {(trade.type === 'adjust' || trade.type === 'dividend') ? '-' : `¥${(trade.price * trade.quantity).toLocaleString()}`}
                  </td>
                  <td className="px-4 py-3 text-text-muted text-xs truncate max-w-32">{trade.notes || '-'}</td>
                  <td className="text-center px-4 py-3">
                    <div className="flex justify-center gap-1">
                      <button onClick={() => openEdit(trade)} className="p-1 text-text-muted hover:text-text-primary">
                        <Edit2 size={14} />
                      </button>
                      <button onClick={() => handleDeleteTrade(trade.id)} className="p-1 text-text-muted hover:text-profit">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add/Edit modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? '编辑交易' : '新增交易'}>
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-text-muted mb-1">股票</label>
            <select
              value={form.stockId}
              onChange={(e) => setForm({ ...form, stockId: e.target.value })}
              className="w-full bg-bg-tertiary border border-border rounded-lg px-3 py-2 text-sm text-text-primary"
            >
              <option value="">选择股票</option>
              {stocks.map((s) => (
                <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-text-muted mb-1">类型</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as TradeType })}
                className="w-full bg-bg-tertiary border border-border rounded-lg px-3 py-2 text-sm text-text-primary"
              >
                <option value="buy">买入</option>
                <option value="sell">卖出</option>
                <option value="adjust">成本调整</option>
                <option value="dividend">分红</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">日期</label>
              <input
                type="date"
                value={form.tradeDate}
                onChange={(e) => setForm({ ...form, tradeDate: e.target.value })}
                className="w-full bg-bg-tertiary border border-border rounded-lg px-3 py-2 text-sm text-text-primary"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-text-muted mb-1">
                {form.type === 'adjust' ? '调整金额（元/股）' : form.type === 'dividend' ? '每股分红（元）' : '价格'}
              </label>
              <input
                type="number"
                step="0.01"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                placeholder={form.type === 'adjust' ? '负数=降低成本' : form.type === 'dividend' ? '每股分红金额' : '成交价格'}
                className="w-full bg-bg-tertiary border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted/50 focus:outline-none focus:border-accent"
              />
            </div>
            {(form.type === 'buy' || form.type === 'sell') && (
              <div>
                <label className="block text-xs text-text-muted mb-1">数量（股）</label>
                <input
                  type="number"
                  step="100"
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                  placeholder="成交数量"
                  className="w-full bg-bg-tertiary border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted/50 focus:outline-none focus:border-accent"
                />
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs text-text-muted mb-1">备注</label>
            <input
              type="text"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="选填"
              className="w-full bg-bg-tertiary border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted/50 focus:outline-none focus:border-accent"
            />
          </div>
          {form.price && (form.type === 'adjust' || form.type === 'dividend') && (
            <div className="text-sm text-text-secondary">
              {form.type === 'adjust' ? '成本调整' : '分红'}: <span className="font-mono text-text-primary">{form.type === 'dividend' ? '' : (parseFloat(form.price) > 0 ? '+' : '')}{parseFloat(form.price).toFixed(2)} 元/股</span>
            </div>
          )}
          {form.price && form.quantity && (form.type === 'buy' || form.type === 'sell') && (
            <div className="text-sm text-text-secondary">
              交易金额: <span className="font-mono text-text-primary">¥{(parseFloat(form.price) * parseInt(form.quantity || '0')).toLocaleString()}</span>
            </div>
          )}
          <div className="flex justify-end pt-2">
            <button onClick={handleSave} className="px-6 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm transition-colors">
              保存
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
