import { Link } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { useState, useEffect } from 'react'
import api from '../../services/api'
import Sidebar from '../../components/Sidebar'

interface DashboardStats {
  pendingApprovals: number
  pendingAdminApprovals?: number
  flaggedReviews: number
  activeUsers: number
}

export default function AdminDashboard() {
  const { logout } = useAuthStore()

  const sidebarItems = [
    { path: '/admin/dashboard', label: 'Dashboard', icon: '📊' },
    { path: '/admin/vendors', label: 'Vendor Approvals', icon: '✅' },
    { path: '/admin/vendors/add', label: 'Add Vendor', icon: '➕' },
    { path: '/admin/users', label: 'User Management', icon: '👥' },
    { path: '/admin/reviews', label: 'Review Moderation', icon: '⭐' },
    { path: '/admin/admin-approvals', label: 'Admin Approvals', icon: '🔐' },
  ]
  const [stats, setStats] = useState<DashboardStats>({
    pendingApprovals: 0,
    pendingAdminApprovals: 0,
    flaggedReviews: 0,
    activeUsers: 0
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Load stats immediately - ProtectedRoute already verified authentication
    console.log('[ADMIN DASHBOARD] Component mounted, loading stats...')
    loadStats()
    
    const onFocus = () => {
      console.log('[ADMIN DASHBOARD] Window focused, refreshing stats...')
      loadStats()
    }
    window.addEventListener('focus', onFocus)
    
    return () => {
      window.removeEventListener('focus', onFocus)
    }
  }, [])

  const loadStats = async () => {
    try {
      setLoading(true)
      const { data } = await api.get<DashboardStats>('/admin/stats')
      console.log('[ADMIN DASHBOARD] Stats loaded successfully')
      setStats(data)
    } catch (error: any) {
      console.error('[ADMIN DASHBOARD] Error loading stats:', error)
      
      // On 401, logout and redirect (ProtectedRoute will handle redirect)
      if (error.response?.status === 401) {
        console.error('[ADMIN DASHBOARD] Session expired, redirecting to logout')
        window.location.href = '/logout'
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-amber-50 via-orange-50/30 to-red-50/20">
      <Sidebar items={sidebarItems} title="Admin Dashboard" />
      
      <div className="flex-1 flex flex-col pt-16 lg:pt-0">
        {/* Header */}
        <div className="bg-gradient-to-r from-white via-amber-50/60 to-white shadow-lg border-b-2 border-primary-100">
          <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-6 text-left">
            <div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold bg-gradient-to-r from-primary-600 via-accent-600 to-primary-600 bg-clip-text text-transparent">
                Admin Dashboard
              </h1>
              <p className="text-gray-700 mt-1 text-sm sm:text-base font-medium">Manage your platform</p>
            </div>
          </div>
        </div>

        <div className="flex-1 w-full px-4 sm:px-6 py-6 sm:py-8 overflow-y-auto">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 md:gap-8">
            <div className="bg-gradient-to-br from-white to-rose-50/50 rounded-2xl shadow-xl p-8 border-2 border-rose-200 hover:border-[#D72626] transition-all hover:shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <div className="w-16 h-16 bg-gradient-to-br from-[#D72626] to-rose-600 rounded-xl flex items-center justify-center shadow-lg">
                  <span className="text-4xl">⏳</span>
                </div>
              </div>
              <p className="text-gray-600 text-base font-semibold mb-3">Pending Vendor Approvals</p>
              <p className="text-5xl font-extrabold bg-gradient-to-r from-[#D72626] to-rose-600 bg-clip-text text-transparent">{stats.pendingApprovals}</p>
            </div>
            <div className="bg-gradient-to-br from-white to-orange-50/50 rounded-2xl shadow-xl p-8 border-2 border-orange-200 hover:border-orange-400 transition-all hover:shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-amber-600 rounded-xl flex items-center justify-center shadow-lg">
                  <span className="text-4xl">🔐</span>
                </div>
              </div>
              <p className="text-gray-600 text-base font-semibold mb-3">Pending Admin Approvals</p>
              <p className="text-5xl font-extrabold bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">{stats.pendingAdminApprovals || 0}</p>
            </div>
            <div className="bg-gradient-to-br from-white to-amber-50/50 rounded-2xl shadow-xl p-8 border-2 border-amber-200 hover:border-amber-400 transition-all hover:shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <div className="w-16 h-16 bg-gradient-to-br from-amber-500 to-yellow-600 rounded-xl flex items-center justify-center shadow-lg">
                  <span className="text-4xl">🚩</span>
                </div>
              </div>
              <p className="text-gray-600 text-base font-semibold mb-3">Flagged Reviews</p>
              <p className="text-5xl font-extrabold bg-gradient-to-r from-amber-600 to-yellow-600 bg-clip-text text-transparent">{stats.flaggedReviews}</p>
            </div>
            <div className="bg-gradient-to-br from-white to-red-50/50 rounded-2xl shadow-xl p-8 border-2 border-red-200 hover:border-[#D72626] transition-all hover:shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <div className="w-16 h-16 bg-gradient-to-br from-[#D72626] to-red-600 rounded-xl flex items-center justify-center shadow-lg">
                  <span className="text-4xl">👥</span>
                </div>
              </div>
              <p className="text-gray-600 text-base font-semibold mb-3">Active Users</p>
              <p className="text-5xl font-extrabold bg-gradient-to-r from-[#D72626] to-red-600 bg-clip-text text-transparent">{stats.activeUsers.toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
