import { useState, useEffect } from 'react'
import { createBooking, BookingCreate, TimeSlot } from '../services/bookingService'
import { fetchVendorById, Package } from '../services/vendorService'
import { useAuthStore } from '../store/authStore'
import VendorAvailabilityCalendar from './VendorAvailabilityCalendar'

interface BookingModalProps {
  vendorId: string
  vendorName: string
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function BookingModal({ vendorId, vendorName, isOpen, onClose, onSuccess }: BookingModalProps) {
  const { user } = useAuthStore()
  const [packages, setPackages] = useState<Package[]>([])
  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null)
  const [loadingPackages, setLoadingPackages] = useState(false)
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    return d.toISOString().split('T')[0]
  })
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot>('1-4')
  const [formData, setFormData] = useState({
    event_location: '',
    guest_count: '',
    special_requirements: '',
    total_amount: ''
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Load vendor packages when modal opens
  useEffect(() => {
    if (isOpen && vendorId) {
      loadVendorPackages()
    }
  }, [isOpen, vendorId])

  const loadVendorPackages = async () => {
    setLoadingPackages(true)
    try {
      const vendor = await fetchVendorById(vendorId)
      if (vendor.packages && vendor.packages.length > 0) {
        setPackages(vendor.packages)
        // Set default to Basic package if available
        const basicPackage = vendor.packages.find((p: Package) => p.name.toLowerCase() === 'basic')
        if (basicPackage) {
          setSelectedPackage(basicPackage)
          setFormData(prev => ({ ...prev, total_amount: basicPackage.price.toString() }))
        } else {
          // If no Basic, select first package
          setSelectedPackage(vendor.packages[0])
          setFormData(prev => ({ ...prev, total_amount: vendor.packages[0].price.toString() }))
        }
      } else {
        // Create default packages if vendor doesn't have any
        const defaultPackages: Package[] = [
          { name: 'Basic', price: 50000, description: 'Basic package', features: [] },
          { name: 'Standard', price: 100000, description: 'Standard package', features: [] },
          { name: 'Premium', price: 200000, description: 'Premium package', features: [] }
        ]
        setPackages(defaultPackages)
        setSelectedPackage(defaultPackages[0])
        setFormData(prev => ({ ...prev, total_amount: defaultPackages[0].price.toString() }))
      }
    } catch (err) {
      console.error('Error loading vendor packages:', err)
      // Use default packages on error
      const defaultPackages: Package[] = [
        { name: 'Basic', price: 50000, description: 'Basic package', features: [] },
        { name: 'Standard', price: 100000, description: 'Standard package', features: [] },
        { name: 'Premium', price: 200000, description: 'Premium package', features: [] }
      ]
      setPackages(defaultPackages)
      setSelectedPackage(defaultPackages[0])
      setFormData(prev => ({ ...prev, total_amount: defaultPackages[0].price.toString() }))
    } finally {
      setLoadingPackages(false)
    }
  }

  const handlePackageSelect = (pkg: Package) => {
    setSelectedPackage(pkg)
    setFormData(prev => ({ ...prev, total_amount: pkg.price.toString() }))
  }

  const handleSlotSelection = (date: string, slot: TimeSlot) => {
    setSelectedDate(date)
    setSelectedSlot(slot)
    setError('')
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (!user) {
      setError('Please login to book a vendor')
      setLoading(false)
      return
    }

    try {
      // Check token before submitting
      const token = useAuthStore.getState().token
      const currentUser = useAuthStore.getState().user
      
      if (!token) {
        setError('Please login to book a vendor')
        setLoading(false)
        return
      }
      
      if (!currentUser) {
        setError('User session not found. Please login again.')
        setLoading(false)
        return
      }

      // Validate required fields
      if (!selectedDate || !selectedSlot) {
        setError('Please select a date and an available time slot from the calendar.')
        setLoading(false)
        return
      }

      if (!formData.event_location.trim()) {
        setError('Please enter the event location venue address.')
        setLoading(false)
        return
      }

      // Validate total_amount - it's required and must be > 0
      const totalAmount = parseFloat(formData.total_amount)
      if (!formData.total_amount || isNaN(totalAmount) || totalAmount <= 0) {
        setError('Please enter a valid total amount greater than 0')
        setLoading(false)
        return
      }

      const bookingData: BookingCreate = {
        vendor_id: vendorId,
        package_name: selectedPackage?.name || undefined,
        event_date: new Date(selectedDate + 'T12:00:00Z').toISOString(),
        time_slot: selectedSlot,
        event_location: formData.event_location.trim(),
        guest_count: formData.guest_count ? parseInt(formData.guest_count) : undefined,
        special_requirements: formData.special_requirements?.trim() || undefined,
        total_amount: totalAmount
      }

      console.log('Creating booking with data:', bookingData)
      const result = await createBooking(bookingData)
      console.log('Booking created successfully:', result)
      
      onSuccess()
      onClose()
      
      // Reset form
      setFormData({
        event_location: '',
        guest_count: '',
        special_requirements: '',
        total_amount: ''
      })
    } catch (err: any) {
      console.error('Booking creation error:', err)
      const errorMessage = err.response?.data?.detail 
        ? (typeof err.response.data.detail === 'string' 
            ? err.response.data.detail 
            : JSON.stringify(err.response.data.detail))
        : err.message || 'Failed to create booking'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">Book {vendorName}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {typeof error === 'string' ? error : 'An error occurred. Please try again.'}
            </div>
          )}

          {/* Package Selection */}
          {loadingPackages ? (
            <div className="text-center py-4">
              <p className="text-gray-500">Loading packages...</p>
            </div>
          ) : packages.length > 0 ? (
            <div>
              <label className="block text-gray-700 font-medium mb-3">
                Select Package <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-3 gap-3">
                {packages.map((pkg) => (
                  <button
                    key={pkg.name}
                    type="button"
                    onClick={() => handlePackageSelect(pkg)}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      selectedPackage?.name === pkg.name
                        ? 'border-[#D72626] bg-gradient-to-br from-rose-50 to-orange-50/50 shadow-md'
                        : 'border-gray-200 hover:border-[#D72626]/50 bg-white'
                    }`}
                  >
                    <div className="font-semibold text-gray-900 mb-1">{pkg.name}</div>
                    <div className="text-[#D72626] font-bold text-lg">Rs. {pkg.price.toLocaleString()}</div>
                    {pkg.description && (
                      <div className="text-xs text-gray-500 mt-1">{pkg.description}</div>
                    )}
                  </button>
                ))}
              </div>
              {selectedPackage && (
                <div className="mt-3 p-3 bg-gradient-to-br from-rose-50 to-orange-50/50 rounded-lg border border-rose-200">
                  <div className="text-sm text-gray-700">
                    <span className="font-semibold">Selected:</span> {selectedPackage.name} - Rs. {selectedPackage.price.toLocaleString()}
                  </div>
                  {selectedPackage.features && selectedPackage.features.length > 0 && (
                    <div className="mt-2">
                      <div className="text-xs font-semibold text-gray-600 mb-1">Features:</div>
                      <ul className="text-xs text-gray-600 space-y-1">
                        {selectedPackage.features.map((feature, idx) => (
                          <li key={idx} className="flex items-start gap-1">
                            <span className="text-[#D72626]">•</span>
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : null}

          {/* Availability Calendar & Time Slot Selection */}
          <div>
            <label className="block text-gray-700 font-medium mb-2">
              Select Date & Time Slot <span className="text-red-500">*</span>
            </label>
            <VendorAvailabilityCalendar
              vendorId={vendorId}
              selectedDate={selectedDate}
              selectedSlot={selectedSlot}
              onSelectSlot={handleSlotSelection}
            />
            {selectedDate && selectedSlot && (
              <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800 flex items-center gap-2">
                <span>{selectedSlot === '1-4' ? '🌞' : '🌙'}</span>
                <span>
                  <strong>Selected:</strong>{' '}
                  {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-PK', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  {' — '}
                  {selectedSlot === '1-4' ? '1:00 PM – 4:00 PM' : '7:00 PM – 10:00 PM'}
                </span>
              </div>
            )}
          </div>

          <div>
            <label className="block text-gray-700 font-medium mb-2">
              Event Location <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="event_location"
              value={formData.event_location}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D72626] focus:border-[#D72626]"
              placeholder="Enter venue address"
              required
            />
          </div>

          <div>
            <label className="block text-gray-700 font-medium mb-2">Number of Guests</label>
            <input
              type="number"
              name="guest_count"
              value={formData.guest_count}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D72626] focus:border-[#D72626]"
              placeholder="Approximate guest count"
              min="1"
            />
          </div>

          <div>
            <label className="block text-gray-700 font-medium mb-2">
              Total Amount (PKR) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              name="total_amount"
              value={formData.total_amount}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D72626] focus:border-[#D72626]"
              placeholder="Amount will be set based on selected package"
              min="0.01"
              step="0.01"
              required
              readOnly={!!selectedPackage}
            />
            <p className="text-sm text-gray-500 mt-1">
              {selectedPackage ? 'Amount is set based on selected package' : 'Enter amount or select a package'}
            </p>
          </div>

          <div>
            <label className="block text-gray-700 font-medium mb-2">Special Requirements</label>
            <textarea
              name="special_requirements"
              value={formData.special_requirements}
              onChange={handleChange}
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D72626] focus:border-[#D72626]"
              placeholder="Any special requests or requirements..."
            />
          </div>

          <div className="flex gap-4 pt-4">
            <button
              type="submit"
              disabled={loading}
              className={`flex-1 bg-gradient-to-r from-[#D72626] via-[#F26D46] to-[#F7A76C] hover:from-red-700 hover:via-orange-700 hover:to-orange-800 text-white py-3 rounded-lg font-semibold transition-all shadow-lg ${
                loading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {loading ? 'Submitting...' : 'Submit Booking Request'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

