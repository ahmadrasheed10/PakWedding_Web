import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import api from '../services/api'
import Sidebar from '../components/Sidebar'

interface ChecklistItem {
  id: string
  title: string
  category: string
  description?: string
  due_date?: string
  priority: 'low' | 'medium' | 'high'
  estimated_cost?: number
  is_completed: boolean
  completed_at?: string
  created_at: string
}

interface ChecklistStats {
  total: number
  completed: number
  remaining: number
  completion_percentage: number
}

const CATEGORIES = [
  { value: '', label: 'All Categories' },
  { value: 'venue', label: 'Venue' },
  { value: 'catering', label: 'Catering' },
  { value: 'photography', label: 'Photography' },
  { value: 'decoration', label: 'Decoration' },
  { value: 'entertainment', label: 'Entertainment' },
  { value: 'attire', label: 'Attire' },
  { value: 'invitations', label: 'Invitations' },
  { value: 'transportation', label: 'Transportation' },
  { value: 'other', label: 'Other' }
]

const PRIORITY_COLORS = {
  low: 'bg-green-100 text-green-800 border-green-300',
  medium: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  high: 'bg-red-100 text-red-800 border-red-300'
}

export default function ChecklistPage() {
  const { user, token } = useAuthStore()
  const [items, setItems] = useState<ChecklistItem[]>([])
  const [stats, setStats] = useState<ChecklistStats>({ total: 0, completed: 0, remaining: 0, completion_percentage: 0 })
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingItem, setEditingItem] = useState<ChecklistItem | null>(null)

  const sidebarItems = [
    { path: '/dashboard', label: 'Dashboard', icon: '📊' },
    { path: '/vendors', label: 'Find Vendors', icon: '🔍' },
    { path: '/bookings/history', label: 'My Bookings', icon: '📅' },
    { path: '/budget-planner', label: 'Budget Planner', icon: '💰' },
    { path: '/checklist', label: 'Checklist', icon: '✅' },
    { path: '/favorites', label: 'Favorites', icon: '❤️' },
    { path: '/reviews', label: 'My Reviews', icon: '⭐' },
  ]
  
  const [formData, setFormData] = useState({
    title: '',
    category: 'other' as string,
    description: '',
    due_date: '',
    priority: 'medium' as 'low' | 'medium' | 'high',
    estimated_cost: ''
  })

  useEffect(() => {
    // Wait for auth store to hydrate from localStorage
    const checkAndLoad = async () => {
      if (!user) {
        setLoading(false)
        return
      }
      
      // Check token from store
      let currentToken = token || useAuthStore.getState().token
      
      // If no token, wait for Zustand persist to hydrate (up to 1 second)
      if (!currentToken) {
        for (let i = 0; i < 10; i++) {
          await new Promise(resolve => setTimeout(resolve, 100))
          currentToken = useAuthStore.getState().token
          if (currentToken) break
        }
      }
      
      if (currentToken) {
        await loadChecklist()
        await loadStats()
      } else {
        console.warn('Token not available - user may need to log in')
        setLoading(false)
      }
    }
    
    checkAndLoad()
  }, [user, token, selectedCategory])

  const loadChecklist = async () => {
    try {
      setLoading(true)
      const currentToken = useAuthStore.getState().token
      if (!currentToken) {
        console.warn('No authentication token found - skipping load')
        setItems([])
        setLoading(false)
        return
      }
      const params: any = {}
      if (selectedCategory) {
        params.category = selectedCategory
      }
      // Use trailing slash to avoid FastAPI redirect issues
      const response = await api.get('/checklist/', { params })
      setItems(response.data || [])
    } catch (error: any) {
      console.error('Error loading checklist:', error)
      console.error('Error details:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        url: error.config?.url,
        headers: error.config?.headers
      })
      
      if (error.response?.status === 401) {
        // Check if we actually sent a token (not just a hydration issue)
        const sentToken = useAuthStore.getState().token
        console.log('Token check:', {
          hasToken: !!sentToken,
          tokenPreview: sentToken ? sentToken.substring(0, 30) + '...' : 'none',
          authHeader: error.config?.headers?.Authorization ? 'present' : 'missing'
        })
        
        if (sentToken) {
          // Token was sent but rejected - check error details
          const errorDetail = error.response?.data?.detail || 'Unknown error'
          console.error('Token was sent but rejected. Error detail:', errorDetail)
          
          // Only redirect if it's actually a credentials error, not a different 401
          if (errorDetail.includes('credentials') || errorDetail.includes('expired') || errorDetail.includes('invalid')) {
            if (!window.location.href.includes('/login')) {
              alert('Your session has expired. Please log in again to access your checklist.')
              window.location.href = '/login'
            }
          } else {
            console.warn('401 error but not a credentials issue:', errorDetail)
          }
        } else {
          // No token was sent - might be hydration issue, don't redirect
          console.warn('401 error but no token was sent - may be hydration issue')
        }
      }
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  const loadStats = async () => {
    try {
      const token = useAuthStore.getState().token
      if (!token) {
        console.warn('No authentication token found - skipping stats load')
        return
      }
      const response = await api.get('/checklist/stats')
      setStats(response.data)
    } catch (error: any) {
      console.error('Error loading stats:', error)
      if (error.response?.status === 401) {
        console.warn('Stats load failed with 401 - token may be expired')
        // Don't redirect here, let loadChecklist handle it
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const token = useAuthStore.getState().token
      if (!token) {
        alert('Your session has expired. Please log in again.')
        window.location.href = '/login'
        return
      }
      
      const payload: any = {
        title: formData.title,
        category: formData.category,
        priority: formData.priority
      }
      
      if (formData.description) payload.description = formData.description
      if (formData.due_date) payload.due_date = new Date(formData.due_date).toISOString()
      if (formData.estimated_cost) payload.estimated_cost = parseFloat(formData.estimated_cost)

      if (editingItem) {
        await api.put(`/checklist/${editingItem.id}`, payload)
      } else {
        await api.post('/checklist', payload)
      }
      
      resetForm()
      loadChecklist()
      loadStats()
    } catch (error: any) {
      if (error.response?.status === 401) {
        alert('Your session has expired. Please log in again.')
        window.location.href = '/login'
      } else {
        alert(error.response?.data?.detail || 'Failed to save checklist item')
      }
    }
  }

  const handleToggleComplete = async (item: ChecklistItem) => {
    try {
      await api.put(`/checklist/${item.id}`, { is_completed: !item.is_completed })
      loadChecklist()
      loadStats()
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Failed to update checklist item')
    }
  }

  const handleDelete = async (itemId: string) => {
    if (!confirm('Are you sure you want to delete this item?')) return
    
    try {
      await api.delete(`/checklist/${itemId}`)
      loadChecklist()
      loadStats()
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Failed to delete checklist item')
    }
  }

  const handleEdit = (item: ChecklistItem) => {
    setEditingItem(item)
    setFormData({
      title: item.title,
      category: item.category,
      description: item.description || '',
      due_date: item.due_date ? new Date(item.due_date).toISOString().split('T')[0] : '',
      priority: item.priority,
      estimated_cost: item.estimated_cost?.toString() || ''
    })
    setShowAddForm(true)
  }

  const resetForm = () => {
    setFormData({
      title: '',
      category: 'other',
      description: '',
      due_date: '',
      priority: 'medium',
      estimated_cost: ''
    })
    setEditingItem(null)
    setShowAddForm(false)
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 via-orange-50/30 to-red-50/20">
        <div className="text-center">
          <p className="text-xl text-gray-600 mb-4">Please log in to access your checklist</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-amber-50 via-orange-50/30 to-red-50/20">
      <Sidebar items={sidebarItems} title="User Dashboard" />
      <div className="flex-1 flex flex-col overflow-y-auto pt-16 lg:pt-0">
        <div className="py-6 sm:py-8 px-4 sm:px-6">
          <div className="container mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-6 sm:mb-8 space-y-2">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 text-[#D72626] hover:text-[#F26D46] font-semibold transition-colors w-fit"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Dashboard
          </Link>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold bg-gradient-to-r from-primary-600 via-accent-600 to-primary-600 bg-clip-text text-transparent mb-2 leading-normal pb-2">
            Wedding Checklist
          </h1>
          <p className="text-sm sm:text-base text-gray-600">Stay organized and track your wedding planning progress</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-primary-100">
            <div className="text-3xl font-bold text-primary-600 mb-1">{stats.total}</div>
            <div className="text-sm text-gray-600 font-medium">Total Items</div>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-primary-100">
            <div className="text-3xl font-bold text-primary-600 mb-1">{stats.completed}</div>
            <div className="text-sm text-gray-600 font-medium">Completed</div>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-yellow-100">
            <div className="text-3xl font-bold text-yellow-600 mb-1">{stats.remaining}</div>
            <div className="text-sm text-gray-600 font-medium">Remaining</div>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-accent-100">
            <div className="text-3xl font-bold text-accent-600 mb-1">{stats.completion_percentage}%</div>
            <div className="text-sm text-gray-600 font-medium">Progress</div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6 border-2 border-primary-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-gray-700">Overall Progress</span>
            <span className="text-sm font-bold text-primary-600">{stats.completion_percentage}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
            <div 
              className="bg-gradient-to-r from-primary-600 via-accent-600 to-primary-600 h-4 rounded-full transition-all duration-500"
              style={{ width: `${stats.completion_percentage}%` }}
            ></div>
          </div>
        </div>

        {/* Filters and Add Button */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="flex-1 h-12 px-4 rounded-lg border-2 border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-primary-600 bg-white"
          >
            {CATEGORIES.map(cat => (
              <option key={cat.value} value={cat.value}>{cat.label}</option>
            ))}
          </select>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="bg-gradient-to-r from-primary-600 via-accent-600 to-primary-600 hover:from-primary-700 hover:via-accent-700 hover:to-primary-700 text-white px-6 py-3 rounded-lg font-semibold transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
          >
            {showAddForm ? 'Cancel' : '+ Add Item'}
          </button>
        </div>

        {/* Add/Edit Form */}
        {showAddForm && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6 border-2 border-primary-100">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              {editingItem ? 'Edit Checklist Item' : 'Add New Checklist Item'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Title *</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-primary-600"
                  required
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Category *</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-primary-600"
                    required
                  >
                    {CATEGORIES.filter(c => c.value).map(cat => (
                      <option key={cat.value} value={cat.value}>{cat.label}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Priority *</label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value as 'low' | 'medium' | 'high' })}
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-primary-600"
                    required
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-primary-600"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Due Date</label>
                  <input
                    type="date"
                    value={formData.due_date}
                    onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                    min={new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0]}
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-primary-600"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Estimated Cost (Rs.)</label>
                  <input
                    type="number"
                    value={formData.estimated_cost}
                    onChange={(e) => setFormData({ ...formData, estimated_cost: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-primary-600"
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  className="bg-gradient-to-r from-primary-600 via-accent-600 to-primary-600 hover:from-primary-700 hover:via-accent-700 hover:to-primary-700 text-white px-6 py-2 rounded-lg font-semibold transition-all duration-300 shadow-lg hover:shadow-xl"
                >
                  {editingItem ? 'Update Item' : 'Add Item'}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-6 py-2 rounded-lg font-semibold transition-all duration-300"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Checklist Items */}
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-primary-200 border-t-primary-600"></div>
            <p className="text-gray-600 mt-4">Loading checklist...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="bg-white rounded-xl shadow-lg p-12 text-center border-2 border-gray-100">
            <div className="text-6xl mb-4">📋</div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">No checklist items yet</h3>
            <p className="text-gray-600 mb-6">Start planning your wedding by adding your first checklist item!</p>
            <button
              onClick={() => setShowAddForm(true)}
              className="bg-gradient-to-r from-primary-600 via-accent-600 to-primary-600 hover:from-primary-700 hover:via-accent-700 hover:to-primary-700 text-white px-6 py-3 rounded-lg font-semibold transition-all duration-300 shadow-lg hover:shadow-xl"
            >
              Add Your First Item
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((item) => (
              <div
                key={item.id}
                className={`bg-white rounded-xl shadow-lg p-5 border-2 transition-all duration-300 hover:shadow-xl ${
                  item.is_completed 
                    ? 'border-primary-200 bg-primary-50/30' 
                    : 'border-gray-200 hover:border-primary-300'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3 flex-1">
                    <input
                      type="checkbox"
                      checked={item.is_completed}
                      onChange={() => handleToggleComplete(item)}
                      className="w-5 h-5 text-primary-600 rounded focus:ring-primary-500 cursor-pointer"
                    />
                    <h3 className={`font-bold text-lg flex-1 ${item.is_completed ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                      {item.title}
                    </h3>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(item)}
                      className="text-primary-600 hover:text-primary-700 transition-colors"
                      title="Edit"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="text-red-600 hover:text-red-700 transition-colors"
                      title="Delete"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold border ${PRIORITY_COLORS[item.priority]}`}>
                      {item.priority.toUpperCase()}
                    </span>
                    <span className="px-2 py-1 rounded-full text-xs font-semibold bg-primary-100 text-primary-700 border border-primary-300">
                      {CATEGORIES.find(c => c.value === item.category)?.label || item.category}
                    </span>
                  </div>
                  
                  {item.description && (
                    <p className="text-sm text-gray-600">{item.description}</p>
                  )}
                  
                  {item.due_date && (
                    <p className="text-xs text-gray-500">
                      📅 Due: {new Date(item.due_date).toLocaleDateString()}
                    </p>
                  )}
                  
                  {item.estimated_cost && (
                    <p className="text-sm font-semibold text-primary-600">
                      💰 Rs. {item.estimated_cost.toLocaleString()}
                    </p>
                  )}
                  
                  {item.is_completed && item.completed_at && (
                    <p className="text-xs text-primary-600">
                      ✅ Completed on {new Date(item.completed_at).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
          </div>
        </div>
      </div>
    </div>
  )
}

