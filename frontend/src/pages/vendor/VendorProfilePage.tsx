import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getVendorProfile, updateVendorProfile, Vendor } from '../../services/vendorService'
import { getUserProfile, updatePassword } from '../../services/userService'
import api from '../../services/api'
import Sidebar from '../../components/Sidebar'
import MapPicker from '../../components/MapPicker'

export default function VendorProfilePage() {
  const navigate = useNavigate()
  const [vendor, setVendor] = useState<Vendor | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'profile' | 'password' | 'image' | 'location'>('profile')

  const sidebarItems = [
    { path: '/vendor/dashboard', label: 'Dashboard', icon: '📊' },
    { path: '/vendor/bookings', label: 'Bookings', icon: '📅' },
    { path: '/vendor/profile', label: 'Profile', icon: '👤' },
    { path: '/vendor/packages', label: 'Packages', icon: '📦' },
    { path: '/vendor/reviews', label: 'Reviews', icon: '⭐' },
  ]

  const [profileData, setProfileData] = useState({
    business_name: '',
    contact_person: '',
    phone_number: '',
    business_address: '',
    description: '',
    service_category: '',
  })

  const [locationData, setLocationData] = useState<{
    latitude: number | null
    longitude: number | null
    location_address: string | null
  }>({
    latitude: null,
    longitude: null,
    location_address: null,
  })

  const [savingLocation, setSavingLocation] = useState(false)

  const [passwordData, setPasswordData] = useState({
    old_password: '',
    new_password: '',
    confirm_password: '',
  })

  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)

  useEffect(() => {
    loadVendorProfile()
  }, [])

  const loadVendorProfile = async () => {
    try {
      const vendorData = await getVendorProfile()
      setVendor(vendorData)
      setProfileData({
        business_name: vendorData.business_name || '',
        contact_person: vendorData.contact_person || '',
        phone_number: vendorData.phone_number || '',
        business_address: vendorData.business_address || '',
        description: vendorData.description || '',
        service_category: vendorData.service_category || '',
      })
      setLocationData({
        latitude: vendorData.latitude ?? null,
        longitude: vendorData.longitude ?? null,
        location_address: vendorData.location_address ?? null,
      })
      if (vendorData.image_url) {
        setImagePreview(vendorData.image_url)
      }
    } catch (err: any) {
      console.error('Error loading vendor profile:', err)
      setError(err.response?.data?.detail || 'Failed to load profile')
    }
  }

  const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setProfileData({
      ...profileData,
      [e.target.name]: e.target.value,
    })
  }

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPasswordData({
      ...passwordData,
      [e.target.name]: e.target.value,
    })
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
      const maxSize = 5 * 1024 * 1024 // 5MB

      if (!allowedTypes.includes(file.type)) {
        setError('Invalid file type. Only JPG, PNG, GIF, WEBP are allowed.')
        return
      }

      if (file.size > maxSize) {
        setError('File size exceeds 5MB limit.')
        return
      }

      setImageFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setImagePreview(reader.result as string)
      }
      reader.readAsDataURL(file)
      setError(null)
    }
  }

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const updatedVendor = await updateVendorProfile(profileData)
      setVendor(updatedVendor)
      setSuccess('Profile updated successfully!')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err: any) {
      console.error('Error updating profile:', err)
      setError(err.response?.data?.detail || 'Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(null)

    if (passwordData.new_password !== passwordData.confirm_password) {
      setError('New passwords do not match')
      setSaving(false)
      return
    }

    if (passwordData.new_password.length < 6) {
      setError('Password must be at least 6 characters long')
      setSaving(false)
      return
    }

    try {
      await updatePassword(passwordData.old_password, passwordData.new_password)
      setSuccess('Password updated successfully!')
      setPasswordData({
        old_password: '',
        new_password: '',
        confirm_password: '',
      })
      setTimeout(() => setSuccess(null), 3000)
    } catch (err: any) {
      console.error('Error updating password:', err)
      setError(err.response?.data?.detail || 'Failed to update password')
    } finally {
      setSaving(false)
    }
  }

  const handleImageSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!imageFile) {
      setError('Please select an image')
      return
    }

    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const formData = new FormData()
      formData.append('file', imageFile)

      const uploadResponse = await api.post('/uploads/vendor/image', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })

      if (uploadResponse.data?.image_url) {
        await updateVendorProfile({ image_url: uploadResponse.data.image_url })
        setSuccess('Image updated successfully!')
        setImageFile(null)
        await loadVendorProfile()
        setTimeout(() => setSuccess(null), 3000)
      }
    } catch (err: any) {
      console.error('Error uploading image:', err)
      setError(err.response?.data?.detail || 'Failed to upload image')
    } finally {
      setSaving(false)
    }
  }

  const handleLocationSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!locationData.latitude || !locationData.longitude) {
      setError('Please pick a location on the map first')
      return
    }
    setSavingLocation(true)
    setError(null)
    setSuccess(null)
    try {
      const updatedVendor = await updateVendorProfile({
        latitude: locationData.latitude,
        longitude: locationData.longitude,
        location_address: locationData.location_address ?? '',
      })
      setVendor(updatedVendor)
      setSuccess('Location saved successfully!')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to save location')
    } finally {
      setSavingLocation(false)
    }
  }

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-amber-50 via-orange-50/30 to-red-50/20">
      <Sidebar items={sidebarItems} title="Vendor Dashboard" />
      <div className="flex-1 flex flex-col overflow-y-auto pt-16 lg:pt-0">
        <div className="container mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/vendor/dashboard')}
            className="text-[#D72626] hover:text-[#F26D46] font-semibold mb-4 flex items-center gap-2 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Dashboard
          </button>
          <h1 className="text-4xl font-bold leading-tight bg-gradient-to-r from-red-600 to-orange-600 bg-clip-text text-transparent">
            Manage Profile
          </h1>
          <p className="text-gray-600 mt-2 leading-relaxed">Update your business information and settings</p>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-lg mb-6 overflow-hidden">
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab('profile')}
              className={`flex-1 px-6 py-4 font-semibold transition-colors ${
                activeTab === 'profile'
                  ? 'bg-pink-50 text-pink-600 border-b-2 border-pink-600'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              Business Profile
            </button>
            <button
              onClick={() => setActiveTab('password')}
              className={`flex-1 px-6 py-4 font-semibold transition-colors ${
                activeTab === 'password'
                  ? 'bg-pink-50 text-pink-600 border-b-2 border-pink-600'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              Change Password
            </button>
            <button
              onClick={() => setActiveTab('image')}
              className={`flex-1 px-6 py-4 font-semibold transition-colors ${
                activeTab === 'image'
                  ? 'bg-pink-50 text-pink-600 border-b-2 border-pink-600'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              Profile Image
            </button>
            <button
              onClick={() => setActiveTab('location')}
              className={`flex-1 px-6 py-4 font-semibold transition-colors ${
                activeTab === 'location'
                  ? 'bg-pink-50 text-pink-600 border-b-2 border-pink-600'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              📍 Venue Location
            </button>
          </div>
        </div>

        {/* Messages */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-6">
            {success}
          </div>
        )}

        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <div className="bg-white rounded-xl shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Business Information</h2>
            <form onSubmit={handleProfileSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-gray-700 font-medium mb-2">
                    Business Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="business_name"
                    value={profileData.business_name}
                    onChange={handleProfileChange}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-gray-700 font-medium mb-2">
                    Contact Person <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="contact_person"
                    value={profileData.contact_person}
                    onChange={handleProfileChange}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-gray-700 font-medium mb-2">
                    Phone Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    name="phone_number"
                    value={profileData.phone_number}
                    onChange={handleProfileChange}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-gray-700 font-medium mb-2">
                    Service Category <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="service_category"
                    value={profileData.service_category}
                    onChange={handleProfileChange}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
                    required
                    readOnly
                  />
                  <p className="text-xs text-gray-500 mt-1">Category cannot be changed</p>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-gray-700 font-medium mb-2">Business Address</label>
                  <input
                    type="text"
                    name="business_address"
                    value={profileData.business_address}
                    onChange={handleProfileChange}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-gray-700 font-medium mb-2">Description</label>
                  <textarea
                    name="description"
                    value={profileData.description}
                    onChange={handleProfileChange}
                    rows={4}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
                    placeholder="Describe your services..."
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition-all"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </form>
          </div>
        )}

        {/* Password Tab */}
        {activeTab === 'password' && (
          <div className="bg-white rounded-xl shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Change Password</h2>
            <form onSubmit={handlePasswordSubmit} className="space-y-6 max-w-md">
              <div>
                <label className="block text-gray-700 font-medium mb-2">Current Password</label>
                <input
                  type="password"
                  name="old_password"
                  value={passwordData.old_password}
                  onChange={handlePasswordChange}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
                  required
                />
              </div>

              <div>
                <label className="block text-gray-700 font-medium mb-2">New Password</label>
                <input
                  type="password"
                  name="new_password"
                  value={passwordData.new_password}
                  onChange={handlePasswordChange}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
                  required
                  minLength={6}
                />
                <p className="text-xs text-gray-500 mt-1">Minimum 6 characters</p>
              </div>

              <div>
                <label className="block text-gray-700 font-medium mb-2">Confirm New Password</label>
                <input
                  type="password"
                  name="confirm_password"
                  value={passwordData.confirm_password}
                  onChange={handlePasswordChange}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
                  required
                  minLength={6}
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition-all"
              >
                {saving ? 'Updating...' : 'Update Password'}
              </button>
            </form>
          </div>
        )}

        {/* Image Tab */}
        {activeTab === 'image' && (
          <div className="bg-white rounded-xl shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Profile Image</h2>
            <form onSubmit={handleImageSubmit} className="space-y-6">
              <div>
                {imagePreview && (
                  <div className="mb-6">
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="w-48 h-48 object-cover rounded-lg border-2 border-gray-300"
                    />
                  </div>
                )}
                <label className="block text-gray-700 font-medium mb-2">Upload New Image</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
                />
                <p className="text-xs text-gray-500 mt-1">JPG, PNG, GIF, WEBP up to 5MB</p>
              </div>

              <button
                type="submit"
                disabled={saving || !imageFile}
                className="w-full bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition-all"
              >
                {saving ? 'Uploading...' : 'Upload Image'}
              </button>
            </form>
          </div>
        )}

        {/* Location Tab */}
        {activeTab === 'location' && (
          <div className="bg-white rounded-xl shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Venue Location</h2>
            <p className="text-gray-500 text-sm mb-6">
              Pin your venue on the map so customers can find you easily. Search for your address or click directly on the map.
            </p>

            {/* Current saved location badge */}
            {vendor?.latitude && vendor?.longitude && (
              <div className="mb-6 flex items-center gap-2 bg-green-50 border border-green-200 text-green-800 rounded-lg px-4 py-3 text-sm">
                <span>✅</span>
                <span className="font-medium">Location already saved.</span>
                <span className="text-green-600">Update it below if needed.</span>
              </div>
            )}

            <form onSubmit={handleLocationSubmit} className="space-y-6">
              <MapPicker
                initialLat={locationData.latitude}
                initialLng={locationData.longitude}
                initialAddress={locationData.location_address}
                onLocationChange={(lat, lng, addr) =>
                  setLocationData({ latitude: lat || null, longitude: lng || null, location_address: addr || null })
                }
              />

              <button
                type="submit"
                disabled={savingLocation || !locationData.latitude}
                className="w-full bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition-all"
              >
                {savingLocation ? 'Saving Location...' : '📍 Save Location'}
              </button>
            </form>
          </div>
        )}
        </div>
      </div>
    </div>
  )
}

