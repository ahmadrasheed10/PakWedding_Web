import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useSignIn } from '@clerk/clerk-react'
import toast from 'react-hot-toast'
import { getClerkErrorMessage } from '../../utils/clerkAuth'

// Email validation function
const validateEmail = (email: string): { isValid: boolean; error: string } => {
  email = email.trim()
  const emailRegex = /^[a-zA-Z0-9._+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
  if (!emailRegex.test(email)) {
    return { isValid: false, error: 'Please enter a valid email address' }
  }
  if (email.includes('..') || email.includes(' ')) {
    return { isValid: false, error: 'Invalid email format' }
  }
  const [localPart, domainPart] = email.split('@')
  if (!localPart || !domainPart || !domainPart.includes('.')) {
    return { isValid: false, error: 'Please enter a valid email address' }
  }
  return { isValid: true, error: '' }
}

export default function ForgotPasswordPage() {
  const { isLoaded, signIn } = useSignIn()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [emailError, setEmailError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setEmailError('')
    setLoading(true)
    
    if (!isLoaded || !signIn) {
      setError('Authentication is still loading. Please try again.')
      setLoading(false)
      return
    }

    const emailValidation = validateEmail(email)
    if (!emailValidation.isValid) {
      setEmailError(emailValidation.error)
      setError(emailValidation.error)
      toast.error(emailValidation.error)
      setLoading(false)
      return
    }

    try {
      await signIn.create({
        strategy: 'reset_password_email_code',
        identifier: email.trim(),
      })

      setSuccess(true)
      toast.success('Password reset code sent! Check your email 📧')
      navigate('/reset-password', { state: { email: email.trim() } })
    } catch (err: unknown) {
      const errorMsg = getClerkErrorMessage(err, 'Failed to process request')
      setError(errorMsg)
      toast.error(errorMsg)
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50/30 to-red-50/20 flex items-center justify-center py-12 px-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-xl p-8">
          <div className="text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Check Your Email</h2>
            <p className="text-gray-600 mb-6">
              If an account exists with this email, a password reset code has been sent to your inbox. Use that code on the reset password page.
            </p>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-left">
              <p className="text-sm text-blue-800 font-semibold mb-2">📧 Check Your Email</p>
              <ul className="text-xs text-blue-700 space-y-1">
                <li>• The email may take a few minutes to arrive</li>
                <li>• Check your spam/junk folder if you don't see it</li>
                <li>• Enter the code on the reset password page</li>
              </ul>
            </div>

            <div className="space-y-3">
              <Link
                to="/reset-password"
                state={{ email }}
                className="block w-full bg-gradient-to-r from-[#D72626] to-red-600 hover:from-red-700 hover:to-red-800 text-white py-3 rounded-lg font-semibold transition-all shadow-md"
              >
                Enter Reset Code
              </Link>
              <Link
                to="/login"
                className="block w-full bg-gray-200 hover:bg-gray-300 text-gray-700 py-3 rounded-lg font-semibold transition-all"
              >
                Back to Login
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50/30 to-red-50/20 flex items-center justify-center py-12 px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-xl p-8">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Forgot Password?</h2>
          <p className="text-gray-600">
            Enter your email address and we'll send you a link to reset your password.
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-gray-700 font-medium mb-2">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                setEmailError('')
                setError('')
              }}
              className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 ${
                emailError
                  ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
                  : 'border-gray-300 focus:ring-[#D72626] focus:border-transparent'
              }`}
              placeholder="Enter your email"
              required
              disabled={loading}
            />
            {emailError && (
              <p className="text-red-600 text-sm mt-1">{emailError}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-[#D72626] to-red-600 hover:from-red-700 hover:to-red-800 text-white py-3 rounded-lg font-semibold transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Sending...' : 'Send Reset Link'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link to="/login" className="text-[#D72626] font-semibold hover:text-red-700 transition-colors">
            ← Back to Login
          </Link>
        </div>
      </div>
    </div>
  )
}
