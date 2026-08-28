import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
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
  const { user: clerkUser } = useUser()
  const { isLoaded: authLoaded, isSignedIn } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [emailError, setEmailError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [pendingSecondFactor, setPendingSecondFactor] = useState(false)
  const [secondFactorCode, setSecondFactorCode] = useState('')
  const [secondFactorStrategy, setSecondFactorStrategy] = useState('email_code')
  const [secondFactorTarget, setSecondFactorTarget] = useState('')

  useEffect(() => {
    if (!authLoaded) return

    if (isSignedIn) {
      const role = (clerkUser?.publicMetadata?.role as string) || (clerkUser?.unsafeMetadata?.role as string) || 'user'
      if (role === 'vendor') {
        window.location.href = '/vendor/dashboard'
      } else if (role === 'admin') {
        window.location.href = '/admin/dashboard'
      } else {
        window.location.href = '/dashboard'
      }
    }
  }, [authLoaded, isSignedIn, clerkUser])

  const handleVerifySecondFactor = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!signIn || !secondFactorCode.trim()) {
      setError('Please enter the verification code')
      return
    }

    setIsSubmitting(true)
    try {
      const result = await signIn.attemptSecondFactor({
        strategy: (secondFactorStrategy as any) || 'email_code',
        code: secondFactorCode.trim(),
      })

      if (result.status === 'complete' && result.createdSessionId) {
        await setActive({ session: result.createdSessionId })

        let token: string | null = null
        for (let i = 0; i < 30; i++) {
          try {
            token = await (window as any).Clerk?.session?.getToken()
            if (token) break
          } catch (e) {}
          await new Promise((resolve) => setTimeout(resolve, 100))
        }

        const clerkUserObj = (window as any).Clerk?.user || (result as any)?.userData
        const role = (clerkUserObj?.publicMetadata?.role as string) || (clerkUserObj?.unsafeMetadata?.role as string) || 'user'
        const fullName = `${clerkUserObj?.firstName || ''} ${clerkUserObj?.lastName || ''}`.trim() || 'User'
        
        let authenticatedUser = {
          id: clerkUserObj?.id || result.createdSessionId,
          email: email.trim(),
          full_name: fullName,
          role: role
        }

        if (token) {
          try {
            let apiBase = (import.meta.env.VITE_API_URL || (import.meta.env.DEV ? '/api' : 'http://localhost:8000/api')).replace(/\/+$/, '')
            if (!apiBase.endsWith('/api') && !apiBase.includes('/api')) {
              apiBase = `${apiBase}/api`
            }
            const res = await fetch(`${apiBase}/users/me`, {
              headers: { Authorization: `Bearer ${token}` }
            })
            if (res.ok) {
              const backendUser = await res.json()
              authenticatedUser = {
                id: backendUser.id || authenticatedUser.id,
                email: backendUser.email || authenticatedUser.email,
                full_name: backendUser.full_name || authenticatedUser.full_name,
                role: backendUser.role || authenticatedUser.role
              }
            }
          } catch (e) {
            console.warn('Backend user profile fetch failed:', e)
          }
          useAuthStore.getState().setAuth(authenticatedUser, token)
        }

        showSuccess(`Welcome back, ${authenticatedUser.full_name}!`)
        setTimeout(() => {
          if (authenticatedUser.role === 'vendor') {
            window.location.href = '/vendor/dashboard'
          } else if (authenticatedUser.role === 'admin') {
            window.location.href = '/admin/dashboard'
          } else {
            window.location.href = '/dashboard'
          }
        }, 600)
        return
      }

      showError('Verification incomplete. Please check the code and try again.')
      setError('Verification incomplete. Please check the code and try again.')
    } catch (err: unknown) {
      console.error('[2FA ERROR]', err)
      const clerkError = getClerkErrorMessage(err, 'Verification failed. Please check the code.')
      showError(clerkError)
      setError(clerkError)
    } finally {
      setIsSubmitting(false)
    }
  }

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

      console.log('[LOGIN] Attempting Clerk signIn with email:', email.trim())
      let signInAttempt = await signIn.create({
        identifier: email.trim(),
        password,
      })

      console.log('[LOGIN] Initial Clerk status:', signInAttempt?.status)

      if (signInAttempt.status === 'needs_first_factor') {
        console.log('[LOGIN] Attempting first factor password strategy...')
        signInAttempt = await signInAttempt.attemptFirstFactor({
          strategy: 'password',
          password,
        })
        console.log('[LOGIN] First factor result status:', signInAttempt?.status)
      }

      if (signInAttempt.status === 'needs_second_factor') {
        console.log('[LOGIN] Account requires second factor. Supported factors:', signInAttempt.supportedSecondFactors)
        const factors = signInAttempt.supportedSecondFactors || []
        const emailFactor = factors.find((f: any) => f.strategy === 'email_code')
        const phoneFactor = factors.find((f: any) => f.strategy === 'phone_code')
        const totpFactor = factors.find((f: any) => f.strategy === 'totp')

        const selectedFactor = emailFactor || phoneFactor || totpFactor || factors[0]
        const strategy = selectedFactor?.strategy || 'email_code'
        const target = (selectedFactor as any)?.safeIdentifier || email.trim()

        setSecondFactorStrategy(strategy)
        setSecondFactorTarget(target)

        if (strategy === 'email_code' || strategy === 'phone_code') {
          try {
            await signIn.prepareSecondFactor({ strategy: strategy as any })
            showSuccess(`Verification code sent to ${target}`)
          } catch (prepErr) {
            console.warn('prepareSecondFactor notice:', prepErr)
          }
        }

        setPendingSecondFactor(true)
        setIsSubmitting(false)
        return
      }

      if (signInAttempt.status === 'complete' && signInAttempt.createdSessionId) {
        await setActive({ session: signInAttempt.createdSessionId })

        // Retrieve token directly
        let token: string | null = null
        for (let i = 0; i < 30; i++) {
          try {
            token = await (window as any).Clerk?.session?.getToken()
            if (token) break
          } catch (e) {}
          await new Promise((resolve) => setTimeout(resolve, 100))
        }

        const clerkUserObj = (window as any).Clerk?.user || (signInAttempt as any)?.userData
        const role = (clerkUserObj?.publicMetadata?.role as string) || (clerkUserObj?.unsafeMetadata?.role as string) || 'user'
        const fullName = `${clerkUserObj?.firstName || ''} ${clerkUserObj?.lastName || ''}`.trim() || 'User'
        
        let authenticatedUser = {
          id: clerkUserObj?.id || signInAttempt.createdSessionId,
          email: email.trim(),
          full_name: fullName,
          role: role
        }

        if (token) {
          try {
            let apiBase = (import.meta.env.VITE_API_URL || (import.meta.env.DEV ? '/api' : 'http://localhost:8000/api')).replace(/\/+$/, '')
            if (!apiBase.endsWith('/api') && !apiBase.includes('/api')) {
              apiBase = `${apiBase}/api`
            }
            const res = await fetch(`${apiBase}/users/me`, {
              headers: { Authorization: `Bearer ${token}` }
            })
            if (res.ok) {
              const backendUser = await res.json()
              authenticatedUser = {
                id: backendUser.id || authenticatedUser.id,
                email: backendUser.email || authenticatedUser.email,
                full_name: backendUser.full_name || authenticatedUser.full_name,
                role: backendUser.role || authenticatedUser.role
              }
            }
          } catch (e) {
            console.warn('Backend user profile fetch failed, using Clerk metadata:', e)
          }
          useAuthStore.getState().setAuth(authenticatedUser, token)
        }

        showSuccess(`Welcome back, ${authenticatedUser.full_name}!`)
        setTimeout(() => {
          if (authenticatedUser.role === 'vendor') {
            window.location.href = '/vendor/dashboard'
          } else if (authenticatedUser.role === 'admin') {
            window.location.href = '/admin/dashboard'
          } else {
            window.location.href = '/dashboard'
          }
        }, 600)
        return
      }

      console.warn('[LOGIN] Unhandled signIn status:', signInAttempt?.status)
      showError('Login failed. Please check your credentials.')
      setError('Login failed. Please check your credentials.')
    } catch (err: unknown) {
      console.error('[LOGIN ERROR]', err)
      
      // If a session already exists in Clerk, activate it and redirect
      if ((err as any)?.errors?.[0]?.code === 'session_exists') {
        const activeSession = (window as any).Clerk?.session
        if (activeSession) {
          showSuccess('Already signed in. Redirecting...')
          const clerkUserObj = (window as any).Clerk?.user
          const role = (clerkUserObj?.publicMetadata?.role as string) || (clerkUserObj?.unsafeMetadata?.role as string) || 'user'
          setTimeout(() => {
            if (role === 'vendor') window.location.href = '/vendor/dashboard'
            else if (role === 'admin') window.location.href = '/admin/dashboard'
            else window.location.href = '/dashboard'
          }, 500)
          return
        }
      }

      const clerkError = getClerkErrorMessage(err, '')
      const errorMsg = clerkError || backendErrorMessage || 'Login failed. Please check your credentials.'
      showError(errorMsg)
      setError(errorMsg)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Second Factor Verification View
  if (pendingSecondFactor) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50/30 to-red-50/20 flex items-center justify-center py-6 sm:py-12 px-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-xl p-6 sm:p-8 border-2 border-rose-100 hover:border-primary-200 transition-all duration-300">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Two-Factor Authentication</h2>
            <p className="text-gray-600 text-sm">
              We sent a verification code to <span className="font-semibold text-gray-900">{secondFactorTarget || email}</span>. Enter it below to complete your login.
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border-2 border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleVerifySecondFactor} className="space-y-4 sm:space-y-5">
            <div>
              <label className="block text-gray-700 font-medium mb-2 text-sm sm:text-base">Verification Code</label>
              <input
                type="text"
                value={secondFactorCode}
                onChange={(e) => {
                  setSecondFactorCode(e.target.value)
                  setError('')
                }}
                className="w-full px-3 sm:px-4 py-2.5 sm:py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-300 text-center text-xl tracking-widest font-mono"
                placeholder="123456"
                required
                maxLength={6}
                autoFocus
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !secondFactorCode.trim()}
              className="w-full bg-gradient-to-r from-primary-600 via-accent-600 to-primary-600 hover:from-primary-700 hover:via-accent-700 hover:to-primary-700 text-white py-2.5 sm:py-3 rounded-lg font-semibold transition-all duration-300 shadow-lg hover:shadow-xl hover:shadow-primary-600/50 transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none text-sm sm:text-base"
            >
              {isSubmitting ? 'Verifying...' : 'Verify & Login'}
            </button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => {
                  setPendingSecondFactor(false)
                  setSecondFactorCode('')
                  setError('')
                }}
                className="text-sm text-gray-500 hover:text-gray-700 underline"
              >
                Back to login
              </button>
            </div>
          </form>
        </div>
      </div>
    )
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
              className={`w-full px-3 sm:px-4 py-2.5 sm:py-3 border-2 rounded-lg focus:outline-none focus:ring-2 transition-all duration-300 text-sm sm:text-base ${emailError
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

