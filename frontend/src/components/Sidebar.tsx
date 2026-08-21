import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useState, useEffect } from 'react'
import { useClerk } from '@clerk/clerk-react'
import api from '../services/api'

interface SidebarItem {
  path: string
  label: string
  icon: string
}

interface SidebarProps {
  items: SidebarItem[]
  title: string
  userRole?: string
}

export default function Sidebar({ items, title, userRole }: SidebarProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const { logout, user } = useAuthStore()
  const clerk = useClerk()
  const [isOpen, setIsOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    const fetchUnreadCount = async () => {
      try {
        const endpoint =
          user?.role === 'vendor'
            ? '/chat/conversations/vendor'
            : '/chat/conversations/user'
  
        const response = await api.get(endpoint)
        const conversations = response.data
  
        const totalUnread = conversations.reduce(
          (sum: number, conv: any) => sum + (conv.unread_count || 0),
          0
        )
  
        setUnreadCount(totalUnread)
      } catch (error) {
        console.error('Failed to fetch unread count:', error)
      }
    }
  
    if (user) {
      fetchUnreadCount()
  
      // Update badge every 2 seconds
      const interval = setInterval(fetchUnreadCount, 2000)
  
      return () => clearInterval(interval)
    }
  }, [user])

  const ADMIN_SIDEBAR_ITEMS = [
    { path: '/admin/dashboard', label: 'Dashboard', icon: '📊' },
    { path: '/admin/vendors', label: 'Vendor Approvals', icon: '🏢' },
    { path: '/admin/users', label: 'User Management', icon: '👥' },
    { path: '/admin/reviews', label: 'Review Moderation', icon: '⭐' },
    { path: '/admin/admin-approvals', label: 'Admin Access', icon: '🔐' },
  ]

  const VENDOR_SIDEBAR_ITEMS = [
    { path: '/vendor/dashboard', label: 'Dashboard', icon: '📊' },
    { path: '/vendor/bookings', label: 'Bookings', icon: '📅' },
    { path: '/vendor/messages', label: 'Messages', icon: '💬' },
    { path: '/vendor/profile', label: 'Profile', icon: '👤' },
    { path: '/vendor/packages', label: 'Packages', icon: '📦' },
    { path: '/vendor/reviews', label: 'Reviews', icon: '⭐' },
  ]

  const USER_SIDEBAR_ITEMS = [
    { path: '/dashboard', label: 'Dashboard', icon: '📊' },
    { path: '/vendors', label: 'Find Vendors', icon: '🔍' },
    { path: '/bookings/history', label: 'My Bookings', icon: '📅' },
    { path: '/messages', label: 'Messages', icon: '💬' },
    { path: '/budget-planner', label: 'Budget Planner', icon: '💰' },
    { path: '/checklist', label: 'Checklist', icon: '✅' },
    { path: '/favorites', label: 'Favorites', icon: '❤️' },
    { path: '/reviews', label: 'My Reviews', icon: '⭐' },
  ]

  let displayItems = items
  if (user?.role === 'admin') displayItems = ADMIN_SIDEBAR_ITEMS
  else if (user?.role === 'vendor') displayItems = VENDOR_SIDEBAR_ITEMS
  else if (user?.role === 'user') displayItems = USER_SIDEBAR_ITEMS

  const handleLogout = async () => {
    try {
      if (clerk?.signOut) await clerk.signOut()
    } catch (err) {
      console.warn('[Sidebar] Clerk sign-out failed, clearing local session anyway:', err)
    } finally {
      logout()
      navigate('/')
    }
  }

  const toggleSidebar = () => {
    setIsOpen(!isOpen)
  }

  const closeSidebar = () => {
    setIsOpen(false)
  }

  return (
    <>
      {/* Mobile Hamburger Button */}
      <button
        onClick={toggleSidebar}
        className="lg:hidden fixed top-4 left-4 z-50 bg-gradient-to-r from-[#D72626] to-red-600 text-white p-3 rounded-lg shadow-lg hover:shadow-xl transition-all"
        aria-label="Toggle menu"
      >
        {isOpen ? (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        )}
      </button>

      {/* Overlay */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar */}
      <div className={`
        w-64 bg-gradient-to-b from-white via-rose-50/30 to-amber-50/30 border-r-2 border-rose-200 h-screen flex flex-col shadow-lg 
        fixed lg:sticky top-0 flex-shrink-0 z-40 transition-transform duration-300
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Navigation Items */}
        <nav className="flex-1 p-4 pt-6 space-y-2">
          {displayItems.map((item) => {
            const isDashboardPath = ['/dashboard', '/vendor/dashboard', '/admin/dashboard']
            const isExactOnlyPath = ['/admin/vendors']
            const isActive =
              location.pathname === item.path ||
              (!isDashboardPath.includes(item.path) &&
                !isExactOnlyPath.includes(item.path) &&
                location.pathname.startsWith(item.path))

            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={closeSidebar}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${isActive
                    ? 'bg-gradient-to-r from-[#D72626] to-rose-600 text-white shadow-md'
                    : 'text-gray-800 hover:bg-rose-50 hover:text-[#D72626]'
                  }`}
              >
                <span
                  className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg font-semibold shadow-sm ${isActive
                      ? 'bg-gradient-to-br from-[#F26D46] via-[#D72626] to-[#F7A76C] text-white'
                      : 'bg-white text-gray-800 border border-rose-100'
                    }`}
                >
                  {item.icon}
                </span>
                <span className={`font-semibold ${isActive ? 'text-white' : 'text-gray-800'}`}>{item.label}</span>
                {item.label === 'Messages' && unreadCount > 0 && (
                  <span className="ml-auto bg-[#D72626] text-white text-xs font-bold rounded-full h-6 min-w-[24px] flex items-center justify-center px-2">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        {/* Logout Button */}
        <div className="p-4 border-t-2 border-rose-200">
          <button
            onClick={() => {
              closeSidebar()
              handleLogout()
            }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-gradient-to-r from-[#D72626] to-red-600 hover:from-red-700 hover:to-red-800 text-white font-semibold shadow-md hover:shadow-lg transition-all"
          >
            <span className="text-xl">🚪</span>
            <span>Logout</span>
          </button>
        </div>
      </div>
    </>
  )
}

