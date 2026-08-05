import api from './api'



export interface DashboardStats {
    pendingApprovals: number
    flaggedReviews: number
    activeUsers: number
}

export interface User {
    id: string
    full_name: string
    email: string
    role: string
    is_active: boolean
    created_at: string
}

export const adminService = {
    // Get dashboard statistics
    async getDashboardStats(): Promise<DashboardStats> {
        const { data } = await api.get<DashboardStats>('/admin/stats')
        return data
    },

    // Get all users
    async getAllUsers(): Promise<User[]> {
        const { data } = await api.get<User[]>('/admin/users')
        return data
    },

    // Toggle user active status
    async toggleUserActive(userId: string): Promise<void> {
        await api.post(`/admin/users/${userId}/toggle-active`)
    },

    // Get all vendors (with optional status filter)
    async getAllVendors(status?: string) {
        const params = status ? { status } : {}
        const { data } = await api.get('/admin/vendors', { params })
        return data
    },

    // Approve vendor
    async approveVendor(vendorId: string) {
        const { data } = await api.post(`/admin/vendors/${vendorId}/approve`)
        return data
    },

    // Reject vendor
    async rejectVendor(vendorId: string) {
        const { data } = await api.post(`/admin/vendors/${vendorId}/reject`)
        return data
    },

    // Create vendor (admin)
    async createVendor(vendorData: any) {
        const { data } = await api.post('/admin/vendors/create', vendorData)
        return data
    }
}

export default adminService
