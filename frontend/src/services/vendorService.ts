import api from './api'

export type Package = {
  name: string
  price: number
  description?: string
  features?: string[]
}

export type Vendor = {
  _id?: string
  id?: string
  business_name: string
  contact_person: string
  email: string
  phone_number: string
  business_address: string
  service_category: string
  rating?: number
  total_bookings?: number
  pending_requests?: number
  total_revenue?: number
  image_url?: string
  gallery_images?: string[]
  description?: string
  packages?: Package[]
  is_approved?: boolean
  is_active?: boolean
  created_at?: string
  // Map / location fields
  latitude?: number | null
  longitude?: number | null
  location_address?: string | null
}

export async function fetchVendors(category?: string, limit: number = 200) {
  const params: any = { limit }
  if (category) {
    params.category = category
  }
  const { data } = await api.get<Vendor[]>('/vendors', { params })
  return data
}

export async function fetchVendorById(id: string) {
  const { data } = await api.get<Vendor>(`/vendors/${id}`)
  return data
}

export async function getVendorProfile() {
  const { data } = await api.get<Vendor>('/vendors/me')
  return data
}

export async function updateVendorProfile(vendorData: Partial<Vendor>) {
  const { data } = await api.put<Vendor>('/vendors/me', vendorData)
  return data
}

export async function updateVendorPackages(packages: Package[]) {
  const { data } = await api.put<Vendor>('/vendors/me', { packages })
  return data
}


