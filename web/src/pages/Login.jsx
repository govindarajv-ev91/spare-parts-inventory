import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { setSession } from '../auth'
import { supabase } from '../supabaseClient'
import './Login.css'

const ADMIN_USER = 'Admin'
const ADMIN_PASS = '0000'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const idleLogout = location.state?.reason === 'idle'
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const user = username.trim()
    const pass = password

    try {
      if (user === ADMIN_USER && pass === ADMIN_PASS) {
        setSession({ role: 'admin', displayName: 'Admin' })
        navigate('/')
        return
      }

      const { data: hubs, error: err } = await supabase
        .from('hubs')
        .select('id, name, password, city_id, cities(name)')

      if (err) {
        setError(err.message)
        return
      }

      const hub = (hubs || []).find(
        (h) =>
          h.name?.toLowerCase() === user.toLowerCase() &&
          h.password != null &&
          String(h.password) === pass
      )

      if (!hub) {
        setError('Invalid username or password')
        return
      }

      setSession({
        role: 'hub',
        displayName: hub.name,
        hubId: hub.id,
        hubName: hub.name,
        cityId: hub.city_id,
        cityName: hub.cities?.name || '',
      })
      navigate('/')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <span className="login-icon">🔧</span>
          <h1>Spare Parts Inventory</h1>
          <p>Admin or HUB login</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {idleLogout && (
            <div className="login-info">
              You were logged out after 5 minutes of inactivity. Please sign in again.
            </div>
          )}
          {error && <div className="login-error">{error}</div>}

          <label>
            <span>Username</span>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Admin or HUB name"
              autoComplete="username"
              required
            />
          </label>

          <label>
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••"
              autoComplete="current-password"
              required
            />
          </label>

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}
