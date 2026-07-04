const AUTH_KEY = 'spare_parts_auth'
const SESSION_KEY = 'spare_parts_session'

export function isAuthenticated() {
  return sessionStorage.getItem(AUTH_KEY) === 'true'
}

export function getSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function isAdmin() {
  return getSession()?.role === 'admin'
}

export function isHubUser() {
  return getSession()?.role === 'hub'
}

export function setSession(session) {
  if (session) {
    sessionStorage.setItem(AUTH_KEY, 'true')
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))
  } else {
    sessionStorage.removeItem(AUTH_KEY)
    sessionStorage.removeItem(SESSION_KEY)
  }
}

export function clearSession() {
  setSession(null)
}
