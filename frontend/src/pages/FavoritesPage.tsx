import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import api from '../services/api'
import { fetchVendors, Vendor } from '../services/vendorService'
import Sidebar from '../components/Sidebar'

interface Favorite {
  id: string
  vendor_id: string
  created_at: string
}

export default function FavoritesPage() {
  const { user } = useAuthStore()
  const [favorites, setFavorites] = useState<Favorite[]>([])
  const [vendors, setVendors] = useState<Record<string, Vendor>>({})
  const [loading, setLoading] = useState(true)
  const token = useAuthStore.getState().token

  const sidebarItems = [
    { path: '/dashboard', label: 'Dashboard', icon: '📊' },
    { path: '/vendors', label: 'Find Vendors', icon: '🔍' },
    { path: '/bookings/history', label: 'My Bookings', icon: '📅' },
    { path: '/budget-planner', label: 'Budget Planner', icon: '💰' },
    { path: '/checklist', label: 'Checklist', icon: '✅' },
    { path: '/favorites', label: 'Favorites', icon: '❤️' },
    { path: '/reviews', label: 'My Reviews', icon: '⭐' },
  ]

  useEffect(() => {
    const checkAndLoad = async () => {
      if (!user) {
        setLoading(false)
        return
      }
      
      // Check token from store
      let currentToken = token || useAuthStore.getState().token
      
      // If no token, wait for Zustand persist to hydrate (up to 1 second)
      if (!currentToken) {
        for (let i = 0; i < 10; i++) {
          await new Promise(resolve => setTimeout(resolve, 100))
          currentToken = useAuthStore.getState().token
          if (currentToken) break
        }
      }
      
      if (currentToken) {
        await loadFavorites()
      } else {
        console.warn('Token not available - user may need to log in')
        setLoading(false)
      }
    }
    
    checkAndLoad()
  }, [user, token])

  const loadFavorites = async () => {
    try {
      setLoading(true)
      
      // Double-check token is available right before API call
      const currentToken = useAuthStore.getState().token
      if (!currentToken) {
        console.warn('No token available for favorites request')
        setLoading(false)
        return
      }
      
      const response = await api.get('/favorites/')
      const favoritesData = response.data || []
      setFavorites(favoritesData)

      // Load vendor details for each favorite
      const vendorIds = favoritesData.map((f: Favorite) => f.vendor_id)
      const allVendors = await fetchVendors(undefined, 500)
      const vendorMap: Record<string, Vendor> = {}
      allVendors.forEach((v: Vendor) => {
        if (vendorIds.includes(v._id || v.id)) {
          vendorMap[v._id || v.id] = v
        }
      })
      setVendors(vendorMap)
    } catch (err: any) {
      if (err.response?.status === 401) {
        const errorDetail = err.response?.data?.detail || 'Unknown error'
        console.error('401 error loading favorites:', errorDetail)
        
        // Check if token exists - if not, it's a hydration issue
        const currentToken = useAuthStore.getState().token
        if (!currentToken) {
          console.warn('Token not available - may be hydration issue')
          // Try reloading after a short delay
          setTimeout(() => {
            const retryToken = useAuthStore.getState().token
            if (retryToken) {
              loadFavorites()
            } else {
              setLoading(false)
            }
          }, 500)
          return
        }
        
        // Token exists but request failed - likely expired or invalid
        if (errorDetail.includes('credentials') || errorDetail.includes('expired') || errorDetail.includes('invalid') || errorDetail.includes('Not authenticated')) {
          window.location.href = '/logout'
        } else {
          console.warn('401 error but not a credentials issue:', errorDetail)
          setLoading(false)
        }
      } else {
        console.error('Error loading favorites:', err)
        setLoading(false)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveFavorite = async (vendorId: string) => {
    if (!confirm('Remove this vendor from favorites?')) return
    
    try {
      await api.delete(`/favorites/${vendorId}`)
      setFavorites(prev => prev.filter(f => f.vendor_id !== vendorId))
    } catch (err: any) {
      console.error('Error removing favorite:', err)
      alert(err.response?.data?.detail || 'Failed to remove favorite')
    }
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50/30 to-red-50/20 flex items-center justify-center">
        <div className="text-center p-8 bg-white rounded-xl shadow-lg border border-rose-100">
          <p className="text-xl text-gray-700 mb-4">Please log in to view your favorites.</p>
          <Link to="/login" className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors shadow-md">
            Login Now
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-amber-50 via-orange-50/30 to-red-50/20">
      <Sidebar items={sidebarItems} title="User Dashboard" />
      <div className="flex-1 flex flex-col overflow-y-auto pt-16 lg:pt-0">
        <div className="py-12 px-4 sm:px-6">
          <div className="container mx-auto max-w-6xl">
        <div className="mb-8 flex flex-col gap-2">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 text-[#D72626] hover:text-[#F26D46] font-semibold transition-colors w-fit"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Dashboard
          </Link>
          <h1 className="text-4xl font-extrabold bg-gradient-to-r from-primary-600 via-accent-600 to-primary-600 bg-clip-text text-transparent mb-2 leading-normal">
            My Favorites
          </h1>
          <p className="text-gray-600">Your saved wedding vendors</p>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-primary-200 border-t-primary-600"></div>
            <p className="text-gray-600 mt-4">Loading favorites...</p>
          </div>
        ) : favorites.length === 0 ? (
          <div className="bg-white rounded-xl shadow-lg p-12 text-center border-2 border-gray-100">
            <div className="text-6xl mb-4">❤️</div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">No favorites yet</h3>
            <p className="text-gray-600 mb-6">Start exploring vendors and add them to your favorites!</p>
            <Link
              to="/vendors"
              className="bg-gradient-to-r from-primary-600 via-accent-600 to-primary-600 hover:from-primary-700 hover:via-accent-700 hover:to-primary-700 text-white px-6 py-3 rounded-lg font-semibold transition-all duration-300 shadow-lg hover:shadow-xl inline-block"
            >
              Browse Vendors
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {favorites.map((favorite) => {
              const vendor = vendors[favorite.vendor_id]
              if (!vendor) return null

              return (
                <div
                  key={favorite.id}
                  className="bg-white rounded-2xl shadow-lg overflow-hidden border-2 border-pink-100 transition-all duration-300 hover:shadow-2xl hover:scale-105 hover:border-pink-400 group"
                >
                  <div className="bg-gradient-to-br from-pink-100 to-purple-100 h-48 w-full overflow-hidden relative">
                    <Link
                      to={`/vendors/${vendor._id || vendor.id}`}
                      className="block w-full h-full"
                    >
                      {vendor.image_url ? (
                        <img
                          src={vendor.image_url.startsWith('http') ? vendor.image_url : `http://localhost:8000${vendor.image_url}`}
                          alt={vendor.business_name}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none'
                          }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                          No Image
                        </div>
                      )}
                    </Link>
                    <button
                      onClick={() => handleRemoveFavorite(favorite.vendor_id)}
                      className="absolute top-3 right-3 z-20 bg-white/90 hover:bg-white rounded-full p-2 shadow-lg transition-all duration-300 hover:scale-110"
                      title="Remove from favorites"
                    >
                      <span className="text-2xl text-red-500">❤️</span>
                    </button>
                  </div>
                  <div className="p-6 bg-gradient-to-br from-white to-pink-50/30">
                    <p className="text-sm font-semibold bg-gradient-to-r from-red-600 to-orange-600 bg-clip-text text-transparent mb-2">
                      {vendor.service_category}
                    </p>
                    <h3 className="text-xl font-bold text-gray-900 mb-3">{vendor.business_name}</h3>
                    <div className="flex items-center gap-3 text-sm text-gray-600 mb-3">
                      <span className="flex items-center gap-1">
                        <svg className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                        {vendor.rating ?? 4.8}
                      </span>
                      <span>•</span>
                      <span>{vendor.business_address}</span>
                    </div>
                    <Link
                      to={`/vendors/${vendor._id || vendor.id}`}
                      className="inline-flex items-center gap-2 bg-gradient-to-r from-red-600 to-orange-600 bg-clip-text text-transparent font-semibold hover:underline"
                    >
                      View Profile →
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        )}
          </div>
        </div>
      </div>
    </div>
  )
}

