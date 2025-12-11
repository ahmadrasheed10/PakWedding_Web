import { ReactNode, useEffect } from 'react'
import Navbar from './Navbar'
import Footer from './Footer'
import { useAuthStore } from '../store/authStore'
import { useLocation } from 'react-router-dom'

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const { user, checkSessionExpiry } = useAuthStore()
  const location = useLocation()

  useEffect(() => {
    // Don't check session expiry immediately - wait a bit after page load
    if (!user) return

    let interval: number | null = null
    let handleVisibilityChange: (() => void) | null = null
    let handleFocus: (() => void) | null = null

    // Wait before starting session checks to avoid interfering with login
    const initialDelay = setTimeout(() => {
      // Check session expiry every minute
      interval = setInterval(() => {
        if (user && checkSessionExpiry()) {
          const isOnLoginPage = location.pathname === '/login' ||
            location.pathname === '/admin/login' ||
            location.pathname === '/register' ||
            location.pathname === '/vendor/register'
          if (!isOnLoginPage) {
            alert('Your session has expired. Please log in again.')
            window.location.href = '/login'
          }
        }
      }, 60000) // Check every minute

      // Check session when page becomes visible (user switches back to tab)
      handleVisibilityChange = () => {
        if (!document.hidden && user && checkSessionExpiry()) {
          const isOnLoginPage = location.pathname === '/login' ||
            location.pathname === '/admin/login' ||
            location.pathname === '/register' ||
            location.pathname === '/vendor/register'
          if (!isOnLoginPage) {
            alert('Your session has expired. Please log in again.')
            window.location.href = '/login'
          }
        }
      }

      // Check session when window gets focus (user clicks back into browser)
      handleFocus = () => {
        if (user && checkSessionExpiry()) {
          const isOnLoginPage = location.pathname === '/login' ||
            location.pathname === '/admin/login' ||
            location.pathname === '/register' ||
            location.pathname === '/vendor/register'
          if (!isOnLoginPage) {
            alert('Your session has expired. Please log in again.')
            window.location.href = '/login'
          }
        }
      }

      document.addEventListener('visibilitychange', handleVisibilityChange)
      window.addEventListener('focus', handleFocus)
    }, 5000) // Wait 5 seconds before starting checks

    return () => {
      clearTimeout(initialDelay)
      if (interval) clearInterval(interval)
      if (handleVisibilityChange) document.removeEventListener('visibilitychange', handleVisibilityChange)
      if (handleFocus) window.removeEventListener('focus', handleFocus)
    }
  }, [user, checkSessionExpiry, location.pathname])

  // Check session expiry on mount - but wait longer to avoid interfering with login redirect
  useEffect(() => {
    // Don't check if user just logged in (on dashboard pages)
    const isOnDashboard = location.pathname.includes('/dashboard')
    const isOnLoginPage = location.pathname === '/login' ||
      location.pathname === '/admin/login' ||
      location.pathname === '/register' ||
      location.pathname === '/vendor/register'

    // Skip check entirely if on dashboard or login pages
    if (isOnDashboard || isOnLoginPage || !user) {
      return
    }

    const timer = setTimeout(() => {
      if (user && checkSessionExpiry()) {
        window.location.href = '/login'
      }
    }, 5000) // Wait 5 seconds to allow login redirect and page load to complete

    return () => clearTimeout(timer)
  }, [user, checkSessionExpiry, location.pathname])

  const token = useAuthStore.getState().token

  // Hide header/footer only for authenticated dashboard/management areas.
  const isUserSection =
    location.pathname === '/dashboard' ||
    location.pathname.startsWith('/bookings/') ||
    location.pathname === '/bookings/new' ||
    location.pathname === '/budget-planner' ||
    location.pathname === '/checklist' ||
    location.pathname === '/favorites' ||
    location.pathname === '/reviews' ||
    location.pathname.startsWith('/vendors')

  const isVendorSection =
    location.pathname.startsWith('/vendor/dashboard') ||
    location.pathname.startsWith('/vendor/bookings') ||
    location.pathname.startsWith('/vendor/profile') ||
    location.pathname.startsWith('/vendor/packages') ||
    location.pathname.startsWith('/vendor/reviews')

  const isAdminSection =
    location.pathname.startsWith('/admin/dashboard') ||
    location.pathname.startsWith('/admin/vendors') ||
    location.pathname.startsWith('/admin/users') ||
    location.pathname.startsWith('/admin/reviews') ||
    location.pathname.startsWith('/admin/admin-approvals')

  const hideHeaderFooter = !!(user && token) && (isUserSection || isVendorSection || isAdminSection)

  return (
    <div className="min-h-screen flex flex-col">
      {!hideHeaderFooter && <Navbar />}
      <main className="flex-grow">
        {children}
      </main>
      {!hideHeaderFooter && <Footer />}
    </div>
  )
}

