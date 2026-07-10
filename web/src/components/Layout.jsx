import { useCallback, useMemo } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { clearSession, getSession, isAdmin } from '../auth'
import { useIdleLogout } from '../hooks/useIdleLogout'
import './Layout.css'

const ADMIN_NAV = [
  { to: '/', label: 'Stock', icon: '📦', end: true },
  { to: '/approvals', label: 'Approvals', icon: '✅' },
  { to: '/documents', label: 'Documents', icon: '📎' },
  { to: '/vehicles', label: 'Vehicle Master', icon: '🚗' },
  { to: '/history', label: 'Usage History', icon: '📋' },
]

const HUB_NAV = [
  { to: '/', label: 'Stock', icon: '📦', end: true },
  { to: '/history', label: 'Usage History', icon: '📋' },
]

const PAGE_TITLES = {
  '/': 'Stock Management',
  '/vehicles': 'Vehicle Master',
  '/history': 'Usage History',
  '/approvals': 'Stock Approvals',
  '/documents': 'Uploaded Documents',
}

export default function Layout() {
  const navigate = useNavigate()
  const location = useLocation()
  const session = getSession()
  const admin = isAdmin()
  const nav = useMemo(() => (admin ? ADMIN_NAV : HUB_NAV), [admin])
  const pageTitle = PAGE_TITLES[location.pathname] || 'Dashboard'
  const roleLabel = admin
    ? 'Admin Dashboard'
    : `HUB: ${session?.hubName || session?.displayName || 'User'}`

  const handleLogout = useCallback(() => {
    clearSession()
    navigate('/login')
  }, [navigate])

  useIdleLogout(() => {
    clearSession()
    navigate('/login', { replace: true, state: { reason: 'idle' } })
  })

  return (
    <div className="dash-layout">
      <aside className="dash-sidebar">
        <div className="sidebar-brand">
          <img src="/logo.png" alt="EV91 Spare Parts" className="sidebar-logo" />
          <div>
            <strong>EV91</strong>
            <span>Spare Parts Inventory</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          {nav.map((item) => (
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
            <p className="topbar-label">{roleLabel}</p>
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
