import { useState, useMemo } from 'react'
import { useData } from '../context/DataContext'
import { computeClearedSummaries } from '../lib/calculations'
import PnlText from '../components/common/PnlText'
import { ChevronDown, ChevronRight } from 'lucide-react'

export default function History() {
  const { stocks, trades } = useData()
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [filterYear, setFilterYear] = useState('')
  const [filterStock, setFilterStock] = useState('')

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const summaries = useMemo(() => {
    let result = computeClearedSummaries(stocks, trades)
    if (filterYear) {
      result = result.filter((s) => s.lastSellDate.startsWith(filterYear))
    }
    if (filterStock) {
      result = result.filter((s) => s.stock.id === filterStock)
    }
    return result.sort((a, b) => b.lastSellDate.localeCompare(a.lastSellDate))
  }, [stocks, trades, filterYear, filterStock])

  const years = useMemo(() => {
    const yrs = new Set<string>()
    for (const s of computeClearedSummaries(stocks, trades)) {
      if (s.lastSellDate) yrs.add(s.lastSellDate.substring(0, 4))
    }
    return [...yrs].sort().reverse()
  }, [stocks, trades])

  const clearedStocks = stocks.filter((s) => s.status === 'cleared')

  // Summary stats
  const totalPnl = summaries.reduce((s, c) => s + c.pnlAmount, 0)
  const totalInvested = summaries.reduce((s, c) => s + c.totalInvested, 0)
  const winCount = summaries.filter((s) => s.pnlAmount > 0).length

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">清仓记录</h2>

      {/* Filters */}
      <div className="flex gap-3">
        <select
          value={filterYear}
          onChange={(e) => setFilterYear(e.target.value)}
          className="bg-bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-text-primary"
        >
          <option value="">全部年度</option>
          {years.map((y) => <option key={y} value={y}>{y}年</option>)}
        </select>
        <select
          value={filterStock}
          onChange={(e) => setFilterStock(e.target.value)}
          className="bg-bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-text-primary"
        >
          <option value="">全部股票</option>
          {clearedStocks.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      {/* Summary stats */}
      {summaries.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-bg-secondary rounded-xl border border-border p-4">
            <div className="text-xs text-text-muted">清仓笔数</div>
            <div className="text-lg font-bold mt-1">{summaries.length}</div>
          </div>
          <div className="bg-bg-secondary rounded-xl border border-border p-4">
            <div className="text-xs text-text-muted">胜率</div>
            <div className="text-lg font-bold mt-1">{summaries.length > 0 ? ((winCount / summaries.length) * 100).toFixed(0) : 0}%</div>
          </div>
          <div className="bg-bg-secondary rounded-xl border border-border p-4">
            <div className="text-xs text-text-muted">总盈亏</div>
            <div className="text-lg font-bold mt-1"><PnlText value={totalPnl} /></div>
          </div>
          <div className="bg-bg-secondary rounded-xl border border-border p-4">
            <div className="text-xs text-text-muted">总投入</div>
            <div className="text-lg font-bold mt-1">¥{totalInvested.toLocaleString()}</div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-bg-secondary rounded-xl border border-border overflow-x-auto">
        <table className="w-full text-sm min-w-[800px]">
          <thead>
            <tr className="border-b border-border text-text-muted">
              <th className="text-left px-4 py-3 font-medium w-8"></th>
              <th className="text-left px-4 py-3 font-medium">股票</th>
              <th className="text-center px-4 py-3 font-medium">交易次数</th>
              <th className="text-center px-4 py-3 font-medium">建仓日期</th>
              <th className="text-center px-4 py-3 font-medium">清仓日期</th>
              <th className="text-center px-4 py-3 font-medium">持仓天数</th>
              <th className="text-right px-4 py-3 font-medium">投入金额</th>
              <th className="text-right px-4 py-3 font-medium">收回金额</th>
              <th className="text-right px-4 py-3 font-medium">盈亏</th>
              <th className="text-right px-4 py-3 font-medium">年化</th>
            </tr>
          </thead>
          <tbody>
            {summaries.length === 0 ? (
              <tr>
                <td colSpan={10} className="text-center py-12 text-text-muted">暂无清仓记录</td>
              </tr>
            ) : (
              summaries.map((s) => {
                const isExpanded = expanded.has(s.stock.id)
                return (
                  <>
                    <tr
                      key={s.stock.id}
                      className="border-b border-border/50 hover:bg-bg-hover/50 cursor-pointer"
                      onClick={() => toggle(s.stock.id)}
                    >
                      <td className="px-4 py-3 text-text-muted">
                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-text-primary">{s.stock.name}</div>
                        <div className="text-xs text-text-muted">{s.stock.industry}</div>
                      </td>
                      <td className="text-center px-4 py-3 font-mono">{s.tradeCount}</td>
                      <td className="text-center px-4 py-3 font-mono text-text-secondary">{s.firstBuyDate}</td>
                      <td className="text-center px-4 py-3 font-mono text-text-secondary">{s.lastSellDate}</td>
                      <td className="text-center px-4 py-3 font-mono">{s.holdingDays}天</td>
                      <td className="text-right px-4 py-3 font-mono">¥{s.totalInvested.toLocaleString()}</td>
                      <td className="text-right px-4 py-3 font-mono">¥{s.totalReceived.toLocaleString()}</td>
                      <td className="text-right px-4 py-3">
                        <PnlText value={s.pnlAmount} className="font-mono" />
                        <br />
                        <PnlText value={s.pnlPct} suffix="%" className="text-xs" />
                      </td>
                      <td className="text-right px-4 py-3">
                        <PnlText value={s.annualizedPnlPct} suffix="%" className="font-mono" />
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr key={`${s.stock.id}-detail`}>
                        <td colSpan={10} className="bg-bg-tertiary/50 px-8 py-4">
                          <h4 className="text-xs font-medium text-text-muted mb-2">交易明细</h4>
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-text-muted">
                                <th className="text-left py-1">日期</th>
                                <th className="text-center py-1">类型</th>
                                <th className="text-right py-1">价格</th>
                                <th className="text-right py-1">数量</th>
                                <th className="text-right py-1">金额</th>
                                <th className="text-left py-1">备注</th>
                              </tr>
                            </thead>
                            <tbody>
                              {s.trades.map((t) => (
                                <tr key={t.id} className="border-t border-border/30">
                                  <td className="py-1.5">{t.tradeDate}</td>
                                  <td className="text-center">
                                    <span className={t.type === 'buy' ? 'text-profit' : 'text-loss'}>
                                      {t.type === 'buy' ? '买入' : '卖出'}
                                    </span>
                                  </td>
                                  <td className="text-right font-mono">{t.price.toFixed(3)}</td>
                                  <td className="text-right font-mono">{t.quantity}</td>
                                  <td className="text-right font-mono">¥{(t.price * t.quantity).toLocaleString()}</td>
                                  <td className="text-text-muted">{t.notes || '-'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                  </>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
