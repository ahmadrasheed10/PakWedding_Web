import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getUserBookings, Booking } from '../../services/bookingService'
import { useAuthStore } from '../../store/authStore'
import { reviewService, Review } from '../../services/reviewService'
import ReviewModal from '../../components/ReviewModal'
import api from '../../services/api'
import Sidebar from '../../components/Sidebar'

interface BookingDisplay extends Booking {
  vendor_name?: string
  event_type?: string
  hasReview?: boolean
}

export default function BookingHistoryPage() {
  const { user } = useAuthStore()
  const [bookings, setBookings] = useState<BookingDisplay[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected' | 'completed'>('all')
  const [reviewModalOpen, setReviewModalOpen] = useState(false)
  const [selectedBooking, setSelectedBooking] = useState<BookingDisplay | null>(null)
  const [userReviews, setUserReviews] = useState<Review[]>([])
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

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
    if (user) {
      loadBookings()
    } else {
      setLoading(false)
    }
  }, [filter, user])

  const loadBookings = async () => {
    try {
      setLoading(true)
      const allBookings = await getUserBookings()
      
      // Load user reviews to check which bookings have reviews
      try {
        const reviewsData = await api.get<Review[]>('/reviews/user')
        setUserReviews(reviewsData.data || [])
      } catch (err) {
        console.log('Could not load reviews')
        setUserReviews([])
      }
      
      // Filter by status if needed
      let filteredBookings = allBookings
      if (filter !== 'all') {
        filteredBookings = allBookings.filter((b: Booking) => b.status === filter)
      }
      
      // Map to display format and check if review exists
      const displayBookings: BookingDisplay[] = filteredBookings.map((b: Booking) => {
        const hasReview = userReviews.some(r => r.booking_id === (b.id || b._id))
        return {
          ...b,
          _id: b.id || b._id || '',
          vendor_name: 'Vendor', // Could be enhanced to fetch vendor name
          event_type: 'Wedding', // Default event type
          hasReview
        }
      })
      
      setBookings(displayBookings)
    } catch (error: any) {
      console.error('Error loading bookings:', error)
      // If API fails, show empty state
      setBookings([])
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'confirmed':
        return 'bg-green-100 text-green-700'
      case 'approved':
        return 'bg-blue-100 text-blue-700'
      case 'pending':
        return 'bg-yellow-100 text-yellow-700'
      case 'rejected':
        return 'bg-red-100 text-red-700'
      case 'completed':
        return 'bg-purple-100 text-purple-700'
      case 'cancelled':
        return 'bg-gray-100 text-gray-700'
      default:
        return 'bg-gray-100 text-gray-700'
    }
  }

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString('en-PK', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      })
    } catch {
      return dateString
    }
  }

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-amber-50 via-orange-50/30 to-red-50/20">
      <Sidebar items={sidebarItems} title="User Dashboard" />
      <div className="flex-1 flex flex-col overflow-y-auto pt-16 lg:pt-0">
        <div className="py-6 sm:py-8 px-6 sm:px-8">
          <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6 sm:mb-8 space-y-2 text-left">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 text-[#D72626] hover:text-[#F26D46] font-semibold transition-colors w-fit"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Dashboard
          </Link>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold bg-gradient-to-r from-primary-600 via-accent-600 to-primary-600 bg-clip-text text-transparent leading-tight">
            Booking History
          </h1>
          <p className="text-sm sm:text-base text-gray-700 font-medium">
            View and manage all your bookings
          </p>
        </div>

        {/* Success Message */}
        {successMessage && (
          <div className="bg-green-50 border-2 border-green-200 text-green-700 px-6 py-4 rounded-xl mb-6 shadow-lg flex items-center justify-between">
            <div className="flex items-center gap-3">
              <svg className="w-6 h-6 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="font-semibold">{successMessage}</span>
            </div>
            <button
              onClick={() => setSuccessMessage(null)}
              className="text-green-600 hover:text-green-800 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Filter Tabs */}
        <div className="bg-white rounded-2xl shadow-lg p-4 mb-6 border-2 border-pink-100">
          <div className="flex gap-4 flex-wrap">
            {(['all', 'pending', 'approved', 'rejected', 'completed'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={`px-6 py-2 rounded-xl font-semibold transition-all capitalize ${
                  filter === status
                    ? 'bg-gradient-to-r from-red-600 to-orange-600 text-white shadow-lg'
                    : 'bg-pink-50 text-gray-700 hover:bg-pink-100'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        {/* Bookings List */}
        {loading ? (
          <div className="bg-white rounded-2xl shadow-lg p-12 text-center border-2 border-pink-100">
            <p className="text-gray-600 text-lg">Loading bookings...</p>
          </div>
        ) : bookings.length === 0 ? (
          <div className="bg-gradient-to-br from-white to-pink-50/30 rounded-2xl shadow-xl p-12 text-center border-2 border-pink-100">
            <div className="text-6xl mb-4">📅</div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">No Bookings Yet</h3>
            <p className="text-gray-600 mb-6">Start booking vendors for your wedding!</p>
            <Link
              to="/vendors"
              className="inline-block bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white px-8 py-3 rounded-xl font-semibold transition-all shadow-lg hover:shadow-xl"
            >
              Browse Vendors
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {bookings.map((booking) => (
              <div
                key={booking._id}
                className="bg-gradient-to-br from-white to-pink-50/30 rounded-2xl shadow-lg p-6 border-2 border-pink-100 hover:border-pink-300 transition-all"
              >
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-4 mb-3">
                      <h3 className="text-xl font-bold text-gray-900">
                        {booking.vendor_name || 'Vendor'}
                      </h3>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(booking.status)}`}>
                        {booking.status} {
                          
                        }
                      </span>
                    </div>
                    <div className="grid md:grid-cols-3 gap-4 text-sm text-gray-600">
                      <div>
                        <span className="font-semibold text-gray-700">Event Date:</span> {formatDate(booking.event_date)}
                      </div>
                      <div>
                        <span className="font-semibold text-gray-700">Location:</span> {booking.event_location}
                      </div>
                      {booking.guest_count && (
                        <div>
                          <span className="font-semibold text-gray-700">Guests:</span> {booking.guest_count}
                        </div>
                      )}
                      {booking.total_amount && (
                        <div>
                          <span className="font-semibold text-gray-700">Amount:</span> Rs. {booking.total_amount.toLocaleString()}
                        </div>
                      )}
                      <div>
                        <span className="font-semibold text-gray-700">Booked:</span> {formatDate(booking.created_at)}
                      </div>
                      {booking.special_requirements && (
                        <div className="md:col-span-3">
                          <span className="font-semibold text-gray-700">Special Requirements:</span> {booking.special_requirements}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-3 flex-wrap">
                    <Link
                      to={`/vendors/${booking.vendor_id}`}
                      className="bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white px-6 py-2 rounded-xl font-semibold transition-all shadow-lg hover:shadow-xl"
                    >
                      View Vendor
                    </Link>
                    {(booking.status === 'approved' || booking.status === 'confirmed' || booking.status === 'completed') && !booking.hasReview && (
                      <button
                        onClick={() => {
                          setSelectedBooking(booking)
                          setReviewModalOpen(true)
                        }}
                        className="bg-gradient-to-r from-yellow-500 to-orange-600 hover:from-yellow-600 hover:to-orange-700 text-white px-6 py-2 rounded-xl font-semibold transition-all shadow-lg hover:shadow-xl"
                      >
                        Add Review
                      </button>
                    )}
                    {booking.hasReview && (
                      <span className="px-6 py-2 rounded-xl font-semibold bg-green-100 text-green-700 border-2 border-green-200 flex items-center gap-2">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        Review Added
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Review Modal */}
      {selectedBooking && (
        <ReviewModal
          isOpen={reviewModalOpen}
          onClose={() => {
            setReviewModalOpen(false)
            setSelectedBooking(null)
          }}
          vendorId={selectedBooking.vendor_id}
          bookingId={selectedBooking.id || selectedBooking._id || ''}
          vendorName={selectedBooking.vendor_name}
          onReviewSubmitted={async () => {
            setSuccessMessage('Review added successfully!')
            
            // Update the booking immediately to show "Review Added"
            if (selectedBooking) {
              setBookings(prevBookings => 
                prevBookings.map(booking => 
                  booking._id === selectedBooking._id 
                    ? { ...booking, hasReview: true }
                    : booking
                )
              )
            }
            
            // Reload bookings to ensure data is in sync
            await loadBookings()
            
            // Hide success message after 3 seconds
            setTimeout(() => {
              setSuccessMessage(null)
            }, 3000)
          }}
        />
      )}
          </div>
        </div>
      </div>
  )
}
