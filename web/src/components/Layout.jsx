import { useCallback } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { setAuthenticated } from '../App'
import { useIdleLogout } from '../hooks/useIdleLogout'
import './Layout.css'

const NAV = [
  { to: '/', label: 'Stock', icon: '📦', end: true },
  { to: '/vehicles', label: 'Vehicle Master', icon: '🚗' },
  { to: '/history', label: 'Usage History', icon: '📋' },
]

const PAGE_TITLES = {
  '/': 'Stock Management',
  '/vehicles': 'Vehicle Master',
  '/history': 'Usage History',
}

export default function Layout() {
  const navigate = useNavigate()
  const location = useLocation()
  const pageTitle = PAGE_TITLES[location.pathname] || 'Dashboard'

  const handleLogout = useCallback(() => {
    setAuthenticated(false)
    navigate('/login')
  }, [navigate])

  useIdleLogout(() => {
    setAuthenticated(false)
    navigate('/login', { replace: true, state: { reason: 'idle' } })
  })

  return (
    <div className="dash-layout">
      <aside className="dash-sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-logo">EV</div>
          <div>
            <strong>Spare Parts</strong>
            <span>Inventory System</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            >
              <span className="sidebar-icon">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <button type="button" className="sidebar-logout" onClick={handleLogout}>
          <span className="sidebar-icon">⏻</span>
          Logout
        </button>
      </aside>

      <div className="dash-main-wrap">
        <header className="dash-topbar">
          <div>
            <p className="topbar-label">Admin Dashboard</p>
            <h1>{pageTitle}</h1>
          </div>
          <div className="topbar-badge">Live Sync</div>
        </header>
        <main className="dash-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
