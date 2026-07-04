import { Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import History from './pages/History'
import Vehicles from './pages/Vehicles'
import Approvals from './pages/Approvals'
import Documents from './pages/Documents'
import Layout from './components/Layout'
import { isAuthenticated, isAdmin, setSession, clearSession, getSession } from './auth'

export { isAuthenticated, setSession as setAuthenticated, clearSession, getSession, isAdmin }

function ProtectedRoute({ children }) {
  if (!isAuthenticated()) return <Navigate to="/login" replace />
  return children
}

function AdminRoute({ children }) {
  if (!isAuthenticated()) return <Navigate to="/login" replace />
  if (!isAdmin()) return <Navigate to="/" replace />
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
        <Route
          path="vehicles"
          element={
            <AdminRoute>
              <Vehicles />
            </AdminRoute>
          }
        />
        <Route
          path="approvals"
          element={
            <AdminRoute>
              <Approvals />
            </AdminRoute>
          }
        />
        <Route
          path="documents"
          element={
            <AdminRoute>
              <Documents />
            </AdminRoute>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
