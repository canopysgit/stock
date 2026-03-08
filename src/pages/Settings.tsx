import { useState } from 'react'
import { useData } from '../context/DataContext'
import { Save, Download, Upload } from 'lucide-react'
import * as store from '../lib/store'
import { supabase } from '../lib/supabase'

export default function Settings() {
  const { settings, updateSettings, refreshData } = useData()
  const [cashBalance, setCashBalance] = useState(settings.cashBalance.toString())
  const [saved, setSaved] = useState(false)

  const handleSave = async () => {
    await updateSettings({ cashBalance: parseFloat(cashBalance) || 0 })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleExport = async () => {
    const [stocks, trades, st] = await Promise.all([
      store.getStocks(),
      store.getTrades(),
      store.getSettings(),
    ])
    const data = {
      stocks,
      trades,
      settings: st,
      exportedAt: new Date().toISOString(),
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `stockpilot-backup-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImport = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      try {
        const text = await file.text()
        const data = JSON.parse(text)
        if (data.stocks && data.trades) {
          if (confirm('导入将覆盖现有数据，确认继续？')) {
            // Clear existing data
            await supabase.from('trades').delete().neq('id', '00000000-0000-0000-0000-000000000000')
            await supabase.from('stocks').delete().neq('id', '00000000-0000-0000-0000-000000000000')

            // Import stocks
            for (const s of data.stocks) {
              await store.addStock({
                code: s.code,
                name: s.name,
                industry: s.industry || '',
                tier: s.tier || 'mid',
                eps: s.eps,
                peHigh: s.peHigh,
                peMid: s.peMid,
                peLow: s.peLow,
                conditionPrice1: s.conditionPrice1,
                conditionPrice2: s.conditionPrice2,
                status: s.status || 'watching',
                notes: s.notes || '',
              })
            }

            // We need a stock code→new id mapping for trades
            const newStocks = await store.getStocks()
            const codeToId: Record<string, string> = {}
            for (const ns of newStocks) {
              codeToId[ns.code] = ns.id
            }

            // Import trades
            for (const t of data.trades) {
              // Try to match by stock code from original data
              const originalStock = data.stocks.find((s: any) => s.id === t.stockId)
              const newStockId = originalStock ? codeToId[originalStock.code] : undefined
              if (newStockId) {
                await store.addTrade({
                  stockId: newStockId,
                  type: t.type,
                  tradeDate: t.tradeDate,
                  price: t.price,
                  quantity: t.quantity,
                  notes: t.notes || '',
                })
              }
            }

            // Import settings
            if (data.settings) {
              await store.updateSettings({ cashBalance: data.settings.cashBalance || 0 })
            }

            await refreshData()
            alert('导入成功！')
          }
        } else {
          alert('无效的备份文件')
        }
      } catch {
        alert('文件解析失败')
      }
    }
    input.click()
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <h2 className="text-xl font-semibold">设置</h2>

      {/* Cash balance */}
      <div className="bg-bg-secondary rounded-xl border border-border p-6 space-y-4">
        <h3 className="text-sm font-medium text-text-secondary">资金设置</h3>
        <div>
          <label className="block text-xs text-text-muted mb-1">现金余额</label>
          <div className="flex gap-3">
            <input
              type="number"
              value={cashBalance}
              onChange={(e) => setCashBalance(e.target.value)}
              placeholder="0"
              className="flex-1 bg-bg-tertiary border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted/50 focus:outline-none focus:border-accent"
            />
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm transition-colors"
            >
              <Save size={14} /> {saved ? '已保存' : '保存'}
            </button>
          </div>
          <p className="text-xs text-text-muted mt-2">
            设为 0 时，仓位占比 = 股票市值 / 总持仓市值；设置现金后，仓位占比 = 股票市值 / (总持仓市值 + 现金)
          </p>
        </div>
      </div>

      {/* Data backup */}
      <div className="bg-bg-secondary rounded-xl border border-border p-6 space-y-4">
        <h3 className="text-sm font-medium text-text-secondary">数据管理</h3>
        <p className="text-xs text-text-muted">数据存储在 Supabase 云端，多设备自动同步。可导出备份以防万一。</p>
        <div className="flex gap-3">
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-bg-tertiary hover:bg-bg-hover border border-border text-text-primary rounded-lg text-sm transition-colors"
          >
            <Download size={14} /> 导出数据
          </button>
          <button
            onClick={handleImport}
            className="flex items-center gap-2 px-4 py-2 bg-bg-tertiary hover:bg-bg-hover border border-border text-text-primary rounded-lg text-sm transition-colors"
          >
            <Upload size={14} /> 导入数据
          </button>
        </div>
      </div>

      {/* About */}
      <div className="bg-bg-secondary rounded-xl border border-border p-6">
        <h3 className="text-sm font-medium text-text-secondary mb-2">关于</h3>
        <p className="text-xs text-text-muted">
          StockPilot — 个人 A 股交易管理系统
        </p>
        <p className="text-xs text-text-muted mt-1">
          功能：交易记录 · 持仓管理 · 估值模型（9档目标价）· FIFO 盈亏计算 · 清仓归档
        </p>
      </div>
    </div>
  )
}
