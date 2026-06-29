import { useEffect, useRef } from 'react'

export const IDLE_TIMEOUT_MS = 5 * 60 * 1000

const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click']

/**
 * Logs out after `timeoutMs` with no user activity (mouse, keyboard, scroll, touch).
 */
export function useIdleLogout(onIdle, timeoutMs = IDLE_TIMEOUT_MS) {
  const onIdleRef = useRef(onIdle)
  onIdleRef.current = onIdle

  useEffect(() => {
    let timer
    let lastActivity = Date.now()

    const logout = () => onIdleRef.current()

    const scheduleCheck = () => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        if (Date.now() - lastActivity >= timeoutMs) {
          logout()
        } else {
          scheduleCheck()
        }
      }, timeoutMs)
    }

    const reset = () => {
      lastActivity = Date.now()
      scheduleCheck()
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastActivity >= timeoutMs) {
        logout()
      }
    }

    ACTIVITY_EVENTS.forEach((event) => {
      window.addEventListener(event, reset, { passive: true })
    })
    document.addEventListener('visibilitychange', onVisibilityChange)

    reset()

    return () => {
      clearTimeout(timer)
      ACTIVITY_EVENTS.forEach((event) => {
        window.removeEventListener(event, reset)
      })
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [timeoutMs])
}
