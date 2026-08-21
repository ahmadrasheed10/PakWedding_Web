import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuthStore } from '../../store/authStore'
import api from '../../services/api'
import Sidebar from '../../components/Sidebar'
import Chatbot from '../../components/Chatbot'
import MessageNotification from '../../components/MessageNotification'

interface DashboardStats {
  bookings: number
  favorites: number
  budget: string
  reviews: number
}

export default function UserDashboard() {
  const user = useAuthStore((state) => state.user)
  const userName = user?.full_name?.split(' ')[0] || 'User'

  const sidebarItems = [
    { path: '/dashboard', label: 'Dashboard', icon: '📊' },
    { path: '/vendors', label: 'Find Vendors', icon: '🔍' },
    { path: '/bookings/history', label: 'My Bookings', icon: '📅' },
    { path: '/messages', label: 'Messages', icon: '💬' },
    { path: '/budget-planner', label: 'Budget Planner', icon: '💰' },
    { path: '/checklist', label: 'Checklist', icon: '✅' },
    { path: '/favorites', label: 'Favorites', icon: '❤️' },
    { path: '/reviews', label: 'My Reviews', icon: '⭐' },
  ]
  const [stats, setStats] = useState<DashboardStats>({
    bookings: 0,
    favorites: 0,
    budget: 'Rs. 0',
    reviews: 0
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
    try {
      setLoading(true)
      // Fetch bookings
      try {
        const bookingsRes = await api.get('/bookings/my-bookings')
        const bookings = bookingsRes.data || []
        setStats(prev => ({ ...prev, bookings: bookings.length }))
      } catch (err) {
        console.log('No bookings found')
      }

      // Fetch favorites (if endpoint exists)
      try {
        const favoritesRes = await api.get('/favorites')
        const favorites = favoritesRes.data || []
        setStats(prev => ({ ...prev, favorites: favorites.length }))
      } catch (err) {
        console.log('No favorites found')
      }

      // Budget would come from budget planner - for now use placeholder
      setStats(prev => ({ ...prev, budget: 'Rs. 500K' }))

      // Reviews count
      try {
        const reviewsRes = await api.get('/reviews/user')
        const reviews = reviewsRes.data || []
        setStats(prev => ({ ...prev, reviews: reviews.length }))
      } catch (err) {
        console.log('No reviews found')
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-amber-50 via-orange-50/30 to-red-50/20">
      <Sidebar items={sidebarItems} title="User Dashboard" />

      <MessageNotification />
      
      <div className="flex-1 flex flex-col pt-16 lg:pt-0">
        {/* Modern Elegant Header */}
        <div className="bg-gradient-to-r from-white via-amber-50/60 to-white shadow-md border-b-2 border-primary-100">
          <div className="container mx-auto max-w-7xl px-4 sm:px-6 py-4 sm:py-6">
            <div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold bg-gradient-to-r from-[#D72626] via-[#F26D46] to-[#F7A76C] bg-clip-text text-transparent">
                Welcome back, {userName}!
              </h1>
              <p className="text-gray-600 text-base sm:text-lg mt-1">Let's plan your perfect wedding</p>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 py-6 sm:py-8 md:py-10 px-4 sm:px-6 overflow-y-auto">
          <div className="container mx-auto max-w-7xl">

        {/* Summary Cards */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white rounded-2xl shadow-xl p-8 animate-pulse border-2 border-gray-200">
                <div className="h-16 bg-gray-200 rounded-xl mb-6"></div>
                <div className="h-6 bg-gray-200 rounded mb-3"></div>
                <div className="h-12 bg-gray-200 rounded"></div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
            {/* My Bookings Card */}
            <div className="group bg-gradient-to-br from-white to-rose-50/50 rounded-2xl shadow-xl p-8 border-2 border-rose-200 hover:border-[#D72626] transition-all hover:shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <div className="w-16 h-16 bg-gradient-to-br from-[#D72626] to-rose-600 rounded-xl flex items-center justify-center shadow-lg">
                  <span className="text-4xl">📅</span>
                </div>
              </div>
              <p className="text-gray-600 text-base font-semibold mb-3">My Bookings</p>
              <p className="text-5xl font-extrabold bg-gradient-to-r from-[#D72626] to-rose-600 bg-clip-text text-transparent">{stats.bookings}</p>
            </div>

            {/* Favorites Card */}
            <div className="group bg-gradient-to-br from-white to-orange-50/50 rounded-2xl shadow-xl p-8 border-2 border-orange-200 hover:border-orange-400 transition-all hover:shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-amber-600 rounded-xl flex items-center justify-center shadow-lg">
                  <span className="text-4xl">❤️</span>
                </div>
              </div>
              <p className="text-gray-600 text-base font-semibold mb-3">Favorites</p>
              <p className="text-5xl font-extrabold bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">{stats.favorites}</p>
            </div>

            {/* Budget Card */}
            <div className="group bg-gradient-to-br from-white to-rose-50/50 rounded-2xl shadow-xl p-8 border-2 border-rose-200 hover:border-[#D72626] transition-all hover:shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <div className="w-16 h-16 bg-gradient-to-br from-[#D72626] to-rose-600 rounded-xl flex items-center justify-center shadow-lg">
                  <span className="text-4xl">💰</span>
                </div>
              </div>
              <p className="text-gray-600 text-base font-semibold mb-3">Budget</p>
              <p className="text-3xl font-extrabold bg-gradient-to-r from-[#D72626] to-rose-600 bg-clip-text text-transparent">{stats.budget}</p>
            </div>

            {/* Reviews Card */}
            <div className="group bg-gradient-to-br from-white to-red-50/50 rounded-2xl shadow-xl p-8 border-2 border-red-200 hover:border-[#D72626] transition-all hover:shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <div className="w-16 h-16 bg-gradient-to-br from-[#D72626] to-red-600 rounded-xl flex items-center justify-center shadow-lg">
                  <span className="text-4xl">⭐</span>
                </div>
              </div>
              <p className="text-gray-600 text-base font-semibold mb-3">Reviews</p>
              <p className="text-5xl font-extrabold bg-gradient-to-r from-[#D72626] to-red-600 bg-clip-text text-transparent">{stats.reviews}</p>
            </div>
          </div>
        )}

          </div>
        </div>
        
      </div>
      <Chatbot/>
    </div>
  )
}
