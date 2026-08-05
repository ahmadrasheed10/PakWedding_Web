import axios from 'axios'
import { useAuthStore } from '../store/authStore'

// Use proxy in development, direct URL in production
const getBaseURL = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL
  }
  // In development, use proxy if available, otherwise direct URL
  if (import.meta.env.DEV) {
    return '/api' // Use Vite proxy
  }
  return 'http://localhost:8000/api'
}

const api = axios.create({
  baseURL: getBaseURL(),
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000, // 10 seconds timeout
})

// Add token to requests
api.interceptors.request.use((config) => {
  const authStore = useAuthStore.getState()
  
  // Check if session has expired
  if (authStore.checkSessionExpiry()) {
    // Session expired, redirect to login
    const currentPath = window.location.pathname
    const isOnLoginPage = currentPath === '/login' || currentPath === '/admin/login' || currentPath === '/register' || currentPath === '/vendor/register'
    if (!isOnLoginPage) {
      window.location.href = '/login'
    }
    return Promise.reject(new Error('Session expired'))
  }
  
  const token = authStore.token
  
  // Public endpoints that can be called without authentication.
  // Any other endpoint should receive the current token if available.
  const publicEndpoints = [
    '/auth/login',
    '/auth/register',
    '/auth/check-email',
    '/auth/forgot-password',
    '/auth/reset-password',
  ]
  
  const isPublicEndpoint = publicEndpoints.some(endpoint => {
    if (!config.url) return false
    return config.url === endpoint || config.url.startsWith(`${endpoint}/`)
  })
  
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
    if (config.url?.includes('/checklist')) {
      console.log('[API] Making checklist request with token:', token.substring(0, 20) + '...')
    }
  } else if (!isPublicEndpoint) {
    // Only warn for protected endpoints that require authentication
    console.warn('No token found in auth store for request:', config.url)
  }
  
  // Ensure trailing slash for POST requests to root endpoints to avoid redirect issues
  // FastAPI redirects /api/bookings to /api/bookings/, which loses Authorization header
  if (config.method === 'post' && config.url && 
      config.url.endsWith('/bookings') && 
      !config.url.endsWith('/')) {
    config.url = config.url + '/'
  }
  
  // Ensure trailing slash for POST requests to checklist endpoint
  if (config.method === 'post' && config.url && 
      config.url.endsWith('/checklist') && 
      !config.url.endsWith('/')) {
    config.url = config.url + '/'
  }
  
  // Ensure trailing slash for GET requests to checklist endpoint (FastAPI may redirect)
  if (config.method === 'get' && config.url && 
      config.url === '/checklist' && 
      !config.url.endsWith('/')) {
    config.url = config.url + '/'
  }
  
  // Ensure trailing slash for POST requests to favorites endpoint (FastAPI may redirect)
  if (config.method === 'post' && config.url && 
      config.url.endsWith('/favorites') && 
      !config.url.endsWith('/')) {
    config.url = config.url + '/'
  }
  
  // Ensure trailing slash for GET requests to favorites endpoint (FastAPI may redirect)
  if (config.method === 'get' && config.url && 
      config.url === '/favorites' && 
      !config.url.endsWith('/')) {
    config.url = config.url + '/'
  }
  
  return config
})

// Handle 401 errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const currentPath = window.location.pathname
      const requestUrl = error.config?.url || ''
      const token = useAuthStore.getState().token
      
      // Don't logout if:
      // 1. Already on login/register pages
      // 2. Error is from auth endpoints (login, register, etc.)
      // 3. Error is from booking endpoints (let component handle it)
      // 4. Error is from checklist endpoints (let component handle it)
      // 5. Error is from favorites/reviews endpoints (let component handle it)
      // 6. Error is from admin endpoints (let component handle it)
      // 7. No token exists (user not logged in, so no need to logout)
      const isAuthEndpoint = requestUrl.includes('/auth/')
      const isBookingError = requestUrl.includes('/bookings')
      const isChecklistError = requestUrl.includes('/checklist')
      const isFavoritesError = requestUrl.includes('/favorites')
      const isReviewsError = requestUrl.includes('/reviews')
      const isAdminError = requestUrl.includes('/admin/')
      const isVendorsError = requestUrl.includes('/vendors/')
      const isUsersError = requestUrl.includes('/users/')
      const isOnLoginPage = currentPath === '/login' || currentPath === '/admin/login' || currentPath === '/register' || currentPath === '/vendor/register'
      
      // Only logout if we have a token (user was logged in) and it's not an expected error
      if (token && !isOnLoginPage && !isAuthEndpoint && !isBookingError && !isChecklistError && !isFavoritesError && !isReviewsError && !isAdminError && !isVendorsError && !isUsersError) {
        window.location.href = '/logout'
      }
    }
    return Promise.reject(error)
  }
)

export default api

