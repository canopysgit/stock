import { useData } from '../context/DataContext'
import { TIER_PCT, calcValuationPrices } from '../lib/calculations'
import PnlText from '../components/common/PnlText'
import { TrendingUp, TrendingDown, Briefcase, AlertTriangle } from 'lucide-react'

export default function Dashboard() {
  const { portfolioStats, stocks, prices, settings } = useData()
  const { totalMarketValue, totalCost, totalPnl, totalPnlPct, totalCapital, holdingCount, positions } = portfolioStats

  // Alerts: stocks near buy targets
  const alerts: { name: string; message: string; type: 'buy' | 'sell' | 'overweight' }[] = []

  for (const stock of stocks.filter((s) => s.status === 'watching' || s.status === 'holding')) {
    const currentPrice = prices[stock.code]
    if (!currentPrice || !stock.eps || !stock.peHigh || !stock.peMid || !stock.peLow) continue

    const vp = calcValuationPrices(stock.eps, stock.peHigh, stock.peMid, stock.peLow)
    // Buy signal: price near or below 低估P3 or 中估P3
    if (currentPrice <= vp.low.p3) {
      alerts.push({ name: stock.name, message: `现价 ${currentPrice} 已低于低估低吸价 ${vp.low.p3}`, type: 'buy' })
    } else if (currentPrice <= vp.mid.p3) {
      alerts.push({ name: stock.name, message: `现价 ${currentPrice} 已低于中估低吸价 ${vp.mid.p3}`, type: 'buy' })
    }
    // Sell signal: price above 高估打折价
    if (currentPrice >= vp.high.p2) {
      alerts.push({ name: stock.name, message: `现价 ${currentPrice} 已达高估打折价 ${vp.high.p2}`, type: 'sell' })
    }
  }

  // Overweight alerts
  for (const pos of positions) {
    const target = TIER_PCT[pos.stock.tier]
    if (pos.positionPct > target + 1) {
      alerts.push({
        name: pos.stock.name,
        message: `当前仓位 ${pos.positionPct.toFixed(1)}% 超过目标 ${target}%`,
        type: 'overweight',
      })
    }
  }

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
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-text-secondary flex items-center gap-2">
            <AlertTriangle size={16} /> 信号提醒
          </h3>
          <div className="space-y-2">
            {alerts.map((alert, i) => (
              <div
                key={i}
                className={`px-4 py-3 rounded-lg border text-sm ${
                  alert.type === 'buy'
                    ? 'bg-loss-bg border-loss/30 text-loss'
                    : alert.type === 'sell'
                    ? 'bg-profit-bg border-profit/30 text-profit'
                    : 'bg-warning-bg border-warning/30 text-warning'
                }`}
              >
                <span className="font-medium">{alert.name}</span> — {alert.message}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Position allocation */}
      {positions.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-text-secondary">仓位分布</h3>
          <div className="bg-bg-secondary rounded-xl border border-border p-5">
            <div className="space-y-3">
              {positions.map((pos) => (
                <div key={pos.stock.id} className="flex items-center gap-3">
                  <span className="w-24 text-sm text-text-primary truncate">{pos.stock.name}</span>
                  <div className="flex-1 h-6 bg-bg-tertiary rounded-full overflow-hidden relative">
                    <div
                      className="h-full bg-accent/60 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(pos.positionPct, 100)}%` }}
                    />
                    <div
                      className="absolute top-0 h-full border-r-2 border-dashed border-warning/60"
                      style={{ left: `${Math.min(pos.targetPct, 100)}%` }}
                      title={`目标: ${pos.targetPct}%`}
                    />
                  </div>
                  <span className="w-20 text-right text-sm">
                    <span className="text-text-primary">{pos.positionPct.toFixed(1)}%</span>
                    <span className="text-text-muted"> / {pos.targetPct}%</span>
                  </span>
                </div>
              ))}
              {settings.cashBalance > 0 && (
                <div className="flex items-center gap-3">
                  <span className="w-24 text-sm text-text-muted">现金</span>
                  <div className="flex-1 h-6 bg-bg-tertiary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-text-muted/30 rounded-full"
                      style={{ width: `${(settings.cashBalance / totalCapital) * 100}%` }}
                    />
                  </div>
                  <span className="w-20 text-right text-sm text-text-muted">
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
