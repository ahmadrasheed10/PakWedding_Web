import { ReactNode, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

interface ProtectedRouteProps {
  children: ReactNode
  requiredRole?: 'admin' | 'vendor' | 'user'
}

export default function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const navigate = useNavigate()
  const { user, token, _hasHydrated } = useAuthStore()

  useEffect(() => {
    // Wait until Zustand has fully loaded from sessionStorage before making decisions
    if (!_hasHydrated) return

    // Check authentication
    if (!token || !user) {
      console.log('[PROTECTED ROUTE] No authentication found, redirecting to login')
      if (requiredRole === 'admin') {
        navigate('/admin/login', { replace: true })
      } else {
        navigate('/login', { replace: true })
      }
      return
    }

    // Check role if required
    if (requiredRole && user.role !== requiredRole) {
      console.log(`[PROTECTED ROUTE] User role ${user.role} does not match required role ${requiredRole}`)
      if (requiredRole === 'admin') {
        navigate('/admin/login', { replace: true })
      } else {
        navigate('/login', { replace: true })
      }
      return
    }

    console.log('[PROTECTED ROUTE] Access granted for user:', user.email, 'Role:', user.role)
  }, [_hasHydrated, token, user, requiredRole, navigate])

  // Show loading screen until store has loaded from sessionStorage
  if (!_hasHydrated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50/30 to-red-50/20 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-16 w-16 border-4 border-primary-200 border-t-primary-600 mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  // If authenticated and authorized, render children
  if (token && user && (!requiredRole || user.role === requiredRole)) {
    return <>{children}</>
  }

  // While checking auth, show loading
  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50/30 to-red-50/20 flex items-center justify-center">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-16 w-16 border-4 border-primary-200 border-t-primary-600 mb-4"></div>
        <p className="text-gray-600">Verifying authentication...</p>
      </div>
    </div>
  )
}
