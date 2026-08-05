import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useSignUp, useAuth, useUser } from '@clerk/clerk-react'
import { showSuccess, showError, showWarning } from '../../utils/toast'
import PasswordStrengthMeter from '../../components/PasswordStrengthMeter'
import { getClerkErrorMessage, splitFullName, waitForAuthSync } from '../../utils/clerkAuth'

// Email validation function
const validateEmail = (email: string): { isValid: boolean; error: string } => {
  // Remove spaces
  email = email.trim()
  
  // Basic format check
  const emailRegex = /^[a-zA-Z0-9._+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
  if (!emailRegex.test(email)) {
    return { isValid: false, error: 'Please enter a valid email address' }
  }
  
  // Check for double dots
  if (email.includes('..')) {
    return { isValid: false, error: 'Email cannot contain consecutive dots' }
  }
  
  // Check for spaces
  if (email.includes(' ')) {
    return { isValid: false, error: 'Email cannot contain spaces' }
  }
  
  // Check domain part
  const [localPart, domainPart] = email.split('@')
  
  // Validate local part (before @)
  if (!localPart || localPart.length === 0) {
    return { isValid: false, error: 'Email must have content before @' }
  }
  
  if (localPart.startsWith('.') || localPart.endsWith('.')) {
    return { isValid: false, error: 'Email cannot start or end with a dot' }
  }
  
  // Validate domain part (after @)
  if (!domainPart || domainPart.length === 0) {
    return { isValid: false, error: 'Email must have a valid domain' }
  }
  
  // Check for multiple @ symbols
  if (email.split('@').length > 2) {
    return { isValid: false, error: 'Email can only contain one @ symbol' }
  }
  
  // Check for double extensions (e.g., .com.com)
  const domainParts = domainPart.split('.')
  const extensions = domainParts.slice(1) // Get all parts after the domain name
  const uniqueExtensions = new Set(extensions)
  
  if (extensions.length !== uniqueExtensions.size) {
    return { isValid: false, error: 'Email has duplicate extensions (e.g., .com.com)' }
  }
  
  // Check for valid TLD (top-level domain)
  const tld = domainParts[domainParts.length - 1]
  if (tld.length < 2) {
    return { isValid: false, error: 'Email must have a valid domain extension' }
  }
  
  // Check if domain has at least one dot
  if (!domainPart.includes('.')) {
    return { isValid: false, error: 'Email must have a valid domain (e.g., example.com)' }
  }
  
  return { isValid: true, error: '' }
}

export default function RegisterPage() {
  const { isLoaded, signUp, setActive } = useSignUp()
  const { isLoaded: authLoaded, isSignedIn } = useAuth()
  const { user: clerkUser } = useUser()
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone_number: '',
    password: '',
    confirm_password: '',
    role: 'user' // user, vendor, or admin
  })
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isPasswordValid, setIsPasswordValid] = useState(false)
  const [emailError, setEmailError] = useState('')
  const [pendingVerification, setPendingVerification] = useState(false)
  const [verificationCode, setVerificationCode] = useState('')
  const [alreadyRegistered, setAlreadyRegistered] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    if (!authLoaded) return
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
  }, [authLoaded, isSignedIn, clerkUser, navigate])

  const completeRegistration = async () => {
    if (!signUp) return

    if (signUp.status === 'complete' && signUp.createdSessionId) {
      await setActive({ session: signUp.createdSessionId })
      await waitForAuthSync()

      if (formData.role === 'admin') {
        showSuccess('Admin registration submitted! Your request is pending approval.')
        setTimeout(() => navigate('/login'), 2000)
        return
      }

      showSuccess('Account created successfully! You can now login.')
      setTimeout(() => navigate('/login'), 1500)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setEmailError('')

    if (!isLoaded || !signUp) {
      showError('Authentication is still loading. Please try again.')
      return
    }

    if (!formData.full_name || !formData.email || !formData.password) {
      showWarning('Please fill in all required fields')
      return
    }
    
    // Validate email format
    const emailValidation = validateEmail(formData.email)
    if (!emailValidation.isValid) {
      showError(emailValidation.error)
      setEmailError(emailValidation.error)
      setError(emailValidation.error)
      return
    }

    if (formData.password !== formData.confirm_password) {
      showError('Passwords do not match')
      return
    }

    if (!isPasswordValid) {
      showError('Please choose a stronger password')
      return
    }

    setIsSubmitting(true)
    try {
      const { firstName, lastName } = splitFullName(formData.full_name)

      await signUp.create({
        emailAddress: formData.email.trim(),
        password: formData.password,
        firstName,
        lastName,
        unsafeMetadata: {
          role: formData.role,
          phone_number: formData.phone_number.trim(),
        },
      })

      if (signUp.status === 'complete') {
        await completeRegistration()
        return
      }

      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' })
      setPendingVerification(true)
      showSuccess('Verification code sent to your email.')
    } catch (err: unknown) {
      const errorMsg = getClerkErrorMessage(err, 'Registration failed')
      showError(errorMsg)
      setError(errorMsg)
      if (errorMsg.toLowerCase().includes('already registered') || errorMsg.toLowerCase().includes('identifier exists') || errorMsg.toLowerCase().includes('identifier in use')) {
        setEmailError('This email is already registered. Please login or reset your password.')
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
      showWarning('Please enter the verification code from your email')
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

      showError('Verification incomplete. Please check the code and try again.')
    } catch (err: unknown) {
      const errorMsg = getClerkErrorMessage(err, 'Verification failed')
      showError(errorMsg)
      setError(errorMsg)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50/30 to-red-50/20 flex items-center justify-center py-6 sm:py-12 px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-xl p-6 sm:p-8">
        <h2 className="text-2xl sm:text-3xl font-bold text-center text-gray-900 mb-6 sm:mb-8">
          {pendingVerification ? 'Verify Your Email' : 'Create New Account'}
        </h2>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm">
            {error}
          </div>
        )}

        {pendingVerification ? (
          <form onSubmit={handleVerifyEmail} className="space-y-4 sm:space-y-5">
            <p className="text-gray-600 text-sm">
              We sent a verification code to <strong>{formData.email}</strong>. Enter it below to finish creating your account.
            </p>
            <div>
              <label className="block text-gray-700 font-medium mb-2 text-sm sm:text-base">Verification Code</label>
              <input
                type="text"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                className="w-full px-3 sm:px-4 py-2.5 sm:py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-transparent text-sm sm:text-base"
                placeholder="Enter 6-digit code"
                required
              />
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-gradient-to-r from-primary-600 via-accent-600 to-primary-600 hover:from-primary-700 hover:via-accent-700 hover:to-primary-700 text-white py-2.5 sm:py-3 rounded-lg font-semibold transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
            >
              {isSubmitting ? 'Verifying...' : 'Verify & Create Account'}
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
          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
            <div>
              <label className="block text-gray-700 font-medium mb-2 text-sm sm:text-base">Full Name</label>
              <input
                type="text"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                className="w-full px-3 sm:px-4 py-2.5 sm:py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-transparent text-sm sm:text-base"
                placeholder="Enter your full name"
                required
              />
            </div>

            <div>
              <label className="block text-gray-700 font-medium mb-2 text-sm sm:text-base">Email Address</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => {
                  setFormData({ ...formData, email: e.target.value })
                  setEmailError('')
                  setError('')
                  setAlreadyRegistered(false)
                }}
                className={`w-full px-3 sm:px-4 py-2.5 sm:py-3 border rounded-lg focus:outline-none focus:ring-2 text-sm sm:text-base ${
                  emailError 
                    ? 'border-red-500 focus:ring-red-500 focus:border-red-500' 
                    : 'border-gray-300 focus:ring-primary-600 focus:border-transparent'
                }`}
                placeholder="Enter your email"
                required
              />
              {emailError && (
                <p className="text-red-600 text-sm mt-1">{emailError}</p>
              )}
            </div>

            <div>
              <label className="block text-gray-700 font-medium mb-2 text-sm sm:text-base">Phone Number</label>
              <input
                type="tel"
                value={formData.phone_number}
                onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                className="w-full px-3 sm:px-4 py-2.5 sm:py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-transparent text-sm sm:text-base"
                placeholder="Enter your phone number"
              />
            </div>

            <div>
              <label className="block text-gray-700 font-medium mb-2 text-sm sm:text-base">Sign Up As</label>
              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, role: 'user' })}
                  className={`px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg font-semibold transition-all text-sm sm:text-base ${
                    formData.role === 'user'
                      ? 'bg-gradient-to-r from-primary-600 via-accent-600 to-primary-600 text-white shadow-lg'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  User
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, role: 'admin' })}
                  className={`px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg font-semibold transition-all text-sm sm:text-base ${
                    formData.role === 'admin'
                      ? 'bg-gradient-to-r from-primary-600 via-accent-600 to-primary-600 text-white shadow-lg'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Admin
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                {formData.role === 'user' 
                  ? 'Sign up as a regular user to book vendors for your wedding'
                  : 'Sign up as an admin to manage the platform'}
              </p>
            </div>

            <div>
              <label className="block text-gray-700 font-medium mb-2 text-sm sm:text-base">Password</label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full px-3 sm:px-4 py-2.5 sm:py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-transparent text-sm sm:text-base"
                placeholder="Create a password"
                required
              />
              <PasswordStrengthMeter 
                password={formData.password}
                onStrengthChange={setIsPasswordValid}
              />
            </div>

            <div>
              <label className="block text-gray-700 font-medium mb-2 text-sm sm:text-base">Confirm Password</label>
              <input
                type="password"
                value={formData.confirm_password}
                onChange={(e) => setFormData({ ...formData, confirm_password: e.target.value })}
                className="w-full px-3 sm:px-4 py-2.5 sm:py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-transparent text-sm sm:text-base"
                placeholder="Confirm your password"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-gradient-to-r from-primary-600 via-accent-600 to-primary-600 hover:from-primary-700 hover:via-accent-700 hover:to-primary-700 text-white py-2.5 sm:py-3 rounded-lg font-semibold transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
            >
              {isSubmitting ? 'Creating Account...' : 'Sign Up'}
            </button>
          </form>
        )}

        {alreadyRegistered ? (
          <div className="mt-4 sm:mt-6 text-center space-y-3">
            <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg text-sm">
              It looks like this email is already registered with Clerk.
              Please login or reset your password instead.
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                to="/login"
                className="w-full sm:w-auto px-5 py-3 rounded-lg bg-primary-600 text-white font-semibold hover:bg-primary-700 text-sm"
              >
                Go to Login
              </Link>
              <Link
                to="/forgot-password"
                className="w-full sm:w-auto px-5 py-3 rounded-lg bg-gray-100 text-gray-800 font-semibold hover:bg-gray-200 text-sm"
              >
                Forgot Password
              </Link>
            </div>
          </div>
        ) : (
          <div className="mt-4 sm:mt-6 text-center space-y-2">
            <p className="text-gray-600 text-xs sm:text-sm">
              Already have an account?{' '}
              <Link to="/login" className="text-[#D72626] font-semibold hover:text-red-700 transition-colors">
                Login
              </Link>
            </p>
            <p className="text-gray-600 text-xs sm:text-sm">
              Are you a vendor?{' '}
              <Link to="/vendor/register" className="text-[#D72626] font-semibold hover:text-red-700 transition-colors">
                Vendor Signup
              </Link>
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
