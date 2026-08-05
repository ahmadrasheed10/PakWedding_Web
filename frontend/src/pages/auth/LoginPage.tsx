import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useSignIn, useUser, useAuth } from '@clerk/clerk-react'
import { useAuthStore } from '../../store/authStore'
import api from '../../services/api'
import { showSuccess, showError } from '../../utils/toast'
import { getClerkErrorMessage, waitForAuthSync } from '../../utils/clerkAuth'

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

export default function LoginPage() {
  const { isLoaded, signIn, setActive } = useSignIn()
  const [alreadyRegistered, setAlreadyRegistered] = useState(false)
  const navigate = useNavigate()
  const { user: clerkUser } = useUser()
  const { isLoaded: authLoaded, isSignedIn } = useAuth()

  const authUser = useAuthStore((state) => state.user)

  useEffect(() => {
    if (!authLoaded) return
    
    const checkRoleAndRedirect = async () => {
      if (isSignedIn && clerkUser) {
        // Clerk frontend SDK contains the most up-to-date metadata
        const clerkRole = (clerkUser?.unsafeMetadata?.role as string) || (clerkUser?.publicMetadata?.role as string)
        
        let finalRole = clerkRole || authUser?.role
        
        // If we don't confidently have a role, fetch from backend
        if (!finalRole || finalRole === 'user') {
          try {
            const token = await window.Clerk?.session?.getToken()
            if (token) {
              const apiBase = import.meta.env.VITE_API_URL || '/api'
              const res = await fetch(`${apiBase}/users/me`, {
                headers: { Authorization: `Bearer ${token}` }
              })
              if (res.ok) {
                const data = await res.json()
                finalRole = data.role
                useAuthStore.getState().setAuth(data, token)
              }
            }
          } catch (e) {
            console.error('Failed to verify backend role', e)
          }
        }
        
        // Default to user if still unknown
        finalRole = finalRole || 'user'
        
        if (finalRole === 'vendor') {
          navigate('/vendor/dashboard')
        } else if (finalRole === 'admin') {
          navigate('/admin/dashboard')
        } else {
          navigate('/dashboard')
        }
      }
    }
    
    checkRoleAndRedirect()
  }, [authLoaded, isSignedIn, clerkUser, navigate])
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [emailError, setEmailError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setEmailError('')
    setIsSubmitting(true)
    
    if (!isLoaded || !signIn) {
      showError('Authentication is still loading. Please try again.')
      setIsSubmitting(false)
      return
    }

    // Validate email format
    const emailValidation = validateEmail(email)
    if (!emailValidation.isValid) {
      showError(emailValidation.error)
      setEmailError(emailValidation.error)
      setError(emailValidation.error)
      setIsSubmitting(false)
      return
    }

    const backendLogin = async () => {
      const formData = new URLSearchParams()
      formData.append('username', email.trim())
      formData.append('password', password)

      const fallbackResponse = await api.post('/auth/login', formData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      })

      const userFromBackend = fallbackResponse.data?.user
      const tokenFromBackend = fallbackResponse.data?.access_token
      if (!userFromBackend || !tokenFromBackend) {
        throw new Error('Backend login did not return valid credentials.')
      }

      useAuthStore.getState().setAuth(userFromBackend, tokenFromBackend)
      showSuccess(`Welcome back, ${userFromBackend.full_name}!`)
      setTimeout(() => {
        if (userFromBackend.role === 'vendor') {
          window.location.href = '/vendor/dashboard'
        } else if (userFromBackend.role === 'admin') {
          window.location.href = '/admin/dashboard'
        } else {
          window.location.href = '/dashboard'
        }
      }, 1000)
      return true
    }

    let backendErrorMessage = ''

    try {
      try {
        const backendSuccess = await backendLogin()
        if (backendSuccess) {
          return
        }
      } catch (backendErr: unknown) {
        backendErrorMessage = (backendErr as any)?.response?.data?.detail || (backendErr as any)?.message || ''
      }

      const result = await signIn.create({
        identifier: email.trim(),
        password,
      })

      if (result.status === 'complete' && result.createdSessionId) {
        await setActive({ session: result.createdSessionId })
        await waitForAuthSync()

        // After waitForAuthSync, ClerkSessionSync should have updated the store
        let user = useAuthStore.getState().user
        if (!user) {
           // Fallback if store is still empty
           try {
             const token = await window.Clerk?.session?.getToken()
             if (token) {
               const apiBase = import.meta.env.VITE_API_URL || '/api'
               const res = await fetch(`${apiBase}/users/me`, {
                 headers: { Authorization: `Bearer ${token}` }
               })
               if (res.ok) {
                 const data = await res.json()
                 useAuthStore.getState().setAuth(data, token)
                 user = data
               }
             }
           } catch (e) {
             console.error('Failed to fetch backend user fallback', e)
           }
        }

        if (user) {
          showSuccess(`Welcome back, ${user.full_name}!`)
          
          // Clerk frontend SDK contains the most up-to-date metadata
          const clerkRole = window.Clerk?.user?.unsafeMetadata?.role as string
          const finalRole = clerkRole || user.role

          setTimeout(() => {
            if (finalRole === 'vendor') {
              navigate('/vendor/dashboard')
            } else if (finalRole === 'admin') {
              navigate('/admin/dashboard')
            } else {
              navigate('/dashboard')
            }
          }, 1000)
          return
        }
      }

      if (backendErrorMessage) {
        showError(backendErrorMessage)
        setError(backendErrorMessage)
      } else {
        showError('Login failed. Please check your credentials.')
        setError('Login failed. Please check your credentials.')
      }
    } catch (err: unknown) {
      const clerkError = getClerkErrorMessage(err, '')
      const errorMsg = backendErrorMessage || clerkError || 'Login failed. Please check your credentials.'
      showError(errorMsg)
      setError(errorMsg)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50/30 to-red-50/20 flex items-center justify-center py-6 sm:py-12 px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-xl p-6 sm:p-8 border-2 border-rose-100 hover:border-primary-200 transition-all duration-300">
        <h2 className="text-2xl sm:text-3xl font-bold text-center text-gray-900 mb-6 sm:mb-8">Welcome Back!</h2>

        {error && (
          <div className="bg-red-50 border-2 border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
          <div>
            <label className="block text-gray-700 font-medium mb-2 text-sm sm:text-base">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                setEmailError('')
                setError('')
              }}
              className={`w-full px-3 sm:px-4 py-2.5 sm:py-3 border-2 rounded-lg focus:outline-none focus:ring-2 transition-all duration-300 text-sm sm:text-base ${
                emailError
                  ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
                  : 'border-gray-300 focus:ring-primary-500 focus:border-primary-500'
              }`}
              placeholder="Enter your email"
              required
            />
            {emailError && (
              <p className="mt-2 text-sm text-red-600">{emailError}</p>
            )}
          </div>

          <div>
            <label className="block text-gray-700 font-medium mb-2 text-sm sm:text-base">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 sm:px-4 py-2.5 sm:py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-300 text-sm sm:text-base"
              placeholder="Enter your password"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-gradient-to-r from-primary-600 via-accent-600 to-primary-600 hover:from-primary-700 hover:via-accent-700 hover:to-primary-700 text-white py-2.5 sm:py-3 rounded-lg font-semibold transition-all duration-300 shadow-lg hover:shadow-xl hover:shadow-primary-600/50 transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none text-sm sm:text-base"
          >
            {isSubmitting ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <div className="mt-4 sm:mt-6 text-center">
          <p className="text-gray-600 text-xs sm:text-sm">
            Don't have an account?{' '}
            <Link to="/register" className="bg-gradient-to-r from-primary-600 via-accent-600 to-primary-600 bg-clip-text text-transparent font-semibold hover:from-primary-700 hover:via-accent-700 hover:to-primary-700 transition-all duration-300">
              Sign Up
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
