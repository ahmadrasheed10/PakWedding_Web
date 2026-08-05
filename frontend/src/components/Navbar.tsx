import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useState } from 'react'
import { showSuccess } from '../utils/toast'
import { useClerk } from '@clerk/clerk-react'

export default function Navbar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const clerk = useClerk()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const isActive = (path: string) => location.pathname === path

  const handleLogout = async () => {
    try {
      if (clerk?.signOut) await clerk.signOut()
    } catch (err) {
      console.warn('[Navbar] Clerk sign-out failed, clearing local session anyway:', err)
    } finally {
      logout()
      showSuccess('Logged out successfully. See you soon!')
      navigate('/')
      setMobileMenuOpen(false)
    }
  }

  return (
    <nav className="bg-white border-b border-[#D72626]/20 shadow-sm sticky top-0 z-50">
      <div className="container mx-auto px-3 sm:px-4 md:px-6 lg:px-10 py-3 sm:py-4">
        <div className="flex items-center justify-between gap-2 sm:gap-4">
        {/* Logo */}
        <Link
          to="/"
          className="flex items-center gap-1 sm:gap-2 group flex-shrink-0 min-w-0"
        >
          <span className="text-lg sm:text-xl md:text-2xl group-hover:scale-110 transition-transform flex-shrink-0">💍</span>
          <span className="text-base sm:text-lg md:text-xl lg:text-2xl font-bold text-[#D72626] tracking-tight truncate">
            PakWedding
          </span>
        </Link>

        {/* Desktop Links */}
        <ul className="hidden lg:flex items-center gap-4 xl:gap-6 text-[#2A2A2A] font-medium text-sm xl:text-base flex-shrink-0">
          <li>
            <Link
              to="/"
              className={`relative transition-all duration-300 font-medium ${isActive('/') ? 'text-[#D72626] border-b-2 border-[#D72626] pb-1' : 'hover:text-[#D72626] hover:border-b-2 hover:border-[#D72626]/50 pb-1'}`}
            >
              Home
            </Link>
          </li>
          <li>
            <Link
              to="/vendors"
              className={`relative transition-all duration-300 font-medium ${isActive('/vendors') ? 'text-[#D72626] border-b-2 border-[#D72626] pb-1' : 'hover:text-[#D72626] hover:border-b-2 hover:border-[#D72626]/50 pb-1'}`}
            >
              Vendors
            </Link>
          </li>
          <li>
            <Link
              to="/budget-planner"
              className={`relative transition-all duration-300 font-medium ${isActive('/budget-planner') ? 'text-[#D72626] border-b-2 border-[#D72626] pb-1' : 'hover:text-[#D72626] hover:border-b-2 hover:border-[#D72626]/50 pb-1'}`}
            >
              Budget Planner
            </Link>
          </li>
          <li>
            <Link
              to="/about"
              className={`relative transition-all duration-300 font-medium ${isActive('/about') ? 'text-[#D72626] border-b-2 border-[#D72626] pb-1' : 'hover:text-[#D72626] hover:border-b-2 hover:border-[#D72626]/50 pb-1'}`}
            >
              About
            </Link>
          </li>
          <li>
            <Link
              to="/contact"
              className={`relative transition-all duration-300 font-medium ${isActive('/contact') ? 'text-[#D72626] border-b-2 border-[#D72626] pb-1' : 'hover:text-[#D72626] hover:border-b-2 hover:border-[#D72626]/50 pb-1'}`}
            >
              Contact
            </Link>
          </li>
        </ul>

        {/* Desktop Buttons */}
        <div className="hidden lg:flex items-center gap-2 xl:gap-3 flex-shrink-0">
          {user ? (
            <>
              <span className="text-[#2A2A2A] text-xs xl:text-sm font-medium hidden xl:inline truncate max-w-[120px]">{user.full_name}</span>
              <Link
                to={user.role === 'vendor' ? '/vendor/dashboard' : user.role === 'admin' ? '/admin/dashboard' : '/dashboard'}
                className="text-[#D72626] hover:text-[#F26D46] font-semibold text-xs xl:text-sm transition-all duration-300 hover:underline hover:underline-offset-4 whitespace-nowrap"
              >
                Dashboard
              </Link>
              <button
                onClick={handleLogout}
                className="px-3 xl:px-4 py-1.5 xl:py-2 rounded-xl text-white text-xs xl:text-sm font-semibold bg-gradient-to-r from-[#D72626] via-[#F26D46] to-[#F7A76C] hover:opacity-90 transition-all shadow-md hover:shadow-lg whitespace-nowrap"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="px-3 xl:px-4 py-1.5 xl:py-2 rounded-xl text-[#D72626] text-xs xl:text-sm font-semibold border-2 border-[#D72626] hover:bg-[#FEECEC] transition-all whitespace-nowrap"
              >
                Login
              </Link>
              <Link
                to="/register"
                className="px-3 xl:px-4 py-1.5 xl:py-2 rounded-xl text-white text-xs xl:text-sm font-semibold bg-gradient-to-r from-[#D72626] via-[#F26D46] to-[#F7A76C] hover:opacity-90 transition-all shadow-md hover:shadow-lg whitespace-nowrap"
              >
                Sign Up
              </Link>
            </>
          )}
        </div>

        {/* Tablet/Mobile Menu Button */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="lg:hidden p-2 rounded-lg text-[#D72626] hover:bg-[#FEECEC] transition-all flex-shrink-0"
          aria-label="Toggle menu"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {mobileMenuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-[#D72626]/20 bg-white">
          <ul className="px-4 py-4 space-y-3">
            <li>
              <Link
                to="/"
                onClick={() => setMobileMenuOpen(false)}
                className={`block py-2 text-[#2A2A2A] font-medium ${isActive('/') ? 'text-[#D72626]' : 'hover:text-[#D72626]'}`}
              >
                Home
              </Link>
            </li>
            <li>
              <Link
                to="/vendors"
                onClick={() => setMobileMenuOpen(false)}
                className={`block py-2 text-[#2A2A2A] font-medium ${isActive('/vendors') ? 'text-[#D72626]' : 'hover:text-[#D72626]'}`}
              >
                Vendors
              </Link>
            </li>
            <li>
              <Link
                to="/budget-planner"
                onClick={() => setMobileMenuOpen(false)}
                className={`block py-2 text-[#2A2A2A] font-medium ${isActive('/budget-planner') ? 'text-[#D72626]' : 'hover:text-[#D72626]'}`}
              >
                Budget Planner
              </Link>
            </li>
            <li>
              <Link
                to="/about"
                onClick={() => setMobileMenuOpen(false)}
                className={`block py-2 text-[#2A2A2A] font-medium ${isActive('/about') ? 'text-[#D72626]' : 'hover:text-[#D72626]'}`}
              >
                About
              </Link>
            </li>
            <li>
              <Link
                to="/contact"
                onClick={() => setMobileMenuOpen(false)}
                className={`block py-2 text-[#2A2A2A] font-medium ${isActive('/contact') ? 'text-[#D72626]' : 'hover:text-[#D72626]'}`}
              >
                Contact
              </Link>
            </li>
            <li className="pt-4 border-t border-gray-200">
              {user ? (
                <div className="space-y-3">
                  <div className="text-sm text-gray-600 font-medium">{user.full_name}</div>
                  <Link
                    to={user.role === 'vendor' ? '/vendor/dashboard' : user.role === 'admin' ? '/admin/dashboard' : '/dashboard'}
                    onClick={() => setMobileMenuOpen(false)}
                    className="block py-2 text-[#D72626] font-semibold"
                  >
                    Dashboard
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="w-full py-2 rounded-xl text-white font-semibold bg-gradient-to-r from-[#D72626] via-[#F26D46] to-[#F7A76C] hover:opacity-90 transition-all shadow-md"
                  >
                    Logout
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <Link
                    to="/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="block py-2 text-center rounded-xl text-[#D72626] font-semibold border-2 border-[#D72626] hover:bg-[#FEECEC] transition-all"
                  >
                    Login
                  </Link>
                  <Link
                    to="/register"
                    onClick={() => setMobileMenuOpen(false)}
                    className="block py-2 text-center rounded-xl text-white font-semibold bg-gradient-to-r from-[#D72626] via-[#F26D46] to-[#F7A76C] hover:opacity-90 transition-all shadow-md"
                  >
                    Sign Up
                  </Link>
                </div>
              )}
            </li>
          </ul>
        </div>
      )}
    </nav>
  )
}