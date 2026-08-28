import { useEffect, useState } from 'react'
import { getVendorBookings, approveBooking, rejectBooking, Booking } from '../../services/bookingService'
import { useAuthStore } from '../../store/authStore'
import Sidebar from '../../components/Sidebar'

export default function VendorBookingsPage() {
  const { user } = useAuthStore()
  const [bookings, setBookings] = useState<Booking[]>([])
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [error, setError] = useState('')

  const sidebarItems = [
    { path: '/vendor/dashboard', label: 'Dashboard', icon: '📊' },
    { path: '/vendor/bookings', label: 'Bookings', icon: '📅' },
    { path: '/vendor/profile', label: 'Profile', icon: '👤' },
    { path: '/vendor/packages', label: 'Packages', icon: '📦' },
    { path: '/vendor/reviews', label: 'Reviews', icon: '⭐' },
  ]

  useEffect(() => {
    if (user) {
      loadBookings()
    }
  }, [statusFilter, user])

  const loadBookings = async () => {
    if (!user) {
      setError('Please login as a vendor to view bookings')
      return
    }
    
    setError('')
    try {
      console.log('Loading vendor bookings with filter:', statusFilter || 'none')
      const data = await getVendorBookings(statusFilter || undefined)
      console.log('Loaded bookings:', data)
      setBookings(data)
    } catch (err: any) {
      console.error('Error loading bookings:', err)
      const errorMessage = err.response?.data?.detail || err.message || 'Failed to load bookings'
      setError(errorMessage)
      
      // If it's a connection error, provide helpful message
      if (err.code === 'ECONNABORTED' || err.message?.includes('timeout') || err.message?.includes('ECONNRESET')) {
        setError('Cannot connect to server. Please make sure the backend server is running on http://localhost:8000')
      }
    } finally {
      // no loading UI; keep quick updates silent
    }
  }

  const handleApprove = async (bookingId: string) => {
    if (!confirm('Are you sure you want to approve this booking?')) return

    try {
      await approveBooking(bookingId)
      await loadBookings()
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to approve booking')
    }
  }

  const handleReject = async (bookingId: string) => {
    if (!confirm('Are you sure you want to reject this booking?')) return

    try {
      await rejectBooking(bookingId)
      await loadBookings()
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to reject booking')
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      case 'approved':
        return 'bg-green-100 text-green-800'
      case 'rejected':
        return 'bg-red-100 text-red-800'
      case 'confirmed':
        return 'bg-blue-100 text-blue-800'
      case 'cancelled':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-amber-50 via-orange-50/30 to-red-50/20">
      <Sidebar items={sidebarItems} title="Vendor Dashboard" />
      <div className="flex-1 flex flex-col overflow-y-auto pt-16 lg:pt-0">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-50 via-orange-50/30 to-red-50/20">
          <div className="container mx-auto px-6 py-6 flex flex-col gap-2">
            <button
              onClick={() => (window.location.href = '/vendor/dashboard')}
              className="inline-flex items-center gap-2 text-[#D72626] hover:text-[#F26D46] font-semibold transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Dashboard
            </button>
            <h1 className="text-4xl font-bold leading-tight bg-gradient-to-r from-[#D72626] to-orange-600 bg-clip-text text-transparent">
              Manage Bookings
            </h1>
            <p className="text-gray-600 text-lg leading-relaxed">Review, filter, and act on your bookings</p>
          </div>
        </div>

        <div className="container mx-auto px-6 py-8">
        {/* Filter */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center gap-4">
            <label className="text-gray-700 font-medium">Filter by Status:</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
            >
              <option value="">All Bookings</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="confirmed">Confirmed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {bookings.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <p className="text-gray-600 text-lg">No bookings found</p>
          </div>
        ) : (
          <div className="space-y-4">
            {bookings.map((booking) => (
              <div key={booking.id || booking._id} className="bg-white rounded-lg shadow-md p-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getStatusColor(booking.status)}`}>
                        {booking.status.toUpperCase()}
                      </span>
                      <span className="text-gray-500 text-sm">
                        Booking ID: {booking.id || booking._id}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-600">Event Date</p>
                        <p className="font-semibold text-gray-900">{formatDate(booking.event_date)}</p>
                        {booking.time_slot && (
                          <span className={`inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                            booking.time_slot === '1-4'
                              ? 'bg-amber-100 text-amber-800 border border-amber-200'
                              : 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                          }`}>
                            {booking.time_slot === '1-4' ? '🌞 1:00 PM – 4:00 PM' : '🌙 7:00 PM – 10:00 PM'}
                          </span>
                        )}
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Location</p>
                        <p className="font-semibold text-gray-900">{booking.event_location}</p>
                      </div>
                      {booking.guest_count && (
                        <div>
                          <p className="text-sm text-gray-600">Guest Count</p>
                          <p className="font-semibold text-gray-900">{booking.guest_count}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-sm text-gray-600">Total Amount</p>
                        <p className="font-semibold text-gray-900">Rs. {booking.total_amount.toLocaleString()}</p>
                      </div>
                    </div>
                    {booking.special_requirements && (
                      <div className="mt-4">
                        <p className="text-sm text-gray-600">Special Requirements</p>
                        <p className="text-gray-900">{booking.special_requirements}</p>
                      </div>
                    )}
                    <div className="mt-2">
                      <p className="text-sm text-gray-500">
                        Created: {formatDate(booking.created_at)}
                      </p>
                    </div>
                  </div>
                  
                  {booking.status === 'pending' && (
                    <div className="flex gap-3">
                      <button
                        onClick={() => handleApprove(booking.id || booking._id || '')}
                        className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-semibold transition-colors"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleReject(booking.id || booking._id || '')}
                        className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg font-semibold transition-colors"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        </div>
      </div>
    </div>
  )
}

