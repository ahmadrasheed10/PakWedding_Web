import { Link } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { useState, useEffect } from 'react'
import { getVendorProfile } from '../../services/vendorService'
import Sidebar from '../../components/Sidebar'
import MessageNotification from '../../components/MessageNotification'

export default function VendorDashboard() {
  const { user } = useAuthStore()

  const sidebarItems = [
    { path: '/vendor/dashboard', label: 'Dashboard', icon: '📊' },
    { path: '/vendor/bookings', label: 'Bookings', icon: '📅' },
    { path: '/vendor/messages', label: 'Messages', icon: '💬' },
    { path: '/vendor/profile', label: 'Profile', icon: '👤' },
    { path: '/vendor/packages', label: 'Packages', icon: '📦' },
    { path: '/vendor/reviews', label: 'Reviews', icon: '⭐' },
  ]
  const [stats, setStats] = useState({
    totalBookings: 0,
    pendingRequests: 0,
    averageRating: 0.0,
    totalRevenue: 'Rs. 0'
  })
  const [loading, setLoading] = useState(true)
  const [vendorStatus, setVendorStatus] = useState<{
    is_approved: boolean
    is_active: boolean
  } | null>(null)

  useEffect(() => {
    const loadStats = async () => {
      try {
        const vendor = await getVendorProfile()
        setStats({
          totalBookings: vendor.total_bookings || 0,
          pendingRequests: vendor.pending_requests || 0,
          averageRating: vendor.rating || 0.0,
          totalRevenue: vendor.total_revenue 
            ? `Rs. ${(vendor.total_revenue / 1000000).toFixed(1)}M` 
            : 'Rs. 0'
        })
        setVendorStatus({
          is_approved: vendor.is_approved || false,
          is_active: vendor.is_active || false
        })
      } catch (err) {
        console.error('Error loading vendor stats:', err)
      } finally {
        setLoading(false)
      }
    }
    loadStats()
  }, [])

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-amber-50 via-orange-50/30 to-red-50/20">
      <Sidebar items={sidebarItems} title="Vendor Dashboard" />

      <MessageNotification />
      
      <div className="flex-1 flex flex-col pt-16 lg:pt-0">
        {/* Header */}
        <div className="bg-gradient-to-r from-white via-amber-50/60 to-white shadow-lg border-b-2 border-primary-100">
          <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-6 text-left">
            <div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold bg-gradient-to-r from-primary-600 via-accent-600 to-primary-600 bg-clip-text text-transparent">
                Vendor Dashboard
              </h1>
              <p className="text-gray-700 mt-1 text-sm sm:text-base font-medium">Welcome back, {user?.full_name || 'Vendor'}</p>
            </div>
          </div>
        </div>

        <div className="flex-1 container mx-auto px-6 py-8 overflow-y-auto">
        {/* Approval Status Banner */}
        {vendorStatus && !vendorStatus.is_approved && (
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-6 mb-8 rounded-lg">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className="h-6 w-6 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3 flex-1">
                <h3 className="text-lg font-bold text-yellow-800 mb-2">Account Pending Approval</h3>
                <p className="text-yellow-700 mb-2">
                  Your vendor account is currently pending admin approval. You can manage your profile and packages, but your business will not be visible to customers until approved.
                </p>
                <p className="text-sm text-yellow-600">
                  We'll notify you once your account has been reviewed and approved.
                </p>
              </div>
            </div>
          </div>
        )}
        
        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 md:gap-8 mb-6 sm:mb-8">
          <div className="bg-gradient-to-br from-white to-rose-50/50 rounded-2xl shadow-xl p-8 border-2 border-rose-200 hover:border-[#D72626] transition-all hover:shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-[#D72626] to-rose-600 rounded-xl flex items-center justify-center shadow-lg">
                <span className="text-4xl">💒</span>
              </div>
            </div>
            <p className="text-gray-600 text-base font-semibold mb-3">Total Bookings</p>
            <p className="text-5xl font-extrabold bg-gradient-to-r from-[#D72626] to-rose-600 bg-clip-text text-transparent">
              {loading ? '...' : stats.totalBookings}
            </p>
          </div>
          <div className="bg-gradient-to-br from-white to-orange-50/50 rounded-2xl shadow-xl p-8 border-2 border-orange-200 hover:border-orange-400 transition-all hover:shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-amber-600 rounded-xl flex items-center justify-center shadow-lg">
                <span className="text-4xl">⏰</span>
              </div>
            </div>
            <p className="text-gray-600 text-base font-semibold mb-3">Pending Requests</p>
            <p className="text-5xl font-extrabold bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">
              {loading ? '...' : stats.pendingRequests}
            </p>
          </div>
          <div className="bg-gradient-to-br from-white to-amber-50/50 rounded-2xl shadow-xl p-8 border-2 border-amber-200 hover:border-amber-400 transition-all hover:shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-amber-500 to-yellow-600 rounded-xl flex items-center justify-center shadow-lg">
                <span className="text-4xl">✨</span>
              </div>
            </div>
            <p className="text-gray-600 text-base font-semibold mb-3">Average Rating</p>
            <p className="text-5xl font-extrabold bg-gradient-to-r from-amber-600 to-yellow-600 bg-clip-text text-transparent">
              {loading ? '...' : stats.averageRating.toFixed(1)}
            </p>
          </div>
          <div className="bg-gradient-to-br from-white to-red-50/50 rounded-2xl shadow-xl p-8 border-2 border-red-200 hover:border-[#D72626] transition-all hover:shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-[#D72626] to-red-600 rounded-xl flex items-center justify-center shadow-lg">
                <span className="text-4xl">💵</span>
              </div>
            </div>
            <p className="text-gray-600 text-base font-semibold mb-3">Total Revenue</p>
            <p className="text-5xl font-extrabold bg-gradient-to-r from-[#D72626] to-red-600 bg-clip-text text-transparent">
              {loading ? '...' : stats.totalRevenue}
            </p>
          </div>
        </div>
        </div>
      </div>
    </div>
  )
}
