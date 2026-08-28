import api from './api'

export type BookingStatus = 'pending' | 'approved' | 'rejected' | 'confirmed' | 'cancelled' | 'completed'

export type TimeSlot = '1-4' | '7-10'

export interface BookedSlot {
  slot: TimeSlot
  status: BookingStatus
  booking_id?: string
}

export interface VendorAvailability {
  vendor_id: string
  year: number
  month: number
  booked_dates: Record<string, BookedSlot[]>
}

export type Booking = {
  id: string
  _id?: string
  user_id: string
  vendor_id: string
  service_id?: string
  package_name?: string
  event_date: string
  time_slot?: TimeSlot
  event_location: string
  guest_count?: number
  special_requirements?: string
  total_amount: number
  status: BookingStatus
  created_at: string
}

export type BookingCreate = {
  vendor_id: string
  service_id?: string
  package_name?: string
  event_date: string
  time_slot?: TimeSlot
  event_location: string
  guest_count?: number
  special_requirements?: string
  total_amount: number
}

export async function createBooking(bookingData: BookingCreate) {
  const { data } = await api.post<Booking>('/bookings/', bookingData)
  return data
}

export async function getVendorAvailability(vendorId: string, year?: number, month?: number) {
  const params: Record<string, number> = {}
  if (year) params.year = year
  if (month) params.month = month
  const { data } = await api.get<VendorAvailability>(`/bookings/vendor/${vendorId}/availability`, { params })
  return data
}

export async function getUserBookings() {
  const { data } = await api.get<Booking[]>('/bookings/my-bookings')
  return data
}

export async function getVendorBookings(status?: string) {
  const params = status ? { status } : undefined
  const { data } = await api.get<Booking[]>('/vendor/bookings', { params })
  return data
}

export async function approveBooking(bookingId: string) {
  const { data } = await api.post<Booking>(`/vendor/bookings/${bookingId}/approve`)
  return data
}

export async function rejectBooking(bookingId: string) {
  const { data } = await api.post<Booking>(`/vendor/bookings/${bookingId}/reject`)
  return data
}


