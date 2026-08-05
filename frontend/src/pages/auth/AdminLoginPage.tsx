import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useSignIn } from '@clerk/clerk-react'
import { useAuthStore } from '../../store/authStore'
import { getClerkErrorMessage, waitForAuthSync } from '../../utils/clerkAuth'

export default function AdminLoginPage() {
  const { isLoaded, signIn, setActive } = useSignIn()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [twoFactorCode, setTwoFactorCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (!isLoaded || !signIn) {
      setError('Authentication is still loading. Please try again.')
      setLoading(false)
      return
    }

    try {
      if (!email || !password) {
        setError('Please enter both email and password')
        setLoading(false)
        return
      }

      if (twoFactorCode && twoFactorCode.length < 6) {
        setError('Invalid 2FA code')
        setLoading(false)
        return
      }

      const result = await signIn.create({
        identifier: email.trim(),
        password,
      })

      if (result.status !== 'complete' || !result.createdSessionId) {
        setError('Login could not be completed. Please try again.')
        setLoading(false)
        return
      }

      await setActive({ session: result.createdSessionId })
      await waitForAuthSync()

      const storedUser = useAuthStore.getState().user
      const storedToken = useAuthStore.getState().token

      if (!storedToken) {
        setError('Failed to save authentication. Please try again.')
        setLoading(false)
        return
      }

      if (!storedUser || storedUser.role !== 'admin') {
        useAuthStore.getState().logout()
        setError('Access denied. Admin credentials required.')
        setLoading(false)
        return
      }

      navigate('/admin/dashboard')
    } catch (err: unknown) {
      const errorMessage = getClerkErrorMessage(err, 'Login failed. Please check your credentials and try again.')
      setError(errorMessage)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50/30 to-red-50/20 flex items-center justify-center py-12 px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-xl p-8">
        <h2 className="text-3xl font-bold text-center text-gray-900 mb-8">Admin Access</h2>
        
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-gray-700 font-medium mb-2">Admin Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
              placeholder="Enter admin email"
              required
            />
          </div>

          <div>
            <label className="block text-gray-700 font-medium mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
              placeholder="Enter password"
              required
            />
          </div>

          <div>
            <label className="block text-gray-700 font-medium mb-2">2FA Code (Optional)</label>
            <input
              type="text"
              value={twoFactorCode}
              onChange={(e) => setTwoFactorCode(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
              placeholder="Enter 2FA code"
              maxLength={6}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full bg-pink-600 hover:bg-pink-700 text-white py-3 rounded-lg font-semibold transition-colors ${
              loading ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {loading ? 'Logging in...' : 'Enter Admin Portal'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link to="/login" className="text-sm text-[#D72626] hover:text-red-700 transition-colors font-semibold">
            Back to User Login
          </Link>
        </div>
      </div>
    </div>
  )
}
