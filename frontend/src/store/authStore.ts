import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

interface User {
  id: string
  email: string
  full_name: string
  role: string
}

interface AuthState {
  user: User | null
  token: string | null
  loginTime: number | null
  setAuth: (user: User, token: string) => void
  logout: () => void
  checkSessionExpiry: () => boolean
}

// Session timeout: 2 hours (in milliseconds)
const SESSION_TIMEOUT = 2 * 60 * 60 * 1000

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      loginTime: null,
      setAuth: (user, token) => {
        set({ 
          user, 
          token, 
          loginTime: Date.now() 
        })
      },
      logout: () => {
        set({ user: null, token: null, loginTime: null })
      },
      checkSessionExpiry: () => {
        const loginTime = get().loginTime
        if (!loginTime) return false

        const expired = Date.now() - loginTime > SESSION_TIMEOUT
        if (expired) {
          set({ user: null, token: null, loginTime: null })
        }
        return expired
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => localStorage), // Use localStorage for persistent login
    }
  )
)

