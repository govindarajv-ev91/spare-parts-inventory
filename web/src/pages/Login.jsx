import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { setAuthenticated } from '../App'
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

  const handleSubmit = (e) => {
    e.preventDefault()
    setError('')

    if (username.trim() === ADMIN_USER && password === ADMIN_PASS) {
      setAuthenticated(true)
      navigate('/')
    } else {
      setError('Invalid username or password')
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <span className="login-icon">🔧</span>
          <h1>Spare Parts Inventory</h1>
          <p>Admin login to manage stock</p>
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
              placeholder="Admin"
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

          <button type="submit" className="btn-primary">
            Sign In
          </button>
        </form>
      </div>
    </div>
  )
}
