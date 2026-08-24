import { useEffect, useRef } from 'react'
import { useAuth, useUser } from '@clerk/clerk-react'
import { useAuthStore } from '../store/authStore'

export default function ClerkSessionSync() {
  const { isLoaded, isSignedIn, getToken } = useAuth()
  const { user: clerkUser } = useUser()
  const setAuth = useAuthStore((state) => state.setAuth)
  const logout = useAuthStore((state) => state.logout)
  // Track whether we already synced this session so we don't spam the backend
  const syncedRef = useRef(false)

  useEffect(() => {
    async function syncSession() {
      if (!isLoaded) return

      if (isSignedIn && clerkUser) {
        try {
          // Protect local JWT sessions from being overwritten by Clerk
          const currentToken = useAuthStore.getState().token
          if (currentToken) {
            try {
              const payload = JSON.parse(atob(currentToken.split('.')[1]))
              const isClerk = payload.iss && (payload.iss.includes('clerk') || payload.iss.includes('clerk.accounts'))
              if (!isClerk) {
                // This is a local token (like an Admin login). Do not overwrite it!
                return
              }
            } catch (e) { }
          }

          const token = await getToken()
          if (!token) return

          // Determine role from Clerk metadata as a starting point
          const clerkRole =
            (clerkUser.publicMetadata?.role as string) ||
            (clerkUser.unsafeMetadata?.role as string) ||
            'user'

          const fullName =
            `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() ||
            'Clerk User'

          // Optimistically set auth so UI is not blocked
          const userObj = {
            id: clerkUser.id,
            email: clerkUser.primaryEmailAddress?.emailAddress || '',
            full_name: fullName,
            role: clerkRole,
          }
          setAuth(userObj, token)

          // Only hit the backend once per sign-in to trigger MongoDB sync
          if (!syncedRef.current) {
            syncedRef.current = true
            try {
              const apiBase = import.meta.env.VITE_API_URL || '/api'
              const res = await fetch(`${apiBase}/users/me`, {
                headers: { Authorization: `Bearer ${token}` },
              })
              if (res.ok) {
                const backendUser = await res.json()
                // Use the backend's authoritative role and full_name
                const syncedUser = {
                  id: backendUser.id || clerkUser.id,
                  email: backendUser.email || userObj.email,
                  full_name: backendUser.full_name || fullName,
                  role: backendUser.role || clerkRole,
                }
                setAuth(syncedUser, token)
              }
            } catch (backendErr) {
              // Backend might be offline — keep the optimistic local state
              console.warn('[ClerkSessionSync] Backend sync failed, using local state:', backendErr)
            }
          }
        } catch (err) {
          console.error('[ClerkSessionSync] Error syncing Clerk session:', err)
        }
      } else if (isLoaded && !isSignedIn) {
        const token = useAuthStore.getState().token
        if (token) {
          try {
            const payload = JSON.parse(atob(token.split('.')[1]))
            if (payload.iss && (payload.iss.includes('clerk') || payload.iss.includes('clerk.accounts'))) {
              logout()
            }
          } catch (e) {
            logout()
          }
        } else {
          logout()
        }
        syncedRef.current = false
      }
    }

    syncSession()

    // Refresh the Clerk token every 55 seconds (tokens expire every 60s by default)
    const interval = setInterval(async () => {
      if (!isLoaded || !isSignedIn || !clerkUser) return
      try {
        // Protect local JWT sessions from being overwritten during refresh
        const currentToken = useAuthStore.getState().token
        if (currentToken) {
          try {
            const payload = JSON.parse(atob(currentToken.split('.')[1]))
            const isClerk = payload.iss && (payload.iss.includes('clerk') || payload.iss.includes('clerk.accounts'))
            if (!isClerk) return
          } catch (e) { }
        }

        const token = await getToken()
        if (token) {
          const currentUser = useAuthStore.getState().user
          if (currentUser) {
            setAuth(currentUser, token)
          }
        }
      } catch (e) {
        console.warn('[ClerkSessionSync] Token refresh failed:', e)
      }
    }, 55 * 1000)

    return () => clearInterval(interval)
  }, [isLoaded, isSignedIn, clerkUser, getToken, setAuth, logout])

  return null
}
