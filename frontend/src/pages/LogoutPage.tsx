import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useClerk } from '@clerk/clerk-react'
import { useAuthStore } from '../store/authStore'

export default function LogoutPage() {
  const navigate = useNavigate()
  const clerk = useClerk()
  const logout = useAuthStore((state) => state.logout)

  useEffect(() => {
    const performLogout = async () => {
      try {
        if (clerk?.signOut) await clerk.signOut()
      } catch (err) {
        console.warn('[LogoutPage] Clerk sign-out failed:', err)
      } finally {
        logout()
        navigate('/')
      }
    }

    performLogout()
  }, [clerk, logout, navigate])

  return null
}
