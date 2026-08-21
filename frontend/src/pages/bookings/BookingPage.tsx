import { useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import api from '../../services/api'

export default function BookingPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const vendorId = searchParams.get('vendor')
  const packageName = searchParams.get('package')

  // Sample data - replace with API call to fetch vendor details
  const vendorName = 'Elite Photography Studio'
  const serviceOptions = [
    { name: 'Standard Package', price: 'Rs. 100,000' },
    { name: 'Premium Package', price: 'Rs. 200,000' },
    { name: 'Basic Package', price: 'Rs. 50,000' },
  ]

  const initialService =
    serviceOptions.find((service) =>
      service.name.toLowerCase().startsWith((packageName || '').toLowerCase())
    ) || serviceOptions[0]

  const [selectedService, setSelectedService] = useState(initialService)
  const selectedPackage = selectedService.name
  const packagePrice = selectedService.price

  const [formData, setFormData] = useState({
    eventDate: '',
    eventType: '',
    venueLocation: '',
    numberOfGuests: '',
    yourName: '',
    phoneNumber: '',
    email: ''
  })

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [bookingSuccess, setBookingSuccess] = useState(false)
  const [bookingId, setBookingId] = useState('')

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  const generateBookingId = () => {
    const year = new Date().getFullYear()
    const randomNum = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
    return `#BK-${year}-${randomNum}`
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      // Replace with actual API call
      const bookingData = {
        vendor_id: vendorId,
        package_name: selectedPackage,
        event_date: formData.eventDate,
        event_type: formData.eventType,
        venue_location: formData.venueLocation,
        number_of_guests: parseInt(formData.numberOfGuests),
        customer_name: formData.yourName,
        phone_number: formData.phoneNumber,
        email: formData.email
      }

      // Uncomment when API is ready:
      // const response = await api.post('/bookings', bookingData)
      // setBookingId(response.data.booking_id || generateBookingId())
      
      // For now, simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      setBookingId(generateBookingId())
      setBookingSuccess(true)
    } catch (error: any) {
      console.error('Booking submission failed:', error)
      alert('Failed to submit booking. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Success View
  if (bookingSuccess) {
    return (
      <div className="bg-gradient-to-br from-amber-50 via-orange-50/30 to-red-50/20 min-h-screen py-12 px-4 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-lg p-12 max-w-md w-full text-center">
          {/* Success Icon */}
          <div className="flex justify-center mb-6">
            <div className="bg-green-500 rounded-lg p-4 w-20 h-20 flex items-center justify-center">
              <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>

          {/* Heading */}
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Booking Request Sent!</h1>

          {/* Description */}
          <p className="text-gray-600 mb-6">
            Your booking request has been sent to {vendorName}. They will respond within 24 hours.
          </p>

          {/* Booking ID */}
          <div className="text-gray-900 font-medium mb-8">
            Booking ID: {bookingId}
          </div>

          {/* Back to Dashboard Button */}
          <button
            onClick={() => navigate('/dashboard')}
            className="w-full bg-pink-600 hover:bg-pink-700 text-white font-semibold py-4 rounded-lg transition-colors text-lg"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  // Booking Form View
  return (
    <div className="bg-gradient-to-br from-amber-50 via-orange-50/30 to-red-50/20 min-h-screen py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Book Your Service</h1>

          {/* Service Information Section */}
          <div className="bg-purple-50 rounded-lg p-4 mb-8">
            <div className="font-bold text-gray-900 text-lg mb-3">{vendorName}</div>

            {/* Service selector */}
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-3">
                {serviceOptions.map((service) => (
                  <button
                    key={service.name}
                    type="button"
                    onClick={() => setSelectedService(service)}
                    className={`px-5 py-2 rounded-full text-sm font-semibold transition-colors ${
                      selectedService.name === service.name
                        ? 'bg-pink-600 text-white shadow'
                        : 'bg-white text-gray-700 border border-gray-200 hover:border-pink-400'
                    }`}
                  >
                    {service.name.replace(' Package', '')}
                  </button>
                ))}
              </div>

              <div className="text-pink-600 font-semibold">
                {selectedPackage} - {packagePrice}
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Event Details Section */}
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-6">Event Details</h2>
              <div className="space-y-5">
                <div>
                  <label className="block text-gray-700 font-medium mb-2">Event Date</label>
                  <input
                    type="date"
                    name="eventDate"
                    value={formData.eventDate}
                    onChange={handleChange}
                    min={new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0]}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent bg-white"
                    placeholder="Select date"
                    required
                  />
                </div>

                <div>
                  <label className="block text-gray-700 font-medium mb-2">Event Type</label>
                  <input
                    type="text"
                    name="eventType"
                    value={formData.eventType}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent bg-white"
                    placeholder="Mehndi, Baraat, Walima"
                    required
                  />
                </div>

                <div>
                  <label className="block text-gray-700 font-medium mb-2">Venue Location</label>
                  <input
                    type="text"
                    name="venueLocation"
                    value={formData.venueLocation}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent bg-white"
                    placeholder="Enter venue address"
                    required
                  />
                </div>

                <div>
                  <label className="block text-gray-700 font-medium mb-2">Number of Guests</label>
                  <input
                    type="number"
                    name="numberOfGuests"
                    value={formData.numberOfGuests}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent bg-white"
                    placeholder="Approximate count"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Contact Information Section */}
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-6">Contact Information</h2>
              <div className="space-y-5">
                <div>
                  <label className="block text-gray-700 font-medium mb-2">Your Name</label>
                  <input
                    type="text"
                    name="yourName"
                    value={formData.yourName}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent bg-white"
                    placeholder="Full name"
                    required
                  />
                </div>

                <div>
                  <label className="block text-gray-700 font-medium mb-2">Phone Number</label>
                  <input
                    type="tel"
                    name="phoneNumber"
                    value={formData.phoneNumber}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent bg-white"
                    placeholder="+92 300 1234567"
                    required
                  />
                </div>

                <div>
                  <label className="block text-gray-700 font-medium mb-2">Email Address</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent bg-white"
                    placeholder="your.email@example.com"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-pink-600 hover:bg-pink-700 disabled:bg-pink-400 disabled:cursor-not-allowed text-white font-semibold py-4 rounded-lg transition-colors text-lg"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Booking Request'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
