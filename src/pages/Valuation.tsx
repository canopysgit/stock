import { useState } from 'react'
import { useData } from '../context/DataContext'
import { calcValuationPrices, calcValuationComparisons, TIER_PCT } from '../lib/calculations'
import { fetchEpsForecast, type EpsForecast } from '../lib/forecast'
import Modal from '../components/common/Modal'
import type { Stock } from '../types'
import { Edit2, Download } from 'lucide-react'

type Tab = 'holding' | 'watching' | 'all'

export default function Valuation() {
  const { stocks, prices, peData, updateStock } = useData()
  const [selected, setSelected] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('holding')
  const [editModal, setEditModal] = useState(false)
  const [form, setForm] = useState({
    eps: '',
    peHigh: '',
    peMid: '',
    peLow: '',
    conditionPrice1: '',
    conditionPrice2: '',
  })

  const [forecast, setForecast] = useState<EpsForecast | null>(null)
  const [fetchingEps, setFetchingEps] = useState(false)

  const openEdit = (stock: Stock) => {
    setForm({
      eps: stock.eps?.toString() || '',
      peHigh: stock.peHigh?.toString() || '',
      peMid: stock.peMid?.toString() || '',
      peLow: stock.peLow?.toString() || '',
      conditionPrice1: stock.conditionPrice1?.toString() || '',
      conditionPrice2: stock.conditionPrice2?.toString() || '',
    })
    setForecast(null)
    setEditModal(true)
  }

  const handleFetchEps = async () => {
    if (!activeStock) return
    setFetchingEps(true)
    try {
      const result = await fetchEpsForecast(activeStock.code)
      if (result && result.forecasts.length > 0) {
        setForecast(result)
      } else {
        setForecast(null)
        alert('未找到该股票的机构预测数据')
      }
    } finally {
      setFetchingEps(false)
    }
  }

  const applyForecastEps = (eps: number) => {
    setForm({ ...form, eps: eps.toString() })
  }

  const handleSave = async () => {
    if (!selected) return
    await updateStock(selected, {
      eps: form.eps ? parseFloat(form.eps) : null,
      peHigh: form.peHigh ? parseFloat(form.peHigh) : null,
      peMid: form.peMid ? parseFloat(form.peMid) : null,
      peLow: form.peLow ? parseFloat(form.peLow) : null,
      conditionPrice1: form.conditionPrice1 ? parseFloat(form.conditionPrice1) : null,
      conditionPrice2: form.conditionPrice2 ? parseFloat(form.conditionPrice2) : null,
      valuationUpdatedAt: new Date().toISOString().split('T')[0],
    })
    setEditModal(false)
  }

  const activeStock = selected ? stocks.find((s) => s.id === selected) : null
  const activePrice = activeStock ? prices[activeStock.code] || 0 : 0

  // Filter stocks by tab
  const visibleStocks = stocks.filter((s) => {
    if (s.status === 'cleared') return false
    if (tab === 'all') return true
    return s.status === tab
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg md:text-xl font-semibold shrink-0">估值模型</h2>
        <div className="flex gap-1 bg-bg-tertiary rounded-lg p-1">
          {(['holding', 'watching', 'all'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setSelected(null) }}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors whitespace-nowrap ${
                tab === t ? 'bg-accent text-white' : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {t === 'holding' ? '持仓中' : t === 'watching' ? '观察中' : '全部'}
            </button>
          ))}
        </div>
      </div>

      {visibleStocks.length === 0 ? (
        <div className="text-center py-16 text-text-muted">
          <p className="text-lg">暂无{tab === 'holding' ? '持仓' : tab === 'watching' ? '观察' : ''}股票</p>
          <p className="text-sm mt-2">请先在「股票管理」中添加股票</p>
        </div>
      ) : (
        <div className="flex flex-col md:grid md:grid-cols-12 gap-4">
          {/* Left: stock list */}
          <div className="md:col-span-4 bg-bg-secondary rounded-xl border border-border overflow-hidden">
            <div className="max-h-60 md:max-h-[calc(100vh-12rem)] overflow-auto">
              {visibleStocks.map((stock) => {
                const hasValuation = stock.eps && stock.peHigh && stock.peMid && stock.peLow
                return (
                  <div
                    key={stock.id}
                    onClick={() => setSelected(stock.id)}
                    className={`flex items-center justify-between px-4 py-3 border-b border-border/50 cursor-pointer transition-colors ${
                      selected === stock.id ? 'bg-accent/10' : 'hover:bg-bg-hover'
                    }`}
                  >
                    <div>
                      <div className="text-sm font-medium text-text-primary">{stock.name}</div>
                      <div className="text-xs text-text-muted">
                        {stock.code} · {stock.industry || '未分类'}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {hasValuation ? (
                        <span className="text-xs text-loss bg-loss/10 px-1.5 py-0.5 rounded">已估值</span>
                      ) : (
                        <span className="text-xs text-text-muted bg-text-muted/10 px-1.5 py-0.5 rounded">未估值</span>
                      )}
                      {stock.valuationUpdatedAt && (
                        <span className="text-[10px] text-text-muted">{stock.valuationUpdatedAt}</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Right: valuation detail */}
          <div className="md:col-span-8 bg-bg-secondary rounded-xl border border-border p-4 md:p-6">
            {activeStock ? (
              <ValuationDetail stock={activeStock} currentPrice={activePrice} currentPe={activeStock ? peData[activeStock.code] || 0 : 0} onEdit={() => openEdit(activeStock)} />
            ) : (
              <div className="text-center py-16 text-text-muted text-sm">选择左侧股票查看估值详情</div>
            )}
          </div>
        </div>
      )}

      {/* Edit valuation modal */}
      <Modal open={editModal} onClose={() => setEditModal(false)} title="编辑估值参数">
        <div className="space-y-4">
          {/* EPS with auto-fetch */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-text-muted">预计EPS</label>
              <button
                onClick={handleFetchEps}
                disabled={fetchingEps}
                className="flex items-center gap-1 text-xs text-accent hover:text-accent-hover transition-colors disabled:opacity-50"
              >
                <Download size={12} />
                {fetchingEps ? '获取中...' : '获取机构预测'}
              </button>
            </div>
            <input
              type="number"
              value={form.eps}
              onChange={(e) => setForm({ ...form, eps: e.target.value })}
              placeholder="4.48"
              className="w-full bg-bg-tertiary border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted/50 focus:outline-none focus:border-accent"
            />
            {/* Forecast results */}
            {forecast && (
              <div className="mt-2 bg-bg-tertiary rounded-lg p-3">
                <div className="text-xs text-text-muted mb-2">
                  {forecast.stockName} · {forecast.analystCount}家机构一致预测
                </div>
                <div className="flex flex-wrap gap-2">
                  {forecast.forecasts.map((f) => (
                    <button
                      key={f.year}
                      onClick={() => applyForecastEps(f.eps)}
                      className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
                        form.eps === f.eps.toString()
                          ? 'border-accent bg-accent/10 text-accent'
                          : 'border-border hover:border-accent/50 text-text-primary'
                      }`}
                    >
                      {f.year}{f.isActual ? '(实)' : '(预)'}: {f.eps}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="低估PE" value={form.peLow} onChange={(v) => setForm({ ...form, peLow: v })} type="number" placeholder="18" />
            <Field label="中估PE" value={form.peMid} onChange={(v) => setForm({ ...form, peMid: v })} type="number" placeholder="25" />
            <Field label="高估PE" value={form.peHigh} onChange={(v) => setForm({ ...form, peHigh: v })} type="number" placeholder="33.86" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="条件单1" value={form.conditionPrice1} onChange={(v) => setForm({ ...form, conditionPrice1: v })} type="number" placeholder="选填" />
            <Field label="条件单2" value={form.conditionPrice2} onChange={(v) => setForm({ ...form, conditionPrice2: v })} type="number" placeholder="选填" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setEditModal(false)} className="px-4 py-2 text-text-secondary hover:text-text-primary text-sm transition-colors">
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

function ValuationDetail({ stock, currentPrice, currentPe, onEdit }: { stock: Stock; currentPrice: number; currentPe: number; onEdit: () => void }) {
  const hasValuation = stock.eps && stock.peHigh && stock.peMid && stock.peLow

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold">
            {stock.name} <span className="text-sm text-text-muted font-normal">{stock.code}</span>
          </h3>
          <p className="text-sm text-text-muted mt-1">
            {stock.industry || '未分类'} · 评级: {stock.tier === 'core' ? '核心' : stock.tier === 'high' ? '高' : stock.tier === 'mid' ? '中' : '低'} ({TIER_PCT[stock.tier]}%)
            {currentPrice > 0 && (
              <span className="ml-2">· 现价: <span className="text-text-primary font-mono">{currentPrice.toFixed(2)}</span></span>
            )}
            {currentPe > 0 && (
              <span className="ml-2">· PE(TTM): <span className="text-text-primary font-mono">{currentPe.toFixed(2)}</span></span>
            )}
            {stock.valuationUpdatedAt && (
              <span className="ml-2">· 估值更新: <span className="text-text-primary">{stock.valuationUpdatedAt}</span></span>
            )}
          </p>
        </div>
        <button
          onClick={onEdit}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary bg-bg-tertiary hover:bg-bg-hover rounded-lg transition-colors"
        >
          <Edit2 size={14} /> 编辑估值
        </button>
      </div>

      {/* Valuation params */}
      <div>
        <h4 className="text-sm font-medium text-text-secondary mb-2">估值参数</h4>
        <div className="grid grid-cols-4 gap-3 text-sm">
          <div className="bg-bg-tertiary rounded-lg p-3">
            <div className="text-text-muted text-xs">预计EPS</div>
            <div className="font-mono mt-1">{stock.eps ?? '-'}</div>
          </div>
          <div className="bg-bg-tertiary rounded-lg p-3">
            <div className="text-text-muted text-xs">低估PE</div>
            <div className="font-mono mt-1">{stock.peLow ?? '-'}</div>
          </div>
          <div className="bg-bg-tertiary rounded-lg p-3">
            <div className="text-text-muted text-xs">中估PE</div>
            <div className="font-mono mt-1">{stock.peMid ?? '-'}</div>
          </div>
          <div className="bg-bg-tertiary rounded-lg p-3">
            <div className="text-text-muted text-xs">高估PE</div>
            <div className="font-mono mt-1">{stock.peHigh ?? '-'}</div>
          </div>
        </div>
      </div>

      {/* Condition prices */}
      {(stock.conditionPrice1 || stock.conditionPrice2) && (
        <div>
          <h4 className="text-sm font-medium text-text-secondary mb-2">条件单</h4>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-bg-tertiary rounded-lg p-3">
              <div className="text-text-muted text-xs">条件单1</div>
              <div className="font-mono mt-1">{stock.conditionPrice1 ?? '-'}</div>
            </div>
            <div className="bg-bg-tertiary rounded-lg p-3">
              <div className="text-text-muted text-xs">条件单2</div>
              <div className="font-mono mt-1">{stock.conditionPrice2 ?? '-'}</div>
            </div>
          </div>
        </div>
      )}

      {/* 9 target prices */}
      {hasValuation ? (
        <div>
          <h4 className="text-sm font-medium text-text-secondary mb-2">9 档目标价格</h4>
          {(() => {
            const vp = calcValuationPrices(stock.eps!, stock.peHigh!, stock.peMid!, stock.peLow!)
            const comparisons = currentPrice > 0 ? calcValuationComparisons(vp, currentPrice) : null
            // Rows: low PE -> mid PE -> high PE (most important buy zone first)
            const rows = [
              { key: 'low' as const, label: '低估PE', compIdx: 2 },
              { key: 'mid' as const, label: '中估PE', compIdx: 1 },
              { key: 'high' as const, label: '高估PE', compIdx: 0 },
            ]
            // Columns: P3 (低吸价) -> P2 (打折价) -> P1 (合理价)
            const cols = [
              { key: 'p3' as const, label: '低吸价', compIdx: 2 },
              { key: 'p2' as const, label: '打折价', compIdx: 1 },
              { key: 'p1' as const, label: '合理价', compIdx: 0 },
            ]

            return (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-text-muted text-xs">
                    <th className="text-left py-2 font-medium"></th>
                    {cols.map((col) => (
                      <th key={col.key} className="text-right py-2 font-medium">{col.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.key} className="border-t border-border/30">
                      <td className="py-2 text-text-muted text-xs">{row.label}</td>
                      {cols.map((col) => {
                        const price = vp[row.key][col.key]
                        const comp = comparisons?.[row.compIdx]?.[col.compIdx]
                        const pctColor = !comp ? '' :
                          comp.diff > 0 ? 'text-profit' :
                          comp.diff < 0 ? 'text-loss' : 'text-text-muted'
                        return (
                          <td key={col.key} className="text-right py-2 font-mono text-text-primary">
                            {price.toFixed(2)}
                            {comp && (
                              <span className={`text-xs ml-1 ${pctColor}`}>({comp.diff > 0 ? '+' : ''}{comp.diff}%)</span>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          })()}
        </div>
      ) : (
        <div className="text-center py-8 text-text-muted bg-bg-tertiary rounded-lg">
          <p className="text-sm">尚未设置估值参数</p>
          <p className="text-xs mt-1">点击右上角「编辑估值」填入 EPS 和 PE 数据</p>
        </div>
      )}
    </div>
  )
}

function Field({ label, value, onChange, type = 'text', placeholder }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string
}) {
  return (
    <div>
      <label className="block text-xs text-text-muted mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-bg-tertiary border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted/50 focus:outline-none focus:border-accent"
      />
    </div>
  )
}
