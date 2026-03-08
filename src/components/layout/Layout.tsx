import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import { useData } from '../../context/DataContext'
import { RefreshCw } from 'lucide-react'

export default function Layout() {
  const { refreshPrices, loading } = useData()

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-14 border-b border-border flex items-center justify-end px-6 shrink-0">
          <button
            onClick={refreshPrices}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary bg-bg-tertiary hover:bg-bg-hover rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            {loading ? '刷新中...' : '刷新行情'}
          </button>
        </header>
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
