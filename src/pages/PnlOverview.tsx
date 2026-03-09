import { useState } from 'react'
import { useData } from '../context/DataContext'
import type { PositionSummary, Stock, LotInfo } from '../types'

type Tab = 'holding' | 'watching' | 'all'

export default function PnlOverview() {
  const { portfolioStats, stocks, prices } = useData()
  const [tab, setTab] = useState<Tab>('holding')

  const watchingStocks = stocks.filter((s) => s.status === 'watching')
  const positions = portfolioStats.positions

  const showHolding = tab === 'holding' || tab === 'all'
  const showWatching = tab === 'watching' || tab === 'all'
  const hasHolding = showHolding && positions.length > 0
  const hasWatching = showWatching && watchingStocks.length > 0

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg lg:text-xl font-semibold shrink-0">盈亏总览</h2>
        <div className="flex gap-1 bg-bg-tertiary rounded-lg p-1">
          {(['holding', 'watching', 'all'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors whitespace-nowrap ${
                tab === t ? 'bg-accent text-white' : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {t === 'holding' ? '持仓中' : t === 'watching' ? '观察中' : '全部'}
            </button>
          ))}
        </div>
      </div>

      {hasHolding && (
        <div className="space-y-2">
          {tab === 'all' && <h3 className="text-xs font-medium text-text-muted uppercase tracking-wider">持仓中</h3>}
          {[...positions].sort((a, b) => b.marketValue - a.marketValue).map((pos) => (
            <HoldingCard
              key={pos.stock.id}
              pos={pos}
              currentPrice={prices[pos.stock.code] || pos.marketPrice}
            />
          ))}
        </div>
      )}

      {hasWatching && (
        <div className="space-y-2">
          {tab === 'all' && <h3 className="text-xs font-medium text-text-muted uppercase tracking-wider mt-3">观察中</h3>}
          {watchingStocks.map((stock) => (
            <WatchingCard
              key={stock.id}
              stock={stock}
              currentPrice={prices[stock.code] || 0}
            />
          ))}
        </div>
      )}

      {!hasHolding && !hasWatching && (
        <div className="text-center py-16 text-text-muted">
          <p>暂无{tab === 'holding' ? '持仓' : tab === 'watching' ? '观察' : ''}数据</p>
        </div>
      )}
    </div>
  )
}

// --- Helpers ---
function lotBg(pnlPct: number): string {
  const abs = Math.abs(pnlPct)
  const opacity = abs < 3 ? 0.08 : abs < 8 ? 0.15 : abs < 15 ? 0.25 : abs < 25 ? 0.35 : 0.45
  if (pnlPct > 0) return `rgba(220, 38, 38, ${opacity})`
  if (pnlPct < 0) return `rgba(22, 163, 74, ${opacity})`
  return 'rgba(128, 128, 128, 0.08)'
}

function distPct(target: number, current: number): number {
  if (current <= 0) return 0
  return Math.round(((target - current) / current) * 1000) / 10
}

function fmtDate(d: string): string {
  // "2024-06-15" -> "24/06/15"
  const [y, m, dd] = d.split('-')
  return `${y.slice(2)}/${m}/${dd}`
}

// --- Lot block ---
function LotBlock({ lot, index }: { lot: LotInfo; index: number }) {
  const pct = lot.floatingPnlPct
  const textColor = pct > 0 ? 'text-profit' : pct < 0 ? 'text-loss' : 'text-text-muted'
  return (
    <div
      className="rounded-lg px-2.5 py-2 min-w-[4.5rem] text-center relative"
      style={{ backgroundColor: lotBg(pct) }}
    >
      <span className="absolute top-0.5 left-1.5 text-[10px] text-text-muted/60 font-mono">{index + 1}</span>
      <div className="text-[10px] text-text-muted mt-1">{fmtDate(lot.buyDate)}</div>
      <div className="text-xs text-text-secondary font-mono">{lot.buyPrice.toFixed(2)}</div>
      <div className={`text-sm font-mono font-semibold ${textColor}`}>
        {pct > 0 ? '+' : ''}{pct.toFixed(1)}%
      </div>
    </div>
  )
}

// --- Inline condition price ---
function CondTag({ label, price, dist }: { label: string; price: number | null; dist: number | null }) {
  if (price == null) return null
  const distColor = dist != null ? (dist > 0 ? 'text-profit' : dist < 0 ? 'text-loss' : 'text-text-muted') : ''
  return (
    <span className="inline-flex items-center gap-1 text-sm">
      <span className="text-xs text-text-muted">{label}</span>
      <span className="font-mono text-text-primary">{price}</span>
      {dist !== null && (
        <span className={`font-mono text-xs ${distColor}`}>{dist > 0 ? '+' : ''}{dist.toFixed(1)}%</span>
      )}
    </span>
  )
}

// --- Holding card: info row + lot blocks row ---
function HoldingCard({ pos, currentPrice }: { pos: PositionSummary; currentPrice: number }) {
  const { stock } = pos
  const cond1 = stock.conditionPrice1
  const cond2 = stock.conditionPrice2
  const d1 = cond1 != null && currentPrice > 0 ? distPct(cond1, currentPrice) : null
  const d2 = cond2 != null && currentPrice > 0 ? distPct(cond2, currentPrice) : null

  return (
    <div className="bg-bg-secondary rounded-xl border border-border px-5 py-3 space-y-2.5">
      {/* Info row: all text info in one line */}
      <div className="flex items-center flex-wrap gap-x-5 gap-y-1">
        <div className="flex items-baseline gap-1.5">
          <span className="font-semibold text-text-primary">{stock.name}</span>
          <span className="text-xs text-text-muted">{stock.code}</span>
        </div>
        <span className="text-sm">
          <span className="text-xs text-text-muted">仓位 </span>
          <span className="font-mono text-text-primary">{pos.positionPct.toFixed(1)}%</span>
          <span className="text-text-muted">/{pos.targetPct}%</span>
        </span>
        <span className="text-sm">
          <span className="text-xs text-text-muted">现价 </span>
          <span className="font-mono font-semibold text-text-primary">{currentPrice.toFixed(2)}</span>
        </span>
        <CondTag label="买入" price={cond1} dist={d1} />
        <CondTag label="卖出" price={cond2} dist={d2} />
      </div>

      {/* Lot blocks row */}
      {pos.lots.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {[...pos.lots].sort((a, b) => b.buyDate.localeCompare(a.buyDate)).map((lot, i) => (
            <LotBlock key={i} lot={lot} index={i} />
          ))}
        </div>
      )}
    </div>
  )
}

// --- Watching card: same info row style, no lots ---
function WatchingCard({ stock, currentPrice }: { stock: Stock; currentPrice: number }) {
  const cond1 = stock.conditionPrice1
  const cond2 = stock.conditionPrice2
  const d1 = cond1 != null && currentPrice > 0 ? distPct(cond1, currentPrice) : null
  const d2 = cond2 != null && currentPrice > 0 ? distPct(cond2, currentPrice) : null

  return (
    <div className="bg-bg-secondary rounded-xl border border-border px-5 py-3">
      <div className="flex items-center flex-wrap gap-x-5 gap-y-1">
        <div className="flex items-baseline gap-1.5">
          <span className="font-semibold text-text-primary text-sm">{stock.name}</span>
          <span className="text-xs text-text-muted">{stock.code}</span>
        </div>
        <span className="text-sm">
          <span className="text-xs text-text-muted">现价 </span>
          <span className="font-mono text-text-primary">{currentPrice > 0 ? currentPrice.toFixed(2) : '-'}</span>
        </span>
        <CondTag label="买入" price={cond1} dist={d1} />
        <CondTag label="卖出" price={cond2} dist={d2} />
      </div>
    </div>
  )
}
