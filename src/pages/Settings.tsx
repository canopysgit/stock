import { useState } from 'react'
import { useData } from '../context/DataContext'
import { Download, Upload, Plus, Trash2 } from 'lucide-react'
import Modal from '../components/common/Modal'
import * as store from '../lib/store'
import { supabase } from '../lib/supabase'

export default function Settings() {
  const { cashBalance, cashFlows, addCashFlow, deleteCashFlow, refreshData } = useData()
  const [modalOpen, setModalOpen] = useState(false)
  const [flowType, setFlowType] = useState<'deposit' | 'withdraw' | 'adjust'>('deposit')
  const [flowAmount, setFlowAmount] = useState('')
  const [flowDate, setFlowDate] = useState(new Date().toISOString().split('T')[0])
  const [flowNotes, setFlowNotes] = useState('')

  const openAddFlow = (type: 'deposit' | 'withdraw' | 'adjust') => {
    setFlowType(type)
    setFlowAmount(type === 'adjust' ? cashBalance.toString() : '')
    setFlowDate(new Date().toISOString().split('T')[0])
    setFlowNotes('')
    setModalOpen(true)
  }

  const handleSaveFlow = async () => {
    const amount = parseFloat(flowAmount)
    if (isNaN(amount)) return

    if (flowType === 'adjust') {
      // 调整：输入目标余额，算差额写入 cash_flows
      const delta = amount - cashBalance
      if (Math.abs(delta) < 0.01) { setModalOpen(false); return }
      await addCashFlow({
        type: delta > 0 ? 'deposit' : 'withdraw',
        amount: Math.round(delta * 100) / 100,
        tradeId: null,
        stockId: null,
        flowDate,
        notes: flowNotes || `调整: ¥${cashBalance.toLocaleString()} → ¥${amount.toLocaleString()}`,
      })
    } else {
      if (amount <= 0) return
      await addCashFlow({
        type: flowType,
        amount: flowType === 'deposit' ? amount : -amount,
        tradeId: null,
        stockId: null,
        flowDate,
        notes: flowNotes || (flowType === 'deposit' ? '充值' : '取现'),
      })
    }
    setModalOpen(false)
  }

  const handleDeleteFlow = async (id: string) => {
    if (confirm('确认删除该资金记录？')) {
      await deleteCashFlow(id)
    }
  }

  // Filter to show only deposit/withdraw flows (not auto-generated buy/sell/dividend ones)
  const manualFlows = cashFlows.filter((f) => f.type === 'deposit' || f.type === 'withdraw')
    .sort((a, b) => b.flowDate.localeCompare(a.flowDate))

  const handleExport = async () => {
    const [stocks, trades, st, cf] = await Promise.all([
      store.getStocks(),
      store.getTrades(),
      store.getSettings(),
      store.getCashFlows(),
    ])
    const data = {
      stocks,
      trades,
      settings: st,
      cashFlows: cf,
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
            await supabase.from('cash_flows').delete().neq('id', '00000000-0000-0000-0000-000000000000')
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

            // Import cash flows
            if (data.cashFlows) {
              for (const cf of data.cashFlows) {
                if (cf.type === 'deposit' || cf.type === 'withdraw') {
                  await store.addCashFlow({
                    type: cf.type,
                    amount: cf.amount,
                    tradeId: null,
                    stockId: null,
                    flowDate: cf.flowDate,
                    notes: cf.notes || '',
                  })
                }
              }
            } else if (data.settings?.cashBalance > 0) {
              // Legacy: migrate old cashBalance as deposit
              await store.addCashFlow({
                type: 'deposit',
                amount: data.settings.cashBalance,
                tradeId: null,
                stockId: null,
                flowDate: new Date().toISOString().split('T')[0],
                notes: '从备份导入的现金余额',
              })
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

      {/* Cash flow management */}
      <div className="bg-bg-secondary rounded-xl border border-border p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-text-secondary">资金管理</h3>
          <div className="text-sm font-mono text-text-primary">
            现金余额: <span className="text-accent font-bold">¥{cashBalance.toLocaleString()}</span>
          </div>
        </div>
        <p className="text-xs text-text-muted">
          现金余额由充值/取现/买入/卖出/分红自动计算。通过下方按钮记录充值和取现。
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => openAddFlow('deposit')}
            className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm transition-colors"
          >
            <Plus size={14} /> 充值
          </button>
          <button
            onClick={() => openAddFlow('withdraw')}
            className="flex items-center gap-2 px-4 py-2 bg-bg-tertiary hover:bg-bg-hover border border-border text-text-primary rounded-lg text-sm transition-colors"
          >
            <Plus size={14} /> 取现
          </button>
          <button
            onClick={() => openAddFlow('adjust')}
            className="flex items-center gap-2 px-4 py-2 bg-bg-tertiary hover:bg-bg-hover border border-border text-text-primary rounded-lg text-sm transition-colors"
          >
            <Plus size={14} /> 调整
          </button>
        </div>

        {/* Flow history */}
        {manualFlows.length > 0 && (
          <div className="space-y-2 mt-4">
            <h4 className="text-xs text-text-muted">充值/取现记录</h4>
            <div className="space-y-1">
              {manualFlows.map((flow) => (
                <div key={flow.id} className="flex items-center justify-between bg-bg-tertiary rounded-lg px-3 py-2">
                  <div className="flex items-center gap-3">
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                      flow.type === 'deposit' ? 'bg-profit-bg text-profit' : 'bg-loss-bg text-loss'
                    }`}>
                      {flow.type === 'deposit' ? '充值' : '取现'}
                    </span>
                    <span className="text-sm font-mono text-text-primary">
                      {flow.type === 'deposit' ? '+' : ''}¥{Math.abs(flow.amount).toLocaleString()}
                    </span>
                    <span className="text-xs text-text-muted">{flow.flowDate}</span>
                    {flow.notes && <span className="text-xs text-text-muted">{flow.notes}</span>}
                  </div>
                  <button
                    onClick={() => handleDeleteFlow(flow.id)}
                    className="p-1 text-text-muted hover:text-loss"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
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
          功能：交易记录 · 持仓管理 · 估值模型（9档目标价）· FIFO 盈亏计算 · 资金流水 · 清仓归档
        </p>
      </div>

      {/* Add cash flow modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={flowType === 'deposit' ? '充值' : flowType === 'withdraw' ? '取现' : '调整余额'}>
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-text-muted mb-1">
              {flowType === 'adjust' ? '目标余额' : '金额'}
            </label>
            <input
              type="number"
              step="0.01"
              value={flowAmount}
              onChange={(e) => setFlowAmount(e.target.value)}
              placeholder={flowType === 'adjust' ? '输入目标现金余额' : '输入金额'}
              className="w-full bg-bg-tertiary border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted/50 focus:outline-none focus:border-accent"
            />
            {flowType === 'adjust' && flowAmount && !isNaN(parseFloat(flowAmount)) && (
              <div className="text-xs text-text-muted mt-2">
                当前余额 ¥{cashBalance.toLocaleString()} → 目标 ¥{parseFloat(flowAmount).toLocaleString()}
                {Math.abs(parseFloat(flowAmount) - cashBalance) >= 0.01 && (
                  <span className={parseFloat(flowAmount) > cashBalance ? 'text-profit ml-1' : 'text-loss ml-1'}>
                    （{parseFloat(flowAmount) > cashBalance ? '+' : ''}{(parseFloat(flowAmount) - cashBalance).toLocaleString()}）
                  </span>
                )}
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs text-text-muted mb-1">日期</label>
            <input
              type="date"
              value={flowDate}
              onChange={(e) => setFlowDate(e.target.value)}
              className="w-full bg-bg-tertiary border border-border rounded-lg px-3 py-2 text-sm text-text-primary"
            />
          </div>
          <div>
            <label className="block text-xs text-text-muted mb-1">备注</label>
            <input
              type="text"
              value={flowNotes}
              onChange={(e) => setFlowNotes(e.target.value)}
              placeholder="选填"
              className="w-full bg-bg-tertiary border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted/50 focus:outline-none focus:border-accent"
            />
          </div>
          <div className="flex justify-end pt-2">
            <button onClick={handleSaveFlow} className="px-6 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm transition-colors">
              保存
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
