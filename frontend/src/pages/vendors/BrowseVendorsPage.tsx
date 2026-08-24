import { Link } from 'react-router-dom'
import { useEffect, useState, useMemo } from 'react'
import { fetchVendors, Vendor } from '../../services/vendorService'
import BookingModal from '../../components/BookingModal'
import { useAuthStore } from '../../store/authStore'
import { getRandomVendorImages, getVendorImagesByCategory } from '../../config/vendorImages'
import api from '../../services/api'
import Sidebar from '../../components/Sidebar'

const extractCityFromAddress = (address: string): string => {
  if (!address) return '';
  const lowerAddr = address.toLowerCase();
  
  const majorCities = [
    'Lahore', 'Islamabad', 'Karachi', 'Rawalpindi', 'Faisalabad', 
    'Multan', 'Peshawar', 'Quetta', 'Sialkot', 'Gujranwala', 
    'Hyderabad', 'Abbottabad', 'Bahawalpur', 'Sargodha', 'Sukkur',
    'Kashmir', 'Muzaffarabad', 'Gilgit', 'Skardu', 'Gwadar'
  ];

  for (const city of majorCities) {
    if (lowerAddr.includes(city.toLowerCase())) {
      if (['Kashmir', 'Gilgit', 'Skardu'].includes(city)) {
        return city;
      }
      return `${city}, Pakistan`;
    }
  }

  const parts = address.split(',').map(p => p.trim()).filter(Boolean);
  let candidate = address;
  if (parts.length >= 2) {
    const last = parts[parts.length - 1];
    const secondLast = parts[parts.length - 2];
    if (last.toLowerCase() === 'pakistan' || last.toLowerCase() === 'pk') {
      candidate = `${secondLast}, Pakistan`;
    } else {
      candidate = last;
    }
  }
  
  const invalidKeywords = ['house', 'street', 'road', 'phase', 'town', 'plot', 'block', 'sector', 'society', 'colony', 'market', 'area', 'shop'];
  const lowerCand = candidate.toLowerCase();
  for (const kw of invalidKeywords) {
    if (lowerCand.match(new RegExp(`\\b${kw}\\b`))) {
      return '';
    }
  }
  
  return candidate;
};

type UiVendor = Vendor & {
  rating?: number
  reviews?: number
}

export default function BrowseVendorsPage() {
  const [vendors, setVendors] = useState<UiVendor[]>([])
  const [filteredVendors, setFilteredVendors] = useState<UiVendor[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedVendor, setSelectedVendor] = useState<UiVendor | null>(null)
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false)
  const { user } = useAuthStore()
  const [favoriteVendorIds, setFavoriteVendorIds] = useState<Set<string>>(new Set())
  
  // Search and filter states
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [selectedLocation, setSelectedLocation] = useState<string>('')
  const [priceRange, setPriceRange] = useState<string>('')
  const [minRating, setMinRating] = useState<number>(0)
  const [sortBy, setSortBy] = useState<string>('popular')
  const [activeFilters, setActiveFilters] = useState<string[]>([])
  const isAuthed = !!user
  const sidebarItems = [
    { path: '/dashboard', label: 'Dashboard', icon: '📊' },
    { path: '/vendors', label: 'Find Vendors', icon: '🔍' },
    { path: '/bookings/history', label: 'My Bookings', icon: '📅' },
    { path: '/budget-planner', label: 'Budget Planner', icon: '💰' },
    { path: '/checklist', label: 'Checklist', icon: '✅' },
    { path: '/favorites', label: 'Favorites', icon: '❤️' },
    { path: '/reviews', label: 'My Reviews', icon: '⭐' },
  ]

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const vendorsPerPage = 12

  // Get all vendor images for fallback when vendor doesn't have image
  const allVendorImages = getRandomVendorImages(34)

  // Get unique categories and locations from vendors loaded from database
  // Use useMemo to make it reactive to vendors changes
  const allVendorsForCategories = useMemo(() => {
    return vendors
  }, [vendors])
  
  const categories = useMemo(() => {
    return Array.from(new Set(allVendorsForCategories.map(v => v.service_category).filter(Boolean))).sort()
  }, [allVendorsForCategories])
  
  const locations = useMemo(() => {
    return Array.from(new Set(allVendorsForCategories.map(v => extractCityFromAddress(v.business_address)).filter(Boolean))).sort()
  }, [allVendorsForCategories])

  // Load favorites when user is logged in
  useEffect(() => {
    const loadFavorites = async () => {
      const authToken = useAuthStore.getState().token
      if (!user || !authToken) {
        setFavoriteVendorIds(new Set())
        return
      }
      try {
        const response = await api.get('/favorites')
        const favorites = response.data || []
        const favoriteIds = new Set(favorites.map((f: any) => f.vendor_id))
        setFavoriteVendorIds(favoriteIds)
      } catch (err: any) {
        // If favorites fail (e.g., expired token), keep page usable and avoid redirect
        console.log('Error loading favorites:', err)
        setFavoriteVendorIds(new Set())
      }
    }
    loadFavorites()
  }, [user])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const data = await fetchVendors(undefined, 500) // Increase limit to 500
        console.log('Fetched vendors:', data)
        
        // Debug: Check packages for first vendor
        if (data && Array.isArray(data) && data.length > 0) {
          console.log('First vendor packages:', data[0]?.packages)
          console.log('First vendor has packages?', data[0]?.packages?.length > 0)
        }
        
        if (data && Array.isArray(data) && data.length > 0) {
          // Filter out unwanted vendors (Rasheed and Ghauri)
          const filteredData = data.filter(v => {
            const name = v.business_name?.toLowerCase() || ''
            return !name.includes('rasheed') && !name.includes('ghauri')
          })
          
          // Map API vendors to UI fields while keeping existing design
          // Map API vendors and assign images if missing
          const mappedVendors = filteredData.map((v, index) => {
            // If vendor doesn't have image, assign one from our collection
            let imageUrl = v.image_url
            if (!imageUrl) {
              const categoryImages = getVendorImagesByCategory(v.service_category)
              if (categoryImages.length > 0) {
                imageUrl = categoryImages[index % categoryImages.length].url
              } else {
                imageUrl = allVendorImages[index % allVendorImages.length].url
              }
            }
            return {
              ...v,
              _id: v._id || v.id || '',
              id: v.id || v._id || '',
              rating: v.rating ?? 4.8,
              reviews: v.total_bookings ?? 0,
              image_url: imageUrl,
              packages: v.packages || [],
            }
          })
          // Set vendors from database
          setVendors(mappedVendors)
          setFilteredVendors(mappedVendors)
        } else {
          // If no API vendors, show empty state
          console.log('No vendors found in database - received:', data)
          setVendors([])
          setFilteredVendors([])
        }
      } catch (err: any) {
        console.error('Error fetching vendors:', err)
        console.error('Error details:', {
          message: err.message,
          response: err.response?.data,
          status: err.response?.status,
          url: err.config?.url
        })
        // On error, show empty state
        setVendors([])
        setFilteredVendors([])
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  // Filter and search logic
  useEffect(() => {
    let filtered = [...vendors]

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(v =>
        v.business_name.toLowerCase().includes(query) ||
        v.service_category.toLowerCase().includes(query) ||
        v.business_address.toLowerCase().includes(query)
      )
    }

    // Category filter (case-insensitive)
    if (selectedCategory) {
      filtered = filtered.filter(v => 
        v.service_category?.toLowerCase() === selectedCategory.toLowerCase()
      )
    }

    // Location filter
    if (selectedLocation) {
      filtered = filtered.filter(v => extractCityFromAddress(v.business_address) === selectedLocation)
    }

    // Rating filter
    if (minRating > 0) {
      filtered = filtered.filter(v => (v.rating || 0) >= minRating)
    }

    // Sort
    if (sortBy === 'popular') {
      filtered.sort((a, b) => (b.reviews || 0) - (a.reviews || 0))
    } else if (sortBy === 'rating') {
      filtered.sort((a, b) => (b.rating || 0) - (a.rating || 0))
    } else if (sortBy === 'name') {
      filtered.sort((a, b) => a.business_name.localeCompare(b.business_name))
    }

    setFilteredVendors(filtered)
    // Reset to page 1 when filters change
    setCurrentPage(1)

    // Update active filters display
    const filters: string[] = []
    if (selectedCategory) filters.push(selectedCategory)
    if (selectedLocation) filters.push(selectedLocation)
    if (minRating > 0) filters.push(`${minRating}+ Rating`)
    if (priceRange) filters.push(priceRange)
    setActiveFilters(filters)
  }, [searchQuery, selectedCategory, selectedLocation, priceRange, minRating, sortBy, vendors])

  const handleRemoveFilter = (filter: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation()
      e.preventDefault()
    }
    
    console.log('Removing filter:', filter)
    console.log('Current filters - category:', selectedCategory, 'location:', selectedLocation, 'rating:', minRating)
    
    // Check if it's a rating filter (format: "4+ Rating" or "4.5+ Rating")
    if (filter.includes('Rating') || filter.match(/\d\+/)) {
      console.log('Removing rating filter')
      setMinRating(0)
    } 
    // Check if it's a category filter - check if filter exactly matches any category
    else if (categories.includes(filter)) {
      console.log('Removing category filter:', filter)
      setSelectedCategory('')
    } 
    // Check if it's a location filter - check if any location is in the filter string
    else if (locations.some(loc => filter.includes(loc) || loc.includes(filter))) {
      console.log('Removing location filter:', filter)
      setSelectedLocation('')
    } 
    // Check if it's a price filter
    else if (filter.includes('Rs.') || filter.includes('Price') || filter.includes('price')) {
      console.log('Removing price filter')
      setPriceRange('')
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    // Search is handled by useEffect
  }

  const handleToggleFavorite = async (vendorId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!user) {
      window.location.href = '/login'
      return
    }

    // Check for token and wait for hydration if needed
    let token = useAuthStore.getState().token
    if (!token) {
      // Wait for token hydration (up to 1 second)
      for (let i = 0; i < 10; i++) {
        await new Promise(resolve => setTimeout(resolve, 100))
        token = useAuthStore.getState().token
        if (token) break
      }
    }

    if (!token) {
      alert('Please log in to add favorites')
      window.location.href = '/login'
      return
    }

    try {
      const isFavorite = favoriteVendorIds.has(vendorId)
      if (isFavorite) {
        await api.delete(`/favorites/${vendorId}`)
        setFavoriteVendorIds(prev => {
          const newSet = new Set(prev)
          newSet.delete(vendorId)
          return newSet
        })
      } else {
        await api.post('/favorites/', { vendor_id: vendorId })
        setFavoriteVendorIds(prev => new Set(prev).add(vendorId))
      }
    } catch (err: any) {
      console.error('Error toggling favorite:', err)
      if (err.response?.status === 401) {
        alert('Your session has expired. Please log in again.')
        window.location.href = '/logout'
      } else {
        alert(err.response?.data?.detail || 'Failed to update favorite')
      }
    }
  }

  return (
    <div className={`min-h-screen bg-gradient-to-br from-amber-50 via-orange-50/30 to-red-50/20 ${isAuthed ? 'flex' : ''}`}>
      {isAuthed && <Sidebar items={sidebarItems} title="User Dashboard" />}
      <div className={`flex-1 flex flex-col overflow-y-auto ${isAuthed ? 'pt-16 lg:pt-0' : ''}`}>
      {/* Header Section */}
      <div className="container mx-auto max-w-6xl px-6 sm:px-8 py-10 sm:py-12 relative">
        {/* Decorative background */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#F7A76C]/10 rounded-full blur-3xl -z-0"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#D72626]/5 rounded-full blur-3xl -z-0"></div>
        <div className="relative z-10">
          <Link
            to={isAuthed ? '/dashboard' : '/'}
            className="inline-flex items-center gap-2 text-[#D72626] hover:text-[#F26D46] font-semibold transition-colors mb-3"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {isAuthed ? 'Back to Dashboard' : 'Back to Home'}
          </Link>
          <h1 className="text-4xl font-extrabold bg-gradient-to-r from-primary-600 via-accent-600 to-primary-600 bg-clip-text text-transparent mb-3 leading-normal">
            Find Your Perfect Wedding Vendors
          </h1>
          <p className="text-gray-700 font-medium mb-8">
            Browse through 1000+ verified vendors across Pakistan
          </p>
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-4 mb-6">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search vendors by name, category, or location..."
            className="flex-1 h-14 px-5 rounded-xl border-2 border-gray-200 focus:outline-none focus:ring-2 focus:ring-pink-600 focus:border-pink-600"
          />
          <button 
            type="submit"
            className="px-12 h-14 rounded-xl text-white font-semibold bg-gradient-to-r from-[#D72626] via-[#F26D46] to-[#F7A76C] hover:opacity-90 transition-all shadow-lg hover:shadow-xl"
          >
            Search
          </button>
        </form>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="h-14 px-5 rounded-xl border-2 border-gray-200 focus:outline-none focus:ring-2 focus:ring-pink-600 focus:border-pink-600 bg-white"
          >
            <option value="">All Categories</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          <select
            value={selectedLocation}
            onChange={(e) => setSelectedLocation(e.target.value)}
            className="h-14 px-5 rounded-xl border-2 border-gray-200 focus:outline-none focus:ring-2 focus:ring-pink-600 focus:border-pink-600 bg-white"
          >
            <option value="">All Locations</option>
            {locations.map(loc => (
              <option key={loc} value={loc}>{loc}</option>
            ))}
          </select>

          <select
            value={minRating}
            onChange={(e) => setMinRating(Number(e.target.value))}
            className="h-14 px-5 rounded-xl border-2 border-gray-200 focus:outline-none focus:ring-2 focus:ring-pink-600 focus:border-pink-600 bg-white"
          >
            <option value="0">All Ratings</option>
            <option value="4">4+ Stars</option>
            <option value="4.5">4.5+ Stars</option>
            <option value="5">5 Stars</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="h-14 px-5 rounded-xl border-2 border-gray-200 focus:outline-none focus:ring-2 focus:ring-pink-600 focus:border-pink-600 bg-white"
          >
            <option value="popular">Most Popular</option>
            <option value="rating">Highest Rated</option>
            <option value="name">Name (A-Z)</option>
          </select>
        </div>

        {/* Active Filters */}
        {activeFilters.length > 0 && (
          <div className="mt-6">
            <span className="text-sm font-semibold text-gray-700 mr-3">Active Filters:</span>
            <div className="inline-flex flex-wrap gap-3">
              {activeFilters.map((filter) => (
                <span
                  key={filter}
                  className="bg-gradient-to-r from-pink-100 to-purple-100 text-gray-800 px-4 py-2 rounded-full text-sm font-medium border border-pink-200 flex items-center gap-2"
                >
                  {filter}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      e.preventDefault()
                      handleRemoveFilter(filter, e)
                    }}
                    className="hover:text-pink-600 hover:bg-pink-200 font-bold cursor-pointer rounded-full w-5 h-5 flex items-center justify-center transition-all duration-200 ml-1"
                    aria-label={`Remove ${filter} filter`}
                    style={{ pointerEvents: 'auto', zIndex: 10 }}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Results + Sort */}
        <div className="container mx-auto px-6 sm:px-8 flex flex-col md:flex-row justify-between items-center text-gray-700 text-sm mb-6">
        <p className="font-semibold">
          {loading ? 'Loading vendors...' : `Showing ${Math.min((currentPage - 1) * vendorsPerPage + 1, filteredVendors.length)}-${Math.min(currentPage * vendorsPerPage, filteredVendors.length)} of ${filteredVendors.length} results`}
        </p>
      </div>

      {/* Vendors Grid */}
      <div className="container mx-auto px-6 sm:px-8 pb-12">
        {filteredVendors.length === 0 && !loading ? (
          <div className="text-center py-16">
            <p className="text-2xl font-bold text-gray-400 mb-4">No vendors found</p>
            <p className="text-gray-600">Try adjusting your search or filters</p>
          </div>
        ) : (
          <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
            {filteredVendors
              .slice((currentPage - 1) * vendorsPerPage, currentPage * vendorsPerPage)
              .map((vendor) => (
            <div
              key={vendor._id || vendor.id}
              className="bg-white rounded-2xl shadow-lg overflow-hidden border-2 border-pink-100 transition-all duration-300 hover:shadow-2xl hover:scale-105 hover:border-pink-400 group cursor-pointer"
              style={{ pointerEvents: 'auto' }}
            >
              <div className="bg-gradient-to-br from-pink-100 to-purple-100 h-48 w-full overflow-hidden relative">
                <Link 
                  to={`/vendors/${vendor._id || vendor.id}`}
                  className="block w-full h-full"
                  onClick={(e) => e.stopPropagation()}
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
                {/* Favorite Button */}
                <button
                  onClick={(e) => handleToggleFavorite(vendor._id || vendor.id, e)}
                  className="absolute top-3 right-3 z-20 bg-white/90 hover:bg-white rounded-full p-2 shadow-lg transition-all duration-300 hover:scale-110"
                  title={favoriteVendorIds.has(vendor._id || vendor.id) ? 'Remove from favorites' : 'Add to favorites'}
                >
                  <span className={`text-2xl transition-all duration-300 ${favoriteVendorIds.has(vendor._id || vendor.id) ? 'text-red-500' : 'text-gray-400'}`}>
                    {favoriteVendorIds.has(vendor._id || vendor.id) ? '❤️' : '🤍'}
                  </span>
                </button>
                {/* Hover overlay with Book button */}
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all duration-300 flex items-center justify-center opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto">
                  {user ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedVendor(vendor)
                        setIsBookingModalOpen(true)
                      }}
                      className="bg-gradient-to-r from-[#D72626] via-[#F26D46] to-[#F7A76C] hover:from-red-700 hover:to-orange-700 text-white px-6 py-3 rounded-lg font-semibold transform translate-y-4 group-hover:translate-y-0 transition-all duration-300 shadow-lg cursor-pointer z-10"
                      style={{ pointerEvents: 'auto' }}
                    >
                      Book Now
                    </button>
                  ) : (
                    <Link
                      to="/login"
                      onClick={(e) => e.stopPropagation()}
                      className="bg-gradient-to-r from-[#D72626] via-[#F26D46] to-[#F7A76C] hover:from-red-700 hover:to-orange-700 text-white px-6 py-3 rounded-lg font-semibold transform translate-y-4 group-hover:translate-y-0 transition-all duration-300 shadow-lg cursor-pointer z-10"
                      style={{ pointerEvents: 'auto' }}
                    >
                      Login to Book
                    </Link>
                  )}
                </div>
              </div>
              <div className="p-6 bg-gradient-to-br from-white to-pink-50/30">
                <p className="text-sm font-semibold bg-gradient-to-r from-[#D72626] via-[#F26D46] to-[#F7A76C] bg-clip-text text-transparent mb-2">{vendor.service_category}</p>
                <h3 className="text-xl font-bold text-gray-900 mb-3">{vendor.business_name}</h3>
                <div className="flex items-center gap-3 text-sm text-gray-600 mb-3">
                  <span className="flex items-center gap-1">
                    <svg className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                    {vendor.rating} ({vendor.reviews} reviews)
                  </span>
                  <span>•</span>
                  <span>{vendor.business_address}</span>
                </div>
                {/* Standard Package Price Display */}
                {(() => {
                  // Debug logging
                  if (!vendor.packages || vendor.packages.length === 0) {
                    console.log(`Vendor ${vendor.business_name} has no packages:`, vendor.packages)
                  }
                  
                  if (vendor.packages && vendor.packages.length > 0) {
                    const standardPackage = vendor.packages.find((pkg: any) => pkg.name === 'Standard')
                    if (standardPackage) {
                      return (
                        <div className="bg-gradient-to-r from-[#D72626] via-[#F26D46] to-[#F7A76C] bg-clip-text text-transparent font-bold text-lg mb-4">
                          Rs. {standardPackage.price.toLocaleString()}
                        </div>
                      )
                    }
                    // Fallback to first package if Standard not found
                    if (vendor.packages[0]) {
                      return (
                        <div className="bg-gradient-to-r from-[#D72626] via-[#F26D46] to-[#F7A76C] bg-clip-text text-transparent font-bold text-lg mb-4">
                          Rs. {vendor.packages[0].price.toLocaleString()}
                        </div>
                      )
                    }
                  }
                  // Default fallback if no packages
                  return (
                    <div className="bg-gradient-to-r from-[#D72626] via-[#F26D46] to-[#F7A76C] bg-clip-text text-transparent font-bold text-lg mb-4">
                      Contact for pricing
                    </div>
                  )
                })()}
                <div className="flex gap-3">
                  <Link
                    to={`/vendors/${vendor._id || vendor.id}`}
                    className="inline-flex items-center gap-2 bg-gradient-to-r from-[#D72626] via-[#F26D46] to-[#F7A76C] bg-clip-text text-transparent font-semibold hover:underline flex-1"
                  >
                    View Profile →
                  </Link>
                  {user && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedVendor(vendor)
                        setIsBookingModalOpen(true)
                      }}
                      className="bg-gradient-to-r from-[#D72626] via-[#F26D46] to-[#F7A76C] hover:from-red-700 hover:to-orange-700 text-white px-4 py-2 rounded-lg font-semibold text-sm transition-all shadow-md cursor-pointer"
                      style={{ pointerEvents: 'auto' }}
                    >
                      Book
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
          </div>
          
          {/* Pagination */}
          {filteredVendors.length > vendorsPerPage && (
            <div className="flex justify-center items-center gap-3 mt-8">
              <button 
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className={`w-10 h-10 rounded-lg border border-gray-200 transition-all ${
                  currentPage === 1 
                    ? 'text-gray-300 cursor-not-allowed' 
                    : 'text-gray-500 hover:bg-gray-50 hover:border-pink-300'
                }`}
              >
                ←
              </button>
              {Array.from({ length: Math.ceil(filteredVendors.length / vendorsPerPage) }, (_, i) => i + 1)
                .filter(page => {
                  // Show first page, last page, current page, and pages around current
                  const totalPages = Math.ceil(filteredVendors.length / vendorsPerPage)
                  if (totalPages <= 5) return true
                  if (page === 1 || page === totalPages) return true
                  if (Math.abs(page - currentPage) <= 1) return true
                  return false
                })
                .map((page, index, array) => {
                  // Add ellipsis if there's a gap
                  const showEllipsisBefore = index > 0 && page - array[index - 1] > 1
                  return (
                    <div key={page} className="flex items-center gap-1">
                      {showEllipsisBefore && (
                        <span className="px-2 text-gray-400">...</span>
                      )}
                      <button
                        onClick={() => setCurrentPage(page)}
                        className={`w-10 h-10 rounded-lg transition-all ${
                          page === currentPage
                            ? 'bg-gradient-to-r from-[#D72626] via-[#F26D46] to-[#F7A76C] text-white shadow-lg'
                            : 'border-2 border-gray-200 text-gray-600 hover:border-pink-300 hover:bg-pink-50'
                        }`}
                      >
                        {page}
                      </button>
                    </div>
                  )
                })}
              <button 
                onClick={() => setCurrentPage(prev => Math.min(Math.ceil(filteredVendors.length / vendorsPerPage), prev + 1))}
                disabled={currentPage >= Math.ceil(filteredVendors.length / vendorsPerPage)}
                className={`w-10 h-10 rounded-lg border border-gray-200 transition-all ${
                  currentPage >= Math.ceil(filteredVendors.length / vendorsPerPage)
                    ? 'text-gray-300 cursor-not-allowed'
                    : 'text-gray-500 hover:bg-gray-50 hover:border-pink-300'
                }`}
              >
                →
              </button>
            </div>
          )}
          </>
        )}

        {/* Booking Modal */}
        {selectedVendor && (
          <BookingModal
            vendorId={selectedVendor._id || selectedVendor.id || ''}
            vendorName={selectedVendor.business_name}
            isOpen={isBookingModalOpen}
            onClose={() => {
              setIsBookingModalOpen(false)
              setSelectedVendor(null)
            }}
            onSuccess={() => {
              alert('Booking request submitted successfully! The vendor will review and respond.')
            }}
          />
        )}
      </div>
      </div>
    </div>
  )
}
