import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import Layout from './components/Layout'
import HomePage from './pages/HomePage'
import LoginPage from './pages/auth/LoginPage'
import AdminLoginPage from './pages/auth/AdminLoginPage'
import RegisterPage from './pages/auth/RegisterPage'
import VendorRegisterPage from './pages/auth/VendorRegisterPage'
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage'
import ResetPasswordPage from './pages/auth/ResetPasswordPage'
import BrowseVendorsPage from './pages/vendors/BrowseVendorsPage'
import VendorProfilePage from './pages/vendors/VendorProfilePage'
import UserDashboard from './pages/user/UserDashboard'
import VendorDashboard from './pages/vendor/VendorDashboard'
import VendorBookingsPage from './pages/vendor/VendorBookingsPage'
import VendorManageProfilePage from './pages/vendor/VendorProfilePage'
import VendorPackagesPage from './pages/vendor/VendorPackagesPage'
import VendorReviewsPage from './pages/vendor/VendorReviewsPage'
import AdminDashboard from './pages/admin/AdminDashboard'
import AddVendorPage from './pages/admin/AddVendorPage'
import LogoutPage from './pages/LogoutPage'
import VendorApprovalsPage from './pages/admin/VendorApprovalsPage'
import UserManagementPage from './pages/admin/UserManagementPage'
import ReviewModerationPage from './pages/admin/ReviewModerationPage'
import AdminApprovalsPage from './pages/admin/AdminApprovalsPage'
import BookingPage from './pages/bookings/BookingPage'
import BookingHistoryPage from './pages/bookings/BookingHistoryPage'
import BudgetPlannerPage from './pages/BudgetPlannerPage'
import ChecklistPage from './pages/ChecklistPage'
import FavoritesPage from './pages/FavoritesPage'
import UserReviewsPage from './pages/UserReviewsPage'
import ContactPage from './pages/ContactPage'
import AboutPage from './pages/AboutPage'
import MessagesPage from './pages/chat/MessagesPage'

import ClerkSessionSync from './components/ClerkSessionSync'

const queryClient = new QueryClient()

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ClerkSessionSync />
      <Toaster
        position="top-right"
        containerStyle={{
          zIndex: 9999,
        }}
        toastOptions={{
          duration: 4000,
          style: {
            background: '#fff',
            color: '#333',
            padding: '16px',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            zIndex: 9999,
          },
          success: {
            iconTheme: {
              primary: '#10B981',
              secondary: '#fff',
            },
            duration: 4000,
          },
          error: {
            iconTheme: {
              primary: '#EF4444',
              secondary: '#fff',
            },
            duration: 5000,
          },
        }}
      />
      <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Layout>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/admin/login" element={<AdminLoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/vendor/register" element={<VendorRegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/vendors" element={<BrowseVendorsPage />} />
            <Route path="/services" element={<BookingPage />} />
            <Route path="/vendors/:id" element={<VendorProfilePage />} />
            <Route path="/dashboard" element={<UserDashboard />} />
            <Route path="/vendor/dashboard" element={<VendorDashboard />} />
            <Route path="/vendor/bookings" element={<VendorBookingsPage />} />
            <Route path="/vendor/profile" element={<VendorManageProfilePage />} />
            <Route path="/vendor/packages" element={<VendorPackagesPage />} />
            <Route path="/vendor/reviews" element={<VendorReviewsPage />} />
            <Route path="/vendor/messages" element={<MessagesPage />} />
            <Route path="/admin/dashboard" element={<AdminDashboard />} />
            <Route path="/admin/vendors/add" element={<AddVendorPage />} />
            <Route path="/admin/vendors" element={<VendorApprovalsPage />} />
            <Route path="/admin/users" element={<UserManagementPage />} />
            <Route path="/admin/reviews" element={<ReviewModerationPage />} />
            <Route path="/admin/admin-approvals" element={<AdminApprovalsPage />} />
            <Route path="/bookings/new" element={<BookingPage />} />
            <Route path="/bookings/history" element={<BookingHistoryPage />} />
            <Route path="/budget-planner" element={<BudgetPlannerPage />} />
            <Route path="/checklist" element={<ChecklistPage />} />
            <Route path="/favorites" element={<FavoritesPage />} />
            <Route path="/messages" element={<MessagesPage />} />
            <Route path="/reviews" element={<UserReviewsPage />} />
            <Route path="/logout" element={<LogoutPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/about" element={<AboutPage />} />
          </Routes>
        </Layout>
      </Router>
    </QueryClientProvider>
  )
}

export default App

