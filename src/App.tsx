import { useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { DataProvider } from './context/DataContext'
import { isLoggedIn } from './lib/auth'
import Layout from './components/layout/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Stocks from './pages/Stocks'
import Portfolio from './pages/Portfolio'
import Valuation from './pages/Valuation'
import Trades from './pages/Trades'
import History from './pages/History'
import PnlOverview from './pages/PnlOverview'
import Settings from './pages/Settings'

export default function App() {
  const [authed, setAuthed] = useState(isLoggedIn)

  if (!authed) {
    return <Login onSuccess={() => setAuthed(true)} />
  }

  return (
    <BrowserRouter>
      <DataProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/stocks" element={<Stocks />} />
            <Route path="/valuation" element={<Valuation />} />
            <Route path="/portfolio" element={<Portfolio />} />
            <Route path="/pnl" element={<PnlOverview />} />
            <Route path="/trades" element={<Trades />} />
            <Route path="/history" element={<History />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
        </Routes>
      </DataProvider>
    </BrowserRouter>
  )
}
