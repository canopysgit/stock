import { useState } from 'react'
import { useData } from '../context/DataContext'
import { TIER_PCT, calcValuationPrices } from '../lib/calculations'
import PnlText from '../components/common/PnlText'
import { TrendingUp, TrendingDown, Briefcase, AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react'

type AlertCategory = 'all' | 'condition' | 'sell' | 'buy' | 'overweight'
type AlertItem = { name: string; message: string; category: AlertCategory; excessPct: number }

const categoryLabels: Record<Exclude<AlertCategory, 'all'>, string> = {
  condition: '条件单买卖点',
  sell: '高估值卖出',
  buy: '低估值买入',
  overweight: '仓位超标',
}

const categoryColors: Record<Exclude<AlertCategory, 'all'>, string> = {
  condition: 'bg-accent/10 border-accent/30 text-accent',
  sell: 'bg-profit-bg border-profit/30 text-profit',
  buy: 'bg-loss-bg border-loss/30 text-loss',
  overweight: 'bg-warning-bg border-warning/30 text-warning',
}

export default function Dashboard() {
  const { portfolioStats, stocks, prices, settings } = useData()
  const { totalMarketValue, totalCost, totalPnl, totalPnlPct, totalCapital, holdingCount, positions } = portfolioStats
  const [alertFilter, setAlertFilter] = useState<AlertCategory>('all')
  const [alertsCollapsed, setAlertsCollapsed] = useState(false)

  const alerts: AlertItem[] = []

  for (const stock of stocks.filter((s) => s.status === 'watching' || s.status === 'holding')) {
    const currentPrice = prices[stock.code]
    if (!currentPrice) continue

    // Condition price alerts (条件单买卖点)
    if (stock.conditionPrice1 && currentPrice <= stock.conditionPrice1) {
      const pct = ((stock.conditionPrice1 - currentPrice) / currentPrice * 100)
      alerts.push({ name: stock.name, message: `现价 ${currentPrice} 已达条件单1买入价 ${stock.conditionPrice1}，低于 ${pct.toFixed(1)}%`, category: 'condition', excessPct: pct })
    }
    if (stock.conditionPrice2 && currentPrice >= stock.conditionPrice2) {
      const pct = ((currentPrice - stock.conditionPrice2) / stock.conditionPrice2 * 100)
      alerts.push({ name: stock.name, message: `现价 ${currentPrice} 已达条件单2卖出价 ${stock.conditionPrice2}，超过 ${pct.toFixed(1)}%`, category: 'condition', excessPct: pct })
    }

    if (!stock.eps || !stock.peHigh || !stock.peMid || !stock.peLow) continue
    const vp = calcValuationPrices(stock.eps, stock.peHigh, stock.peMid, stock.peLow)

    // Sell signal: high valuation
    if (currentPrice >= vp.high.p1) {
      const pct = ((currentPrice - vp.high.p1) / vp.high.p1 * 100)
      alerts.push({ name: stock.name, message: `现价 ${currentPrice} 已达高估合理价 ${vp.high.p1}，超过 ${pct.toFixed(1)}%`, category: 'sell', excessPct: pct })
    } else if (currentPrice >= vp.high.p2) {
      const pct = ((currentPrice - vp.high.p2) / vp.high.p2 * 100)
      alerts.push({ name: stock.name, message: `现价 ${currentPrice} 已达高估打折价 ${vp.high.p2}，超过 ${pct.toFixed(1)}%`, category: 'sell', excessPct: pct })
    }

    // Buy signal: low valuation
    if (currentPrice <= vp.low.p3) {
      const pct = ((vp.low.p3 - currentPrice) / currentPrice * 100)
      alerts.push({ name: stock.name, message: `现价 ${currentPrice} 已低于低估低吸价 ${vp.low.p3}，低于 ${pct.toFixed(1)}%`, category: 'buy', excessPct: pct })
    } else if (currentPrice <= vp.mid.p3) {
      const pct = ((vp.mid.p3 - currentPrice) / currentPrice * 100)
      alerts.push({ name: stock.name, message: `现价 ${currentPrice} 已低于中估低吸价 ${vp.mid.p3}，低于 ${pct.toFixed(1)}%`, category: 'buy', excessPct: pct })
    }
  }

  // Overweight alerts
  for (const pos of positions) {
    const target = TIER_PCT[pos.stock.tier]
    if (pos.positionPct > target + 1) {
      const pct = pos.positionPct - target
      alerts.push({
        name: pos.stock.name,
        message: `当前仓位 ${pos.positionPct.toFixed(1)}% 超过目标 ${target}%，超出 ${pct.toFixed(1)}%`,
        category: 'overweight',
        excessPct: pct,
      })
    }
  }

  // Sort alerts: group by category order, then by excessPct desc within each group
  const categoryOrder: Record<string, number> = { condition: 0, sell: 1, buy: 2, overweight: 3 }
  alerts.sort((a, b) => {
    const catDiff = (categoryOrder[a.category] ?? 9) - (categoryOrder[b.category] ?? 9)
    if (catDiff !== 0) return catDiff
    return b.excessPct - a.excessPct
  })

  const filteredAlerts = alertFilter === 'all' ? alerts : alerts.filter((a) => a.category === alertFilter)

  // Count per category
  const counts: Record<string, number> = {}
  for (const a of alerts) counts[a.category] = (counts[a.category] || 0) + 1

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">仪表盘</h2>

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="总市值" value={`¥${totalMarketValue.toLocaleString()}`} icon={<Briefcase size={20} />} />
        <StatCard label="总成本" value={`¥${totalCost.toLocaleString()}`} sub={`现金: ¥${settings.cashBalance.toLocaleString()}`} />
        <StatCard
          label="总浮动盈亏"
          value={<PnlText value={totalPnl} className="text-xl font-bold" />}
          sub={<PnlText value={totalPnlPct} suffix="%" className="text-sm" />}
          icon={totalPnl >= 0 ? <TrendingUp size={20} className="text-profit" /> : <TrendingDown size={20} className="text-loss" />}
        />
        <StatCard label="持仓数量" value={`${holdingCount} 只`} sub={`总资金: ¥${totalCapital.toLocaleString()}`} />
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3
              className="text-sm font-medium text-text-secondary flex items-center gap-2 cursor-pointer select-none"
              onClick={() => setAlertsCollapsed((v) => !v)}
            >
              {alertsCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
              <AlertTriangle size={16} /> 信号提醒 ({alerts.length})
            </h3>
            {!alertsCollapsed && (
              <div className="flex gap-1 bg-bg-tertiary rounded-lg p-1">
                <button
                  onClick={() => setAlertFilter('all')}
                  className={`px-2.5 py-1 text-xs rounded-md transition-colors ${alertFilter === 'all' ? 'bg-accent text-white' : 'text-text-secondary hover:text-text-primary'}`}
                >
                  全部 ({alerts.length})
                </button>
                {(['condition', 'sell', 'buy', 'overweight'] as const).map((cat) => (
                  counts[cat] ? (
                    <button
                      key={cat}
                      onClick={() => setAlertFilter(cat)}
                      className={`px-2.5 py-1 text-xs rounded-md transition-colors ${alertFilter === cat ? 'bg-accent text-white' : 'text-text-secondary hover:text-text-primary'}`}
                    >
                      {categoryLabels[cat]} ({counts[cat]})
                    </button>
                  ) : null
                ))}
              </div>
            )}
          </div>
          {!alertsCollapsed && (
            <div className="space-y-2">
              {filteredAlerts.map((alert, i) => (
                <div
                  key={i}
                  className={`px-4 py-3 rounded-lg border text-sm ${categoryColors[alert.category as Exclude<AlertCategory, 'all'>]}`}
                >
                  <span className="text-xs opacity-70 mr-2">[{categoryLabels[alert.category as Exclude<AlertCategory, 'all'>]}]</span>
                  <span className="font-medium">{alert.name}</span> — {alert.message}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Position allocation */}
      {positions.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-text-secondary">仓位分布</h3>
          <div className="bg-bg-secondary rounded-xl border border-border p-5">
            <div className="space-y-3">
              {[...positions].sort((a, b) => b.marketValue - a.marketValue).map((pos) => (
                <div key={pos.stock.id} className="flex items-center gap-3">
                  <span className="w-24 text-sm text-text-primary truncate">{pos.stock.name}</span>
                  <div className="flex-1 h-6 bg-bg-tertiary rounded-full overflow-hidden relative">
                    <div
                      className="h-full bg-sky-400/50 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(pos.positionPct, 100)}%` }}
                    />
                    <div
                      className="absolute top-0 h-full border-r-2 border-dashed border-warning/60"
                      style={{ left: `${Math.min(pos.targetPct, 100)}%` }}
                      title={`目标: ${pos.targetPct}%`}
                    />
                  </div>
                  <span className="w-28 text-right text-sm whitespace-nowrap">
                    <span className="text-text-primary">{pos.positionPct.toFixed(1)}%</span>
                    <span className="text-text-muted"> / {pos.targetPct}%</span>
                  </span>
                </div>
              ))}
              {settings.cashBalance > 0 && (
                <div className="flex items-center gap-3">
                  <span className="w-24 text-sm text-loss">现金</span>
                  <div className="flex-1 h-6 bg-bg-tertiary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-loss/40 rounded-full"
                      style={{ width: `${(settings.cashBalance / totalCapital) * 100}%` }}
                    />
                  </div>
                  <span className="w-28 text-right text-sm whitespace-nowrap text-loss">
                    {((settings.cashBalance / totalCapital) * 100).toFixed(1)}%
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {positions.length === 0 && alerts.length === 0 && (
        <div className="text-center py-16 text-text-muted">
          <p className="text-lg">暂无数据</p>
          <p className="text-sm mt-2">前往「股票管理」添加股票，然后在「交易记录」中录入交易</p>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, sub, icon }: {
  label: string
  value: React.ReactNode
  sub?: React.ReactNode
  icon?: React.ReactNode
}) {
  return (
    <div className="bg-bg-secondary rounded-xl border border-border p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-text-muted mb-1">{label}</p>
          <div className="text-xl font-bold text-text-primary">{value}</div>
          {sub && <div className="mt-1 text-sm text-text-muted">{sub}</div>}
        </div>
        {icon && <div className="text-text-muted">{icon}</div>}
      </div>
    </div>
  )
}
