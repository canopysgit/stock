import { Outlet } from 'react-router-dom'
import Sidebar, { MobileNav } from './Sidebar'
import { useData } from '../../context/DataContext'
import { RefreshCw } from 'lucide-react'

export default function Layout() {
  const { refreshPrices, loading } = useData()

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-14 border-b border-border flex items-center justify-between px-4 md:justify-end md:px-6 shrink-0">
          <span className="text-lg font-bold text-text-primary md:hidden">StockPilot</span>
          <button
            onClick={refreshPrices}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary bg-bg-tertiary hover:bg-bg-hover rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            {loading ? '刷新中...' : '刷新行情'}
          </button>
        </header>
        <main className="flex-1 overflow-auto p-4 md:p-6 pb-20 md:pb-6">
          <Outlet />
        </main>
      </div>
      <MobileNav />
    </div>
  )
}
