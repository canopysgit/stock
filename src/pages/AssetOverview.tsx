import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useData } from '../context/DataContext'
import { computeGoldSummary, computeEtfSummary } from '../lib/calculations'
import type { OtherAsset, GoldSummary, EtfSummary } from '../types'
import PnlText from '../components/common/PnlText'
import { Pencil, Plus, Trash2, X } from 'lucide-react'

function PieChartSVG({ segments, total, size = 120 }: { segments: { label: string; value: number; color: string }[]; total: number; size?: number }) {
  const cx = size / 2
  const cy = size / 2
  const r = size / 2 - 4
  const innerR = r * 0.55

  let cumAngle = -Math.PI / 2
  const paths = segments.map((seg) => {
    const angle = (seg.value / total) * 2 * Math.PI
    const startAngle = cumAngle
    const endAngle = cumAngle + angle
    cumAngle = endAngle

    const largeArc = angle > Math.PI ? 1 : 0
    const x1 = cx + r * Math.cos(startAngle)
    const y1 = cy + r * Math.sin(startAngle)
    const x2 = cx + r * Math.cos(endAngle)
    const y2 = cy + r * Math.sin(endAngle)
    const ix1 = cx + innerR * Math.cos(endAngle)
    const iy1 = cy + innerR * Math.sin(endAngle)
    const ix2 = cx + innerR * Math.cos(startAngle)
    const iy2 = cy + innerR * Math.sin(startAngle)

    const d = [
      `M ${x1} ${y1}`,
      `A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`,
      `L ${ix1} ${iy1}`,
      `A ${innerR} ${innerR} 0 ${largeArc} 0 ${ix2} ${iy2}`,
      'Z',
    ].join(' ')

    return <path key={seg.label} d={d} fill={seg.color} />
  })

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {paths}
    </svg>
  )
}

export default function AssetOverview() {
  const {
    portfolioStats, otherAssets, goldPrice, etfNavs, assetOverview,
    addOtherAsset, updateOtherAsset, deleteOtherAsset, refreshOtherPrices,
  } = useData()
  const navigate = useNavigate()
  const [modal, setModal] = useState<null | { mode: 'add' | 'edit'; assetType: string; item?: OtherAsset }>(null)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const goldAssets = otherAssets.filter((a) => a.assetType === 'gold')
  const etfAssets = otherAssets.filter((a) => a.assetType === 'fund')
  const depositAssets = otherAssets.filter((a) => a.assetType === 'deposit')
  const goldSummary = computeGoldSummary(goldAssets)
  const etfSummaries = computeEtfSummary(etfAssets)
  const totalDeposit = depositAssets.reduce((s, a) => s + a.quantity, 0)

  const { totalAssets, stockMarketValue, stockPnl, goldValue, goldPnl, etfValue, etfPnl, depositAmount, cashBalance, totalPnl, totalPnlPct } = assetOverview

  const fmt = (n: number) => n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return (
    <div className="space-y-4">
      <h2 className="text-lg lg:text-xl font-semibold">资产总览</h2>

      {/* Total assets */}
      <div className="bg-bg-secondary rounded-xl p-4 lg:p-6 border border-border">
        <div className="text-sm text-text-muted mb-1">总资产</div>
        <div className="text-2xl lg:text-3xl font-bold text-text-primary mb-1">
          ¥{fmt(totalAssets)}
        </div>
        <div className="text-sm">
          总盈亏 <PnlText value={totalPnl} showSign className="font-medium" />
          <span className="text-text-muted ml-2">
            (<PnlText value={totalPnlPct} suffix="%" showSign />)
          </span>
        </div>
      </div>

      {/* Distribution pie chart */}
      {totalAssets > 0 && (
        <div className="bg-bg-secondary rounded-xl p-4 border border-border">
          <div className="text-sm text-text-muted mb-3">资产分布</div>
          <div className="flex items-center gap-6">
            <PieChartSVG
              segments={[
                { label: '股票', value: stockMarketValue, color: '#3b82f6' },
                { label: '黄金', value: goldValue, color: '#eab308' },
                { label: 'ETF', value: etfValue, color: '#a855f7' },
                { label: '存款', value: depositAmount, color: '#22c55e' },
                { label: '现金', value: cashBalance, color: '#06b6d4' },
              ].filter((s) => s.value > 0)}
              total={totalAssets}
              size={140}
            />
            <div className="flex flex-wrap gap-3 text-xs text-text-secondary">
              {stockMarketValue > 0 && (
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#3b82f6] inline-block" />
                  <span>股票 ¥{fmt(stockMarketValue)}</span>
                  <span className="text-text-muted">({((stockMarketValue / totalAssets) * 100).toFixed(1)}%)</span>
                </div>
              )}
              {goldValue > 0 && (
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#eab308] inline-block" />
                  <span>黄金 ¥{fmt(goldValue)}</span>
                  <span className="text-text-muted">({((goldValue / totalAssets) * 100).toFixed(1)}%)</span>
                </div>
              )}
              {etfValue > 0 && (
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#a855f7] inline-block" />
                  <span>ETF ¥{fmt(etfValue)}</span>
                  <span className="text-text-muted">({((etfValue / totalAssets) * 100).toFixed(1)}%)</span>
                </div>
              )}
              {depositAmount > 0 && (
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#22c55e] inline-block" />
                  <span>存款 ¥{fmt(depositAmount)}</span>
                  <span className="text-text-muted">({((depositAmount / totalAssets) * 100).toFixed(1)}%)</span>
                </div>
              )}
              {cashBalance > 0 && (
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#06b6d4] inline-block" />
                  <span>现金 ¥{fmt(cashBalance)}</span>
                  <span className="text-text-muted">({((cashBalance / totalAssets) * 100).toFixed(1)}%)</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Stock card */}
        <div className="bg-bg-secondary rounded-xl p-4 border border-border">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-text-primary">股票</h3>
            <button onClick={() => navigate('/portfolio')} className="text-xs text-accent hover:underline">详情 →</button>
          </div>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-text-muted">市值</span><span className="text-text-primary">¥{fmt(stockMarketValue)}</span></div>
            <div className="flex justify-between"><span className="text-text-muted">浮盈</span><PnlText value={stockPnl} showSign /></div>
            <div className="flex justify-between"><span className="text-text-muted">持仓数</span><span className="text-text-secondary">{portfolioStats.holdingCount}</span></div>
          </div>
        </div>

        {/* Gold card */}
        <div className="bg-bg-secondary rounded-xl p-4 border border-border">
          <div
            className="flex items-center justify-between mb-3 cursor-pointer select-none"
            onClick={() => setExpanded((e) => ({ ...e, gold: !e.gold }))}
          >
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-medium text-text-primary">招行黄金账户</h3>
              <span className="text-xs text-text-muted">{expanded.gold ? '▼' : '▶'}</span>
            </div>
            <button onClick={(e) => { e.stopPropagation(); setModal({ mode: 'add', assetType: 'gold' }) }} className="text-accent hover:text-accent-hover transition-colors" title="添加买入"><Plus size={16} /></button>
          </div>
          {goldSummary.totalGrams > 0 ? (
            <>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-text-muted">持有克数</span><span className="text-text-primary">{goldSummary.totalGrams.toFixed(4)}g</span></div>
                <div className="flex justify-between"><span className="text-text-muted">均价</span><span className="text-text-secondary">¥{fmt(goldSummary.avgCostPerGram)}/g</span></div>
                <div className="flex justify-between"><span className="text-text-muted">成本</span><span className="text-text-secondary">¥{fmt(goldSummary.totalCost)}</span></div>
                <div className="flex justify-between"><span className="text-text-muted">卖出价</span><span className="text-text-primary">¥{fmt(goldPrice - 9.2)}/g</span></div>
                <div className="flex justify-between"><span className="text-text-muted">市值</span><span className="text-text-primary">¥{fmt(goldValue)}</span></div>
                <div className="flex justify-between"><span className="text-text-muted">浮盈</span><PnlText value={goldPnl} showSign /></div>
              </div>
              {expanded.gold && goldAssets.length > 0 && (
                <div className="mt-3 border-t border-border pt-2 space-y-1">
                  <div className="text-xs text-text-muted font-medium">买入明细</div>
                  {goldAssets.map((t) => (
                    <div key={t.id} className="flex items-center justify-between text-xs text-text-secondary">
                      <span>{t.notes || t.name}</span>
                      <div className="flex gap-1">
                        <button onClick={() => setModal({ mode: 'edit', assetType: 'gold', item: t })} className="text-text-muted hover:text-text-primary"><Pencil size={12} /></button>
                        <button onClick={() => deleteOtherAsset(t.id)} className="text-text-muted hover:text-loss"><Trash2 size={12} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="text-sm text-text-muted py-4 text-center">暂无黄金持仓，点击 + 添加</div>
          )}
        </div>

        {/* ETF card */}
        <div className="bg-bg-secondary rounded-xl p-4 border border-border">
          <div
            className="flex items-center justify-between mb-3 cursor-pointer select-none"
            onClick={() => setExpanded((e) => ({ ...e, etf: !e.etf }))}
          >
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-medium text-text-primary">场外ETF</h3>
              <span className="text-xs text-text-muted">{expanded.etf ? '▼' : '▶'}</span>
            </div>
            <div className="flex gap-2">
              <button onClick={(e) => { e.stopPropagation(); refreshOtherPrices() }} className="text-xs text-text-muted hover:text-text-primary transition-colors" title="刷新净值">↻</button>
              <button onClick={(e) => { e.stopPropagation(); setModal({ mode: 'add', assetType: 'fund' }) }} className="text-accent hover:text-accent-hover transition-colors" title="添加ETF"><Plus size={16} /></button>
            </div>
          </div>
          {etfSummaries.length > 0 ? (
            etfSummaries.map((etf) => {
              const nav = etfNavs[etf.code] || 0
              const value = etf.totalShares * nav
              const pnl = value - etf.totalCost
              const pnlPct = etf.totalCost > 0 ? (pnl / etf.totalCost) * 100 : 0
              const asset = etfAssets.find((a) => a.code === etf.code)
              return (
                <div key={etf.code} className="space-y-1 text-sm">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-text-primary font-medium">{etf.name}（{etf.code}）</span>
                    {asset && <button onClick={() => setModal({ mode: 'edit', assetType: 'fund', item: asset })} className="text-text-muted hover:text-text-primary"><Pencil size={12} /></button>}
                  </div>
                  <div className="flex justify-between"><span className="text-text-muted">份额</span><span className="text-text-primary">{etf.totalShares.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span className="text-text-muted">成本</span><span className="text-text-secondary">¥{fmt(etf.totalCost)}</span></div>
                  <div className="flex justify-between"><span className="text-text-muted">最新净值</span><span className="text-text-primary">{nav > 0 ? nav.toFixed(4) : '获取中...'}</span></div>
                  <div className="flex justify-between"><span className="text-text-muted">市值</span><span className="text-text-primary">¥{fmt(value)}</span></div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">浮盈</span>
                    <span><PnlText value={pnl} showSign /> <span className="text-text-muted">(<PnlText value={pnlPct} suffix="%" showSign />)</span></span>
                  </div>
                </div>
              )
            })
          ) : (
            <div className="text-sm text-text-muted py-4 text-center">暂无ETF持仓，点击 + 添加</div>
          )}
        </div>

        {/* Deposit card */}
        <div className="bg-bg-secondary rounded-xl p-4 border border-border">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-text-primary">活期存款</h3>
            <div className="flex gap-2">
              {totalDeposit === 0 && <button onClick={() => setModal({ mode: 'add', assetType: 'deposit' })} className="text-accent hover:text-accent-hover transition-colors" title="添加存款"><Plus size={16} /></button>}
            </div>
          </div>
          {totalDeposit > 0 ? (
            <div className="space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-text-muted">招行活期</span><span className="text-text-primary font-medium">¥{fmt(totalDeposit)}</span></div>
              {depositAssets.map((a) => (
                <div key={a.id} className="flex items-center justify-between text-xs text-text-secondary">
                  <span>{a.name}</span>
                  <div className="flex gap-1">
                    <button onClick={() => setModal({ mode: 'edit', assetType: 'deposit', item: a })} className="text-text-muted hover:text-text-primary"><Pencil size={12} /></button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-text-muted py-4 text-center">暂无存款记录，点击 + 添加</div>
          )}
        </div>

        {/* Cash balance card */}
        <div className="bg-bg-secondary rounded-xl p-4 border border-border">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-text-primary">炒股账户现金</h3>
          </div>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-text-muted">可用余额</span><span className="text-text-primary font-medium">¥{fmt(cashBalance)}</span></div>
          </div>
        </div>
      </div>

      {/* Modal */}
      {modal && (
        <AssetModal
          mode={modal.mode}
          assetType={modal.assetType}
          item={modal.item}
          goldPrice={goldPrice}
          onClose={() => setModal(null)}
          onSave={async (data) => {
            if (modal.mode === 'edit' && modal.item) {
              await updateOtherAsset(modal.item.id, data)
            } else {
              await addOtherAsset(data as any)
            }
            setModal(null)
          }}
        />
      )}
    </div>
  )
}

// --- Modal ---
function AssetModal({ mode, assetType, item, goldPrice, onClose, onSave }: {
  mode: 'add' | 'edit'; assetType: string; item?: OtherAsset; goldPrice: number; onClose: () => void; onSave: (data: any) => Promise<void>
}) {
  const [saving, setSaving] = useState(false)
  if (assetType === 'gold') return <GoldModal mode={mode} item={item} goldPrice={goldPrice} onClose={onClose} onSave={onSave} setSaving={setSaving} saving={saving} />
  if (assetType === 'fund') return <EtfModal mode={mode} item={item} onClose={onClose} onSave={onSave} setSaving={setSaving} saving={saving} />
  if (assetType === 'deposit') return <DepositModal mode={mode} item={item} onClose={onClose} onSave={onSave} setSaving={setSaving} saving={saving} />
  return null
}

function GoldModal({ mode, item, goldPrice, onClose, onSave, setSaving, saving }: any) {
  const [grams, setGrams] = useState(item?.quantity?.toString() || '')
  const [totalCost, setTotalCost] = useState(item?.totalCost?.toString() || '')
  const [account, setAccount] = useState(item?.account || '招商银行')
  const [notes, setNotes] = useState(item?.notes || '')

  const avgCost = grams && totalCost ? parseFloat(totalCost) / parseFloat(grams) : 0

  const handleSubmit = async () => {
    const g = parseFloat(grams)
    const c = parseFloat(totalCost)
    if (!g || !c) return
    setSaving(true)
    await onSave({
      name: '招行黄金',
      assetType: 'gold',
      code: null,
      quantity: g,
      avgCost: c / g,
      totalCost: c,
      currentPrice: goldPrice,
      account,
      notes,
    })
  }

  const inputCls = "w-full bg-bg-tertiary border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted/50 focus:outline-none focus:border-accent"

  return (
    <ModalWrapper title={mode === 'add' ? '添加黄金买入' : '编辑黄金'} onClose={onClose}>
      <div className="space-y-3">
        <Field label="克数"><input type="number" step="0.0001" value={grams} onChange={(e) => setGrams(e.target.value)} className={inputCls} placeholder="50.0045" /></Field>
        <Field label="总成本 (元)"><input type="number" step="0.01" value={totalCost} onChange={(e) => setTotalCost(e.target.value)} className={inputCls} placeholder="50000" /></Field>
        {avgCost > 0 && <div className="text-xs text-text-muted">均价: ¥{avgCost.toFixed(2)}/g，参考现价: ¥{goldPrice.toFixed(2)}/g</div>}
        <Field label="账户"><input type="text" value={account} onChange={(e) => setAccount(e.target.value)} className={inputCls} /></Field>
        <Field label="备注"><input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} placeholder="可选" /></Field>
      </div>
      <ModalFooter onClose={onClose} onSave={handleSubmit} saving={saving} />
    </ModalWrapper>
  )
}

function EtfModal({ mode, item, onClose, onSave, setSaving, saving }: any) {
  const [code, setCode] = useState(item?.code || '007466')
  const [name, setName] = useState(item?.name || '华泰柏瑞红利低波ETF联接C')
  const [shares, setShares] = useState(item?.quantity?.toString() || '')
  const [cost, setCost] = useState(item?.totalCost?.toString() || '')
  const [account, setAccount] = useState(item?.account || '有知有行')
  const [notes, setNotes] = useState(item?.notes || '')

  const handleSubmit = async () => {
    const s = parseFloat(shares)
    const c = parseFloat(cost)
    if (!code || !s || !c) return
    setSaving(true)
    await onSave({
      name,
      assetType: 'fund',
      code,
      quantity: s,
      avgCost: c / s,
      totalCost: c,
      currentPrice: 0,
      account,
      notes,
    })
  }

  const inputCls = "w-full bg-bg-tertiary border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted/50 focus:outline-none focus:border-accent"

  return (
    <ModalWrapper title={mode === 'add' ? '添加ETF' : '编辑ETF'} onClose={onClose}>
      <div className="space-y-3">
        <Field label="基金代码"><input type="text" value={code} onChange={(e) => setCode(e.target.value)} className={inputCls} placeholder="007466" /></Field>
        <Field label="基金名称"><input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} /></Field>
        <Field label="持有份额"><input type="number" step="0.01" value={shares} onChange={(e) => setShares(e.target.value)} className={inputCls} placeholder="30625.77" /></Field>
        <Field label="总成本 (元)"><input type="number" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} className={inputCls} placeholder="50000" /></Field>
        <Field label="账户"><input type="text" value={account} onChange={(e) => setAccount(e.target.value)} className={inputCls} /></Field>
        <Field label="备注"><input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} placeholder="可选" /></Field>
      </div>
      <ModalFooter onClose={onClose} onSave={handleSubmit} saving={saving} />
    </ModalWrapper>
  )
}

function DepositModal({ mode, item, onClose, onSave, setSaving, saving }: any) {
  const [amount, setAmount] = useState(item?.quantity?.toString() || '')
  const [name, setName] = useState(item?.name || '招行活期')
  const [notes, setNotes] = useState(item?.notes || '')

  const handleSubmit = async () => {
    const a = parseFloat(amount)
    if (!a) return
    setSaving(true)
    await onSave({
      name,
      assetType: 'deposit',
      code: null,
      quantity: a,
      avgCost: 1,
      totalCost: a,
      currentPrice: 1,
      account: '招商银行',
      notes,
    })
  }

  const inputCls = "w-full bg-bg-tertiary border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted/50 focus:outline-none focus:border-accent"

  return (
    <ModalWrapper title={mode === 'add' ? '添加存款' : '编辑存款'} onClose={onClose}>
      <div className="space-y-3">
        <Field label="金额 (元)"><input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputCls} placeholder="362000" /></Field>
        <Field label="名称"><input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} /></Field>
        <Field label="备注"><input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} placeholder="可选" /></Field>
      </div>
      <ModalFooter onClose={onClose} onSave={handleSubmit} saving={saving} />
    </ModalWrapper>
  )
}

// --- Shared modal components ---
function ModalWrapper({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-bg-secondary rounded-xl border border-border w-full max-w-md mx-4 p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-medium text-text-primary">{title}</h3>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-text-muted mb-1">{label}</label>
      {children}
    </div>
  )
}

function ModalFooter({ onClose, onSave, saving }: { onClose: () => void; onSave: () => void; saving: boolean }) {
  return (
    <div className="flex justify-end gap-2 mt-4">
      <button onClick={onClose} className="px-3 py-1.5 text-sm rounded-lg border border-border text-text-secondary hover:text-text-primary">取消</button>
      <button onClick={onSave} disabled={saving} className="px-3 py-1.5 text-sm rounded-lg bg-accent text-white hover:opacity-90 disabled:opacity-50">
        {saving ? '保存中...' : '保存'}
      </button>
    </div>
  )
}
