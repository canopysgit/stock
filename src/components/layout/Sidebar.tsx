import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Database,
  Briefcase,
  BarChart3,
  Calculator,
  ArrowLeftRight,
  Archive,
  Settings,
  LogOut,
} from 'lucide-react'
import { logout } from '../../lib/auth'

const links = [
  { to: '/', icon: LayoutDashboard, label: '仪表盘' },
  { to: '/portfolio', icon: Briefcase, label: '投资组合' },
  { to: '/pnl', icon: BarChart3, label: '盈亏总览' },
  { to: '/valuation', icon: Calculator, label: '估值模型' },
  { to: '/trades', icon: ArrowLeftRight, label: '交易记录' },
  { to: '/stocks', icon: Database, label: '股票管理' },
  { to: '/history', icon: Archive, label: '清仓记录' },
  { to: '/settings', icon: Settings, label: '设置' },
]

export default function Sidebar() {
  return (
    <aside className="w-56 h-screen bg-bg-secondary border-r border-border flex flex-col shrink-0">
      <div className="h-14 flex items-center px-5 border-b border-border">
        <h1 className="text-lg font-bold text-text-primary tracking-wide">
          StockPilot
        </h1>
      </div>
      <nav className="flex-1 py-3 px-3 space-y-1">
        {links.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-accent/15 text-accent-hover font-medium'
                  : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
              }`
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="p-3 border-t border-border">
        <button
          onClick={logout}
          className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
        >
          <LogOut size={16} />
          退出登录
        </button>
      </div>
    </aside>
  )
}
