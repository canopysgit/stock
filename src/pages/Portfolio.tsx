import { useState } from 'react'
import { useData } from '../context/DataContext'
import { calcValuationPrices, calcValuationComparisons, computeLots } from '../lib/calculations'
import PnlText from '../components/common/PnlText'
import Modal from '../components/common/Modal'
import type { PositionSummary } from '../types'
import { ChevronDown, ChevronRight, Eye, Wrench } from 'lucide-react'

type Tab = 'holding' | 'watching' | 'all'

export default function Portfolio() {
  const { portfolioStats, stocks, trades, prices, addTrade } = useData()
  const [tab, setTab] = useState<Tab>('holding')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [adjustModal, setAdjustModal] = useState<PositionSummary | null>(null)
  const [targetAvgCost, setTargetAvgCost] = useState('')

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const openAdjust = (pos: PositionSummary) => {
    setAdjustModal(pos)
    setTargetAvgCost(pos.avgCost.toFixed(3))
  }

  const handleAdjustSave = async () => {
    if (!adjustModal) return
    const target = parseFloat(targetAvgCost)
    if (isNaN(target) || target <= 0) return
    const delta = target - adjustModal.avgCost
    if (Math.abs(delta) < 0.001) { setAdjustModal(null); return }

    await addTrade({
      stockId: adjustModal.stock.id,
      type: 'adjust',
      tradeDate: new Date().toISOString().split('T')[0],
      price: Math.round(delta * 1000) / 1000,
      quantity: 0,
      notes: `均价调整: ${adjustModal.avgCost.toFixed(3)} -> ${target.toFixed(3)}`,
    })
    setAdjustModal(null)
  }

  const watchingStocks = stocks.filter((s) => s.status === 'watching')

  const displayPositions = tab === 'holding'
    ? portfolioStats.positions
    : tab === 'watching'
    ? []
    : portfolioStats.positions

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">投资组合</h2>
        <div className="flex gap-1 bg-bg-tertiary rounded-lg p-1">
          {(['holding', 'watching', 'all'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                tab === t ? 'bg-accent text-white' : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {t === 'holding' ? '持仓中' : t === 'watching' ? '观察中' : '全部'}
            </button>
          ))}
        </div>
      </div>

      {/* Holdings table */}
      {(tab === 'holding' || tab === 'all') && displayPositions.length > 0 && (
        <div className="bg-bg-secondary rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-text-muted">
                <th className="text-left px-4 py-3 font-medium w-8"></th>
                <th className="text-left px-4 py-3 font-medium">股票</th>
                <th className="text-right px-4 py-3 font-medium">现价</th>
                <th className="text-right px-4 py-3 font-medium">持仓量</th>
                <th className="text-right px-4 py-3 font-medium">均价</th>
                <th className="text-right px-4 py-3 font-medium">成本</th>
                <th className="text-right px-4 py-3 font-medium">市值</th>
                <th className="text-right px-4 py-3 font-medium">浮动盈亏</th>
                <th className="text-right px-4 py-3 font-medium">仓位</th>
                <th className="text-right px-4 py-3 font-medium">加减仓</th>
              </tr>
            </thead>
            <tbody>
              {displayPositions.map((pos) => (
                <PositionRow key={pos.stock.id} pos={pos} expanded={expanded.has(pos.stock.id)} onToggle={() => toggle(pos.stock.id)} onAdjust={() => openAdjust(pos)} />
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-border font-medium">
                <td colSpan={5} className="px-4 py-3 text-text-muted">合计</td>
                <td className="text-right px-4 py-3">¥{portfolioStats.totalCost.toLocaleString()}</td>
                <td className="text-right px-4 py-3">¥{portfolioStats.totalMarketValue.toLocaleString()}</td>
                <td className="text-right px-4 py-3">
                  <PnlText value={portfolioStats.totalPnl} />
                  <br />
                  <PnlText value={portfolioStats.totalPnlPct} suffix="%" className="text-xs" />
                </td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Watching table */}
      {(tab === 'watching' || tab === 'all') && watchingStocks.length > 0 && (
        <div className="space-y-2">
          {tab === 'all' && <h3 className="text-sm font-medium text-text-secondary mt-4">观察列表</h3>}
          <div className="bg-bg-secondary rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-text-muted">
                  <th className="text-left px-4 py-3 font-medium w-8"></th>
                  <th className="text-left px-4 py-3 font-medium">股票</th>
                  <th className="text-right px-4 py-3 font-medium">现价</th>
                  <th className="text-right px-4 py-3 font-medium">条件单1</th>
                  <th className="text-right px-4 py-3 font-medium">条件单2</th>
                  <th className="text-right px-4 py-3 font-medium">目标仓位</th>
                  <th className="text-right px-4 py-3 font-medium">评级</th>
                  <th className="text-left px-4 py-3 font-medium">备注</th>
                </tr>
              </thead>
              <tbody>
                {watchingStocks.map((stock) => {
                  const currentPrice = prices[stock.code] || 0
                  const isExpanded = expanded.has(stock.id)
                  return (
                    <WatchRow key={stock.id} stock={stock} currentPrice={currentPrice} expanded={isExpanded} onToggle={() => toggle(stock.id)} />
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {displayPositions.length === 0 && watchingStocks.length === 0 && (
        <div className="text-center py-16 text-text-muted">
          <p>暂无{tab === 'holding' ? '持仓' : tab === 'watching' ? '观察' : ''}数据</p>
        </div>
      )}

      {/* Cost adjustment modal */}
      <Modal open={!!adjustModal} onClose={() => setAdjustModal(null)} title="调整均价成本">
        {adjustModal && (
          <div className="space-y-4">
            <div className="bg-bg-tertiary rounded-lg p-3 text-sm">
              <div className="text-text-primary font-medium">{adjustModal.stock.name} ({adjustModal.stock.code})</div>
              <div className="text-text-muted text-xs mt-1">
                持仓 {adjustModal.totalQty} 股 · 当前均价 <span className="font-mono text-text-primary">{adjustModal.avgCost.toFixed(3)}</span> · 总成本 <span className="font-mono">¥{adjustModal.totalCost.toLocaleString()}</span>
              </div>
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">目标均价</label>
              <input
                type="number"
                step="0.001"
                value={targetAvgCost}
                onChange={(e) => setTargetAvgCost(e.target.value)}
                placeholder="输入正确的均价"
                className="w-full bg-bg-tertiary border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted/50 focus:outline-none focus:border-accent"
              />
            </div>
            {targetAvgCost && !isNaN(parseFloat(targetAvgCost)) && (
              <div className="text-sm text-text-secondary space-y-1">
                <div>调整后均价: <span className="font-mono text-text-primary">{parseFloat(targetAvgCost).toFixed(3)}</span></div>
                <div>调整后总成本: <span className="font-mono text-text-primary">¥{(parseFloat(targetAvgCost) * adjustModal.totalQty).toLocaleString()}</span></div>
                <div>每股调整: <span className="font-mono text-text-primary">{(parseFloat(targetAvgCost) - adjustModal.avgCost) > 0 ? '+' : ''}{(parseFloat(targetAvgCost) - adjustModal.avgCost).toFixed(3)}</span></div>
              </div>
            )}
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setAdjustModal(null)} className="px-4 py-2 text-text-secondary hover:text-text-primary text-sm transition-colors">
                取消
              </button>
              <button onClick={handleAdjustSave} className="px-6 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm transition-colors">
                确认调整
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

function PositionRow({ pos, expanded, onToggle, onAdjust }: { pos: PositionSummary; expanded: boolean; onToggle: () => void; onAdjust: () => void }) {
  const { prices } = useData()
  const currentPrice = prices[pos.stock.code] || pos.marketPrice
  const tierLabel = pos.stock.tier === 'high' ? '高' : pos.stock.tier === 'mid' ? '中' : '低'

  return (
    <>
      <tr className="border-b border-border/50 hover:bg-bg-hover/50 cursor-pointer" onClick={onToggle}>
        <td className="px-4 py-3 text-text-muted">
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </td>
        <td className="px-4 py-3">
          <div className="font-medium text-text-primary">{pos.stock.name}</div>
          <div className="text-xs text-text-muted">{pos.stock.code} · {pos.stock.industry} · {tierLabel}</div>
        </td>
        <td className="text-right px-4 py-3 font-mono">{currentPrice.toFixed(2)}</td>
        <td className="text-right px-4 py-3 font-mono">{pos.totalQty}</td>
        <td className="text-right px-4 py-3">
          <span className="font-mono">{pos.avgCost.toFixed(3)}</span>
          <button
            onClick={(e) => { e.stopPropagation(); onAdjust() }}
            className="ml-1 p-0.5 text-text-muted hover:text-accent inline-block align-middle"
            title="调整成本"
          >
            <Wrench size={12} />
          </button>
        </td>
        <td className="text-right px-4 py-3 font-mono">¥{pos.totalCost.toLocaleString()}</td>
        <td className="text-right px-4 py-3 font-mono">¥{pos.marketValue.toLocaleString()}</td>
        <td className="text-right px-4 py-3">
          <PnlText value={pos.floatingPnl} className="font-mono" />
          <br />
          <PnlText value={pos.floatingPnlPct} suffix="%" className="text-xs" />
        </td>
        <td className="text-right px-4 py-3">
          <span className="font-mono">{pos.positionPct.toFixed(1)}%</span>
          <span className="text-text-muted text-xs"> / {pos.targetPct}%</span>
        </td>
        <td className="text-right px-4 py-3">
          <PnlText value={pos.adjustPct} suffix="%" className="text-xs" />
          <br />
          <span className="text-xs text-text-muted">¥{Math.abs(pos.adjustAmount).toLocaleString()}</span>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={10} className="bg-bg-tertiary/50 px-8 py-4">
            <ExpandedDetail pos={pos} />
          </td>
        </tr>
      )}
    </>
  )
}

function ExpandedDetail({ pos }: { pos: PositionSummary }) {
  const { prices } = useData()
  const currentPrice = prices[pos.stock.code] || pos.marketPrice

  // Valuation panel
  let valuationPanel = null
  if (pos.stock.eps && pos.stock.peHigh && pos.stock.peMid && pos.stock.peLow) {
    const vp = calcValuationPrices(pos.stock.eps, pos.stock.peHigh, pos.stock.peMid, pos.stock.peLow)
    const comparisons = calcValuationComparisons(vp, currentPrice)
    valuationPanel = (
      <div className="mt-4">
        <h4 className="text-xs font-medium text-text-muted mb-2">估值对比 (现价: {currentPrice.toFixed(2)})</h4>
        <div className="grid grid-cols-3 gap-2">
          {comparisons.map((row, i) => (
            <div key={i} className="space-y-1">
              {row.map((cell) => {
                const pctColor = cell.diff > 0 ? 'text-profit' : cell.diff < 0 ? 'text-loss' : 'text-text-muted'
                return (
                  <div key={cell.label} className="px-2 py-1 rounded text-xs bg-bg-tertiary/50">
                    <span className="text-text-primary">{cell.label} {cell.price}</span>
                    <span className={`float-right font-mono ${pctColor}`}>{cell.diff > 0 ? '+' : ''}{cell.diff}%</span>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Lot details */}
      <h4 className="text-xs font-medium text-text-muted mb-2">
        逐笔交易明细 {pos.lastBuyDate && <span className="ml-2">最近买入: {pos.lastBuyDate}</span>}
      </h4>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-text-muted">
            <th className="text-left py-1 pr-4">买入日期</th>
            <th className="text-right py-1 pr-4">买入价</th>
            <th className="text-right py-1 pr-4">原始量</th>
            <th className="text-right py-1 pr-4">剩余量</th>
            <th className="text-right py-1 pr-4">浮动盈亏</th>
            <th className="text-right py-1">盈亏比例</th>
          </tr>
        </thead>
        <tbody>
          {pos.lots.map((lot, i) => (
            <tr key={i} className="border-t border-border/30">
              <td className="py-1.5 pr-4">{lot.buyDate}</td>
              <td className="text-right pr-4 font-mono">{lot.buyPrice.toFixed(2)}</td>
              <td className="text-right pr-4 font-mono">{lot.originalQty}</td>
              <td className="text-right pr-4 font-mono">{lot.remainingQty}</td>
              <td className="text-right pr-4">
                <PnlText value={lot.floatingPnl} className="font-mono" />
              </td>
              <td className="text-right">
                <PnlText value={lot.floatingPnlPct} suffix="%" className="font-mono" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {pos.costAdjustment !== 0 && (
        <div className="mt-2 text-xs text-text-muted">
          成本调整: <span className="font-mono text-text-primary">{pos.costAdjustment > 0 ? '+' : ''}¥{pos.costAdjustment.toLocaleString()}</span>
          <span className="ml-2">(均价已按调整后计算，逐笔明细为原始买入价)</span>
        </div>
      )}
      {valuationPanel}
    </div>
  )
}

function WatchRow({ stock, currentPrice, expanded, onToggle }: {
  stock: any; currentPrice: number; expanded: boolean; onToggle: () => void
}) {
  const tierLabel = stock.tier === 'high' ? '高 (10%)' : stock.tier === 'mid' ? '中 (6%)' : '低 (3%)'

  let valuationPanel = null
  if (expanded && stock.eps && stock.peHigh && stock.peMid && stock.peLow && currentPrice > 0) {
    const vp = calcValuationPrices(stock.eps, stock.peHigh, stock.peMid, stock.peLow)
    const comparisons = calcValuationComparisons(vp, currentPrice)
    valuationPanel = (
      <tr>
        <td colSpan={8} className="bg-bg-tertiary/50 px-8 py-4">
          <h4 className="text-xs font-medium text-text-muted mb-2">估值对比 (现价: {currentPrice.toFixed(2)})</h4>
          <div className="grid grid-cols-3 gap-2">
            {comparisons.map((row, i) => (
              <div key={i} className="space-y-1">
                {row.map((cell) => {
                  const pctColor = cell.diff > 0 ? 'text-profit' : cell.diff < 0 ? 'text-loss' : 'text-text-muted'
                  return (
                    <div key={cell.label} className="px-2 py-1 rounded text-xs bg-bg-tertiary/50">
                      <span className="text-text-primary">{cell.label} {cell.price}</span>
                      <span className={`float-right font-mono ${pctColor}`}>{cell.diff > 0 ? '+' : ''}{cell.diff}%</span>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </td>
      </tr>
    )
  }

  return (
    <>
      <tr className="border-b border-border/50 hover:bg-bg-hover/50 cursor-pointer" onClick={onToggle}>
        <td className="px-4 py-3 text-text-muted">
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </td>
        <td className="px-4 py-3">
          <div className="font-medium text-text-primary">{stock.name}</div>
          <div className="text-xs text-text-muted">{stock.code} · {stock.industry}</div>
        </td>
        <td className="text-right px-4 py-3 font-mono">{currentPrice > 0 ? currentPrice.toFixed(2) : '-'}</td>
        <td className="text-right px-4 py-3 font-mono">{stock.conditionPrice1 ?? '-'}</td>
        <td className="text-right px-4 py-3 font-mono">{stock.conditionPrice2 ?? '-'}</td>
        <td className="text-right px-4 py-3">{tierLabel.split(' ')[1]}</td>
        <td className="text-right px-4 py-3 text-xs">{tierLabel.split(' ')[0]}</td>
        <td className="px-4 py-3 text-xs text-text-muted truncate max-w-32">{stock.notes || '-'}</td>
      </tr>
      {valuationPanel}
    </>
  )
}
