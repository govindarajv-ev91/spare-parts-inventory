import { Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import History from './pages/History'
import Vehicles from './pages/Vehicles'
import Layout from './components/Layout'

const AUTH_KEY = 'spare_parts_auth'

export function isAuthenticated() {
  return sessionStorage.getItem(AUTH_KEY) === 'true'
}

export function setAuthenticated(value) {
  if (value) {
    sessionStorage.setItem(AUTH_KEY, 'true')
  } else {
    sessionStorage.removeItem(AUTH_KEY)
  }
}

function ProtectedRoute({ children }) {
  if (!isAuthenticated()) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="history" element={<History />} />
        <Route path="vehicles" element={<Vehicles />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
