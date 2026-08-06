import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useSignUp, useAuth, useUser } from '@clerk/clerk-react'
import api from '../../services/api'
import { getClerkErrorMessage, splitFullName, waitForAuthSync } from '../../utils/clerkAuth'
import { showSuccess } from '../../utils/toast'

export default function VendorRegisterPage() {
  const { isLoaded, signUp, setActive } = useSignUp()
  const { isLoaded: authLoaded, isSignedIn, getToken } = useAuth()
  const { user: clerkUser } = useUser()
  const [formData, setFormData] = useState({
    business_name: '',
    contact_person: '',
    email: '',
    phone_number: '',
    business_address: '',
    service_category: '',
    password: '',
    confirm_password: ''
  })
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [alreadyRegistered, setAlreadyRegistered] = useState(false)
  const [registrationSuccess, setRegistrationSuccess] = useState(false)
  const [pendingVerification, setPendingVerification] = useState(false)
  const [verificationCode, setVerificationCode] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    if (!authLoaded) return
    // Prevent redirect if we are currently registering or have successfully registered
    if (isSubmitting || pendingVerification || registrationSuccess) return

    if (isSignedIn) {
      const role = (clerkUser?.publicMetadata?.role as string) ||
        (clerkUser?.unsafeMetadata?.role as string) ||
        'user'
      const redirectUrl = role === 'vendor'
        ? '/vendor/dashboard'
        : role === 'admin'
          ? '/admin/dashboard'
          : '/dashboard'
      navigate(redirectUrl)
    }
  }, [authLoaded, isSignedIn, clerkUser, navigate, isSubmitting, pendingVerification, registrationSuccess])

  const categories = [
    'Photographer', 'Caterer', 'Venue', 'Decorator',
    'Makeup Artist', 'Music & Entertainment'
  ]

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setImageFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setImagePreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const completeRegistration = async () => {
    if (!signUp || !signUp.createdSessionId) return;

    await setActive({ session: signUp.createdSessionId })

    // Ensure we get the token directly from Clerk.
    // The session might take a moment to become active in the Clerk instance, so we retry.
    let token = null;
    let attempts = 0;
    while (!token && attempts < 25) {
      try {
        // Try to get token from window.Clerk if available, otherwise fallback to useAuth's getToken
        if (typeof window !== 'undefined' && (window as any).Clerk?.session) {
          token = await (window as any).Clerk.session.getToken();
        } else {
          token = await getToken();
        }
      } catch (e) {
        // ignore errors during polling
      }
      if (!token) {
        await new Promise(r => setTimeout(r, 200));
        attempts++;
      }
    }

    await waitForAuthSync();

    const vendorData = {
      business_name: formData.business_name,
      contact_person: formData.contact_person,
      email: formData.email,
      phone_number: formData.phone_number,
      business_address: formData.business_address,
      service_category: formData.service_category,
    }

    const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
    const registerResponse = await api.post('/vendors/register', vendorData, config)

    if (imageFile && registerResponse.data) {
      try {
        const imageFormData = new FormData()
        imageFormData.append('file', imageFile)
      } catch (imgErr) {
        console.error('Image upload failed:', imgErr)
      }
    }

    setRegistrationSuccess(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsSubmitting(true)

    if (!isLoaded || !signUp) {
      setError('Authentication is still loading. Please try again.')
      setIsSubmitting(false)
      return
    }

    if (formData.password !== formData.confirm_password) {
      setError('Passwords do not match')
      setIsSubmitting(false)
      return
    }

    try {
      const { firstName, lastName } = splitFullName(formData.contact_person)

      await signUp.create({
        emailAddress: formData.email.trim(),
        password: formData.password,
        firstName,
        lastName,
        unsafeMetadata: {
          role: 'vendor',
          phone_number: formData.phone_number.trim(),
        },
      })

      if (signUp.status === 'complete') {
        await completeRegistration()
        return
      }

      if (signUp.status === 'missing_requirements') {
        await signUp.prepareEmailAddressVerification({ strategy: 'email_code' })
        setPendingVerification(true)
        showSuccess('Verification code sent to your email.')
        return
      }

      setError('Account setup could not be completed. Please try again.')
    } catch (err: unknown) {
      const errorMsg = getClerkErrorMessage(err, 'Registration failed')
      setError(errorMsg)
      if (errorMsg.toLowerCase().includes('already registered') || errorMsg.toLowerCase().includes('identifier exists') || errorMsg.toLowerCase().includes('identifier in use')) {
        setAlreadyRegistered(true)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleVerifyEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!signUp || !verificationCode.trim()) {
      setError('Please enter the verification code from your email')
      return
    }

    setIsSubmitting(true)
    try {
      const result = await signUp.attemptEmailAddressVerification({
        code: verificationCode.trim(),
      })

      if (result.status === 'complete') {
        await completeRegistration()
        return
      }

      setError('Verification incomplete. Please check the code and try again.')
    } catch (err: unknown) {
      const errorMsg = getClerkErrorMessage(err, 'Verification failed')
      setError(errorMsg)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Success View
  if (registrationSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50/30 to-red-50/20 flex items-center justify-center py-12 px-4">
        <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-2xl p-8 md:p-12">
          <div className="text-center">
            {/* Success Icon */}
            <div className="flex justify-center mb-6">
              <div className="bg-gradient-to-r from-green-400 to-green-600 rounded-full p-4 w-24 h-24 flex items-center justify-center shadow-lg">
                <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>

            <h2 className="text-3xl font-bold bg-gradient-to-r from-red-600 to-orange-600 bg-clip-text text-transparent mb-4">
              Registration Successful!
            </h2>

            <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-6 mb-6 text-left">
              <h3 className="text-lg font-bold text-blue-900 mb-3 flex items-center gap-2">
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                Pending Admin Approval
              </h3>
              <p className="text-blue-800 mb-3">
                Your vendor registration has been submitted successfully! Your account is now pending admin approval.
              </p>
              <ul className="list-disc list-inside text-blue-700 space-y-2 text-sm">
                <li>You can login to your account immediately</li>
                <li>Your profile will be visible to customers once approved by admin</li>
                <li>You will receive notification once your account is approved</li>
                <li>You can manage your profile and packages while waiting for approval</li>
              </ul>
            </div>

            <div className="flex gap-4 justify-center">
              <button
                onClick={() => navigate('/login')}
                className="bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white px-8 py-3 rounded-lg font-semibold transition-all shadow-lg hover:shadow-xl"
              >
                Go to Login
              </button>
              <button
                onClick={() => setRegistrationSuccess(false)}
                className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-8 py-3 rounded-lg font-semibold transition-all"
              >
                Register Another
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50/30 to-red-50/20 py-12 px-4">
      <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-xl p-8">
        <h2 className="text-3xl font-bold text-center bg-gradient-to-r from-red-600 to-orange-600 bg-clip-text text-transparent mb-2">
          Vendor Registration
        </h2>
        <p className="text-center text-gray-600 mb-8">
          Register your business and start serving customers
        </p>

        {/* Info Banner */}
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-700">
                <strong>Note:</strong> Your registration will be reviewed by an administrator. You'll be able to login immediately, but your profile will be visible to customers only after approval.
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm">
            {error}
          </div>
        )}

        {pendingVerification ? (
          <form onSubmit={handleVerifyEmail} className="space-y-4 sm:space-y-5">
            <p className="text-gray-600 text-sm">
              We sent a verification code to <strong>{formData.email}</strong>. Enter it below to finish creating your vendor account.
            </p>
            <div>
              <label className="block text-gray-700 font-medium mb-2 text-sm sm:text-base">Verification Code</label>
              <input
                type="text"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                className="w-full px-3 sm:px-4 py-2.5 sm:py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent text-sm sm:text-base"
                placeholder="Enter 6-digit code"
                required
              />
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-pink-600 hover:bg-pink-700 text-white py-3 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Verifying...' : 'Verify & Complete Registration'}
            </button>
            <button
              type="button"
              onClick={() => {
                setPendingVerification(false)
                setVerificationCode('')
                setError('')
              }}
              className="w-full text-gray-600 hover:text-gray-800 text-sm"
            >
              Back to registration
            </button>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-gray-700 font-medium mb-2">Business Name</label>
                <input
                  type="text"
                  value={formData.business_name}
                  onChange={(e) => setFormData({ ...formData, business_name: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                  placeholder="Enter business name"
                  required
                />
              </div>

              <div>
                <label className="block text-gray-700 font-medium mb-2">Contact Person Name</label>
                <input
                  type="text"
                  value={formData.contact_person}
                  onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                  placeholder="Enter contact person name"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-gray-700 font-medium mb-2">Email Address</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => {
                    setFormData({ ...formData, email: e.target.value })
                    setAlreadyRegistered(false)
                  }}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                  placeholder="Enter email address"
                  required
                />
              </div>

              <div>
                <label className="block text-gray-700 font-medium mb-2">Phone Number</label>
                <input
                  type="tel"
                  value={formData.phone_number}
                  onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                  placeholder="Enter phone number"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-gray-700 font-medium mb-2">Business Address</label>
              <input
                type="text"
                value={formData.business_address}
                onChange={(e) => setFormData({ ...formData, business_address: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                placeholder="Enter business address"
                required
              />
            </div>

            <div>
              <label className="block text-gray-700 font-medium mb-2">Service Category</label>
              <select
                value={formData.service_category}
                onChange={(e) => setFormData({ ...formData, service_category: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                required
              >
                <option value="">Select a category</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-gray-700 font-medium mb-2">Password</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                  placeholder="Create password"
                  required
                />
              </div>

              <div>
                <label className="block text-gray-700 font-medium mb-2">Confirm Password</label>
                <input
                  type="password"
                  value={formData.confirm_password}
                  onChange={(e) => setFormData({ ...formData, confirm_password: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                  placeholder="Confirm password"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-pink-600 hover:bg-pink-700 text-white py-3 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Registering...' : 'Register as Vendor'}
            </button>
          </form>
        )}

        {alreadyRegistered ? (
          <div className="mt-6 text-center space-y-3">
            <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg text-sm">
              This email is already registered with Clerk. Please login or reset your password.
            </div>
            <div className="flex flex-col sm:flex-row justify-center gap-3">
              <Link
                to="/login"
                className="px-5 py-3 rounded-lg bg-primary-600 text-white font-semibold hover:bg-primary-700"
              >
                Login
              </Link>
              <Link
                to="/forgot-password"
                className="px-5 py-3 rounded-lg bg-gray-100 text-gray-800 font-semibold hover:bg-gray-200"
              >
                Forgot Password
              </Link>
            </div>
          </div>
        ) : (
          <div className="mt-6 text-center">
            <p className="text-gray-600 text-sm">
              Already a vendor?{' '}
              <Link to="/login" className="text-[#D72626] font-semibold hover:text-red-700 transition-colors">
                Login
              </Link>
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

