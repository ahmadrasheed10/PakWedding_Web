import { useState, useRef, useEffect } from 'react'
import api from '../services/api'
import { useAuthStore } from '../store/authStore'

interface Message {
  role: 'user' | 'assistant'
  content: string
  vendors?: any[]
  collectedInfo?: any
}

interface ChatResponse {
  response: string
  type: string
  vendors?: any[]
  collected_info?: any
  expected_field?: string | null
  data?: any[]
  session_id?: string
}

// ─── Match Report Modal ───────────────────────────────────────────────────────

function ScoreBar({ score }: { score: number }) {
  const colour =
    score >= 80 ? '#16a34a' : score >= 60 ? '#d97706' : '#dc2626'
  return (
    <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
      <div
        className="h-2.5 rounded-full transition-all duration-700"
        style={{ width: `${score}%`, backgroundColor: colour }}
      />
    </div>
  )
}

function ScoreBadge({ score }: { score: number }) {
  if (score >= 80)
    return (
      <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-green-100 text-green-700">
        🎯 {score}%
      </span>
    )
  if (score >= 60)
    return (
      <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-yellow-100 text-yellow-700">
        🎯 {score}%
      </span>
    )
  return (
    <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-red-100 text-red-600">
      🎯 {score}%
    </span>
  )
}

function MatchReportModal({
  vendors,
  collectedInfo,
  onClose,
}: {
  vendors: any[]
  collectedInfo: any
  onClose: () => void
}) {
  const sorted = [...vendors].sort(
    (a, b) => (b.match_score ?? 0) - (a.match_score ?? 0)
  )

  const topScore = sorted[0]?.match_score ?? 0
  const avgScore =
    sorted.length > 0
      ? Math.round(
        sorted.reduce((s, v) => s + (v.match_score ?? 0), 0) / sorted.length
      )
      : 0

  const label = (field: string) => {
    const map: Record<string, string> = {
      category: 'Category',
      city: 'City',
      budget: 'Budget',
      location: 'Area',
      date: 'Event Date',
      min_rating: 'Min Rating',
    }
    return map[field] || field
  }

  const criteriaRows = Object.entries(collectedInfo ?? {})
    .filter(([k]) =>
      ['category', 'city', 'budget', 'location', 'date', 'min_rating'].includes(k)
    )
    .map(([k, v]) => {
      let display = ''
      if (k === 'city') display = Array.isArray(v) ? (v as string[]).join(', ') : String(v)
      else if (k === 'budget') display = v ? `PKR ${Number(v).toLocaleString()}` : 'Any'
      else if (k === 'min_rating') display = v ? `${v}+ stars` : 'Any'
      else display = v ? String(v) : 'Any'
      return { key: k, label: label(k), value: display }
    })

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-[#D72626] to-[#F26D46] px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-white font-bold text-lg">AI Match Score Report</h2>
            <p className="text-white/80 text-xs mt-0.5">
              {sorted.length} vendor{sorted.length !== 1 ? 's' : ''} evaluated · Top score {topScore}% · Average {avgScore}%
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 rounded-full p-1.5 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-6">

          {/* Search criteria */}
          {criteriaRows.length > 0 && (
            <section>
              <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-[#D72626]/10 text-[#D72626] flex items-center justify-center text-xs">🔍</span>
                Your Search Criteria
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {criteriaRows.map(row => (
                  <div key={row.key} className="bg-gray-50 rounded-lg px-3 py-2">
                    <p className="text-xs text-gray-400 font-medium">{row.label}</p>
                    <p className="text-sm font-semibold text-gray-800 truncate">{row.value}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Score overview bar chart */}
          <section>
            <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-[#D72626]/10 text-[#D72626] flex items-center justify-center text-xs">📊</span>
              Score Overview
            </h3>
            <div className="space-y-2.5">
              {sorted.map((vendor, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <div className="w-4 text-xs text-gray-400 font-bold text-right flex-shrink-0">
                    #{idx + 1}
                  </div>
                  <p className="text-xs font-semibold text-gray-700 w-32 truncate flex-shrink-0">
                    {vendor.business_name || 'Vendor'}
                  </p>
                  <div className="flex-1">
                    <ScoreBar score={vendor.match_score ?? 0} />
                  </div>
                  <ScoreBadge score={vendor.match_score ?? 0} />
                </div>
              ))}
            </div>
          </section>

          {/* Detailed per-vendor cards */}
          <section>
            <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-[#D72626]/10 text-[#D72626] flex items-center justify-center text-xs">📋</span>
              Detailed Breakdown
            </h3>
            <div className="space-y-3">
              {sorted.map((vendor, idx) => {
                const score = vendor.match_score ?? 0
                const borderColor =
                  score >= 80
                    ? 'border-green-200'
                    : score >= 60
                      ? 'border-yellow-200'
                      : 'border-red-200'
                const bgColor =
                  score >= 80
                    ? 'bg-green-50'
                    : score >= 60
                      ? 'bg-yellow-50'
                      : 'bg-red-50'

                return (
                  <div
                    key={idx}
                    className={`rounded-xl border-2 ${borderColor} overflow-hidden`}
                  >
                    {/* Card header */}
                    <div className={`${bgColor} px-4 py-3 flex items-center justify-between`}>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-400">#{idx + 1}</span>
                        <div>
                          <p className="text-sm font-bold text-gray-800 leading-tight">
                            {vendor.business_name || 'Vendor'}
                          </p>
                          <p className="text-xs text-gray-500">
                            {vendor.service_category} · {vendor.business_address}
                          </p>
                        </div>
                      </div>
                      <ScoreBadge score={score} />
                    </div>

                    {/* Card body */}
                    <div className="px-4 py-3 bg-white space-y-3">

                      {/* Score bar */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-gray-500">Requirement Match Score</span>
                          <span className="text-xs font-bold text-gray-700">{score}/100</span>
                        </div>
                        <ScoreBar score={score} />
                      </div>

                      {/* Match reason */}
                      {vendor.match_reason && vendor.match_reason !== 'Match score unavailable.' && (
                        <div className="flex items-start gap-2 bg-gray-50 rounded-lg px-3 py-2">
                          <span className="text-xs mt-0.5 flex-shrink-0">💬</span>
                          <p className="text-xs text-gray-600 leading-relaxed italic">
                            {vendor.match_reason}
                          </p>
                        </div>
                      )}

                      {/* Component Breakdown from match_report */}
                      {vendor.match_report && (() => {
                        const dimConfig: Record<string, { label: string; icon: string }> = {
                          budget: { label: 'Budget', icon: '💰' },
                          location: { label: 'Location', icon: '📍' },
                          rating: { label: 'Min Rating', icon: '⭐' },
                          availability: { label: 'Availability', icon: '📅' },
                        }
                        const dims = Object.entries(vendor.match_report as Record<string, any>).filter(
                          ([, d]) => d.weight > 0 || d.status === 'not_verified'
                        )
                        if (dims.length === 0) return null
                        return (
                          <div className="space-y-1.5">
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Requirement Breakdown</p>
                            {dims.map(([key, dim]) => {
                              const cfg = dimConfig[key] || { label: key, icon: '●' }
                              const dimScore: number | null = dim.score
                              const isActive = dim.weight > 0
                              const statusColors: Record<string, string> = {
                                met: 'text-green-600 bg-green-50 border-green-200',
                                not_specified: 'text-gray-400 bg-gray-50 border-gray-200',
                                not_verified: 'text-yellow-600 bg-yellow-50 border-yellow-200',
                                above_budget: 'text-red-600 bg-red-50 border-red-200',
                                slightly_above: 'text-orange-600 bg-orange-50 border-orange-200',
                                moderately_above: 'text-orange-600 bg-orange-50 border-orange-200',
                                significantly_above: 'text-red-600 bg-red-50 border-red-200',
                                unmatched: 'text-red-600 bg-red-50 border-red-200',
                                city_matched_area_unmatched: 'text-yellow-600 bg-yellow-50 border-yellow-200',
                                below_minimum: 'text-orange-600 bg-orange-50 border-orange-200',
                                unrated: 'text-gray-500 bg-gray-50 border-gray-200',
                                unspecified_pricing: 'text-gray-500 bg-gray-50 border-gray-200',
                                verified_available: 'text-green-600 bg-green-50 border-green-200',
                                unavailable: 'text-red-600 bg-red-50 border-red-200',
                              }
                              const colorClass = statusColors[dim.status] || 'text-gray-500 bg-gray-50 border-gray-200'
                              const checkIcon = !isActive ? '—' : dimScore === 100 ? '✓' : dimScore === null ? '?' : '~'
                              return (
                                <div key={key} className={`rounded-lg border px-3 py-2 flex items-start gap-2.5 ${colorClass}`}>
                                  <span className="text-sm flex-shrink-0">{cfg.icon}</span>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="text-xs font-bold">{cfg.label}</span>
                                      <div className="flex items-center gap-1.5 flex-shrink-0">
                                        {isActive && dimScore !== null && (
                                          <span className="text-xs font-bold">{dimScore}%</span>
                                        )}
                                        <span className={`text-xs font-bold w-4 text-center`}>
                                          {checkIcon}
                                        </span>
                                      </div>
                                    </div>
                                    <p className="text-xs opacity-80 mt-0.5 leading-tight">{dim.reason}</p>
                                    {isActive && (
                                      <p className="text-xs opacity-50 mt-0.5">Weight: {Math.round(dim.weight * 100)}%</p>
                                    )}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )
                      })()}

                      {/* Key stats row */}
                      <div className="grid grid-cols-3 gap-2">
                        <div className="text-center bg-gray-50 rounded-lg py-2">
                          <p className="text-xs text-gray-400">Rating</p>
                          <p className="text-sm font-bold text-gray-800">
                            {vendor.rating ?? 0}/5 ⭐
                          </p>
                        </div>
                        <div className="text-center bg-gray-50 rounded-lg py-2">
                          <p className="text-xs text-gray-400">Best Package</p>
                          <p className="text-sm font-bold text-gray-800 truncate px-1">
                            {vendor._recommended_package
                              ? `PKR ${vendor._recommended_package.price?.toLocaleString()}`
                              : '—'}
                          </p>
                        </div>
                        <div className="text-center bg-gray-50 rounded-lg py-2">
                          <p className="text-xs text-gray-400">Rank</p>
                          <p className="text-sm font-bold text-gray-800">#{idx + 1}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          {/* Legend */}
          <section className="bg-gray-50 rounded-xl px-4 py-3">
            <p className="text-xs font-bold text-gray-600 mb-2">Score Legend</p>
            <div className="flex flex-wrap gap-3 text-xs">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-green-500 inline-block" />
                <span className="text-gray-600">80–100% Strong match</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-yellow-500 inline-block" />
                <span className="text-gray-600">60–79% Good match</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-red-500 inline-block" />
                <span className="text-gray-600">0–59% Partial match</span>
              </span>
            </div>
          </section>

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex-shrink-0">
          <button
            onClick={onClose}
            className="w-full bg-gradient-to-r from-[#D72626] to-[#F26D46] text-white font-semibold py-2.5 rounded-xl hover:opacity-90 transition-opacity text-sm"
          >
            Close Report
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Chatbot ─────────────────────────────────────────────────────────────

export default function Chatbot() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: "Hi! I'm your wedding planning assistant. I can help you find vendors, check your bookings, reviews, and favorites. How can I assist you today?" }
  ])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [collectedInfo, setCollectedInfo] = useState<any>({})
  const [expectedField, setExpectedField] = useState<string | null>(null)
  const [showCategorySelection, setShowCategorySelection] = useState(true)
  const [showSidebar, setShowSidebar] = useState(false)
  const [sessions, setSessions] = useState<any[]>([])
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [reportModalData, setReportModalData] = useState<{ vendors: any[]; collectedInfo: any } | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const user = useAuthStore((state) => state.user)

  const categories = [
    { id: 'Photography', name: 'Photography', icon: '' },
    { id: 'Caterer', name: 'Caterer', icon: '' },
    { id: 'Decorator', name: 'Decorator', icon: '' },
    { id: 'Venue', name: 'Venue', icon: '' },
    { id: 'Makeup Artist', name: 'Makeup Artist', icon: '' },
    { id: 'DJ', name: 'DJ', icon: '' },
    { id: 'Florist', name: 'Florist', icon: '' },
    { id: 'Mehndi', name: 'Mehndi', icon: '' },
    { id: 'Videography', name: 'Videography', icon: '' },
  ]

  const fetchSessions = async () => {
    try {
      const response = await api.get('/chatbot/sessions')
      setSessions(response.data.sessions || [])
    } catch (error) {
      console.error('Error fetching sessions:', error)
    }
  }

  const loadSession = async (sessionId: string) => {
    try {
      const response = await api.get(`/chatbot/sessions/${sessionId}`)
      const session = response.data
      const sessionMessages: Message[] = (session.messages || []).map((msg: any) => ({
        role: msg.role,
        content: msg.content,
        vendors: msg.vendors,
        collectedInfo: msg.collected_info || msg.collectedInfo
      }))
      setMessages(sessionMessages)
      setCurrentSessionId(sessionId)
      setShowCategorySelection(false)
      setShowSidebar(false)
      const lastWithInfo = [...sessionMessages].reverse().find(m => m.collectedInfo)
      if (lastWithInfo?.collectedInfo) {
        setCollectedInfo(lastWithInfo.collectedInfo)
      }
      localStorage.setItem('active_chat_session_id', sessionId)
    } catch (error) {
      console.error('Error loading session:', error)
    }
  }

  const deleteSession = async (sessionId: string) => {
    try {
      await api.delete(`/chatbot/sessions/${sessionId}`)
      await fetchSessions()
      if (currentSessionId === sessionId) handleNewChat()
    } catch (error) {
      console.error('Error deleting session:', error)
    }
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => { scrollToBottom() }, [messages, isLoading, isOpen])

  useEffect(() => {
    const initChat = async () => {
      if (!user) return
      try {
        const response = await api.get('/chatbot/sessions')
        const sessionList = response.data.sessions || []
        setSessions(sessionList)

        const savedSessionId = localStorage.getItem('active_chat_session_id')
        if (savedSessionId && sessionList.some((s: any) => s._id === savedSessionId)) {
          await loadSession(savedSessionId)
        }
      } catch (error) {
        console.error('Error initializing chat:', error)
      }
    }
    initChat()
  }, [user])

  const handleCategorySelect = async (category: string) => {
    setShowCategorySelection(false)
    setCollectedInfo({ category })
    setExpectedField(null)
    const userMessage: Message = { role: 'user', content: `I'm looking for ${category}` }
    setMessages(prev => [...prev, userMessage])
    setIsLoading(true)

    try {
      const conversationHistory = messages.map(msg => ({ role: msg.role, content: msg.content }))
      const response = await api.post('/chatbot/chat', {
        message: `I'm looking for ${category}`,
        conversation_history: conversationHistory,
        collected_info: { category },
        expected_field: null,
        session_id: currentSessionId
      })
      const data: ChatResponse = response.data
      const hasVendors = data.type === 'vendor_results' && Boolean(data.vendors?.length)
      const assistantMessage: Message = {
        role: 'assistant',
        content: data.response,
        vendors: hasVendors ? data.vendors : undefined,
        collectedInfo: hasVendors ? (data.collected_info || { category }) : undefined,
      }
      setMessages(prev => [...prev, assistantMessage])
      if (data.session_id) {
        setCurrentSessionId(data.session_id)
        localStorage.setItem('active_chat_session_id', data.session_id)
      }
      setCollectedInfo(data.collected_info || {})
      setExpectedField(data.expected_field ?? null)
      await fetchSessions()
    } catch (error) {
      console.error('Error sending message:', error)
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.' }])
    } finally {
      setIsLoading(false)
    }
  }

  const handleResetCategory = () => {
    setShowCategorySelection(true)
    setCollectedInfo({})
    setExpectedField(null)
    setReportModalData(null)
  }

  const handleNewChat = () => {
    setMessages([
      { role: 'assistant', content: "Hi! I'm your wedding planning assistant. I can help you find vendors, check your bookings, reviews, and favorites. How can I assist you today?" }
    ])
    setCollectedInfo({})
    setExpectedField(null)
    setShowCategorySelection(true)
    setCurrentSessionId(null)
    setShowSidebar(false)
    setReportModalData(null)
    localStorage.removeItem('active_chat_session_id')
  }

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return
    const userMessage: Message = { role: 'user', content: inputValue }
    setMessages(prev => [...prev, userMessage])
    const currentInput = inputValue
    setInputValue('')
    setIsLoading(true)

    try {
      const conversationHistory = messages.map(msg => ({ role: msg.role, content: msg.content }))
      const response = await api.post('/chatbot/chat', {
        message: currentInput,
        conversation_history: conversationHistory,
        collected_info: collectedInfo,
        expected_field: expectedField,
        session_id: currentSessionId
      })
      const data: ChatResponse = response.data
      const hasVendors = data.type === 'vendor_results' && Boolean(data.vendors?.length)
      const assistantMessage: Message = {
        role: 'assistant',
        content: data.response,
        vendors: hasVendors ? data.vendors : undefined,
        collectedInfo: hasVendors ? (data.collected_info || collectedInfo) : undefined,
      }
      setMessages(prev => [...prev, assistantMessage])
      if (data.session_id) {
        setCurrentSessionId(data.session_id)
        localStorage.setItem('active_chat_session_id', data.session_id)
      }
      setCollectedInfo(data.collected_info || {})
      setExpectedField(data.expected_field ?? null)
      await fetchSessions()
    } catch (error) {
      console.error('Error sending message:', error)
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.' }])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (!isLoading && isOpen) inputRef.current?.focus()
  }, [isLoading, isOpen])

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  if (!user) return null

  return (
    <>
      {/* Match Report Modal */}
      {reportModalData && reportModalData.vendors && reportModalData.vendors.length > 0 && (
        <MatchReportModal
          vendors={reportModalData.vendors}
          collectedInfo={reportModalData.collectedInfo}
          onClose={() => setReportModalData(null)}
        />
      )}

      {/* Floating button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 bg-gradient-to-r from-[#D72626] to-[#F26D46] text-white p-4 rounded-full shadow-2xl hover:scale-110 transition-transform duration-300 group"
          title="Ask AI"
        >
          <div className="flex items-center gap-2">
            <span className="text-2xl">🤖 Assistant</span>
          </div>
        </button>
      )}

      {/* Chat window */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-96 h-[500px] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden border-2 border-[#D72626]/20">

          {/* Header */}
          <div className="bg-gradient-to-r from-[#D72626] to-[#F26D46] text-white p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowSidebar(!showSidebar)}
                className="text-white hover:bg-white/20 rounded-full p-1 transition-colors"
                title="Chat history"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <h3 className="font-bold">Wedding Assistant</h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleNewChat}
                className="bg-white text-[#D72626] rounded-full px-3 py-1.5 transition-colors text-sm font-bold shadow-md hover:bg-gray-100"
              >
                New Chat
              </button>
              {!showCategorySelection && (
                <button
                  onClick={handleResetCategory}
                  className="text-white hover:bg-white/20 rounded-full p-1 transition-colors text-xs"
                  title="Change category"
                >
                  🔄
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="text-white hover:bg-white/20 rounded-full p-1 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Session sidebar */}
          {showSidebar && (
            <div className="border-b border-gray-200 bg-white p-3">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold text-gray-700">Chat History</h4>
                <button onClick={() => setShowSidebar(false)} className="text-gray-500 hover:text-gray-700">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {sessions.length === 0 ? (
                  <p className="text-xs text-gray-500">No previous chats</p>
                ) : (
                  sessions.map((session: any) => (
                    <div
                      key={session._id}
                      className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${currentSessionId === session._id ? 'bg-[#D72626]/10 text-[#D72626]' : 'hover:bg-gray-100'
                        }`}
                      onClick={() => loadSession(session._id)}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{session.title}</p>
                        <p className="text-xs text-gray-500">{new Date(session.updated_at).toLocaleDateString()}</p>
                      </div>
                      <button
                        onClick={e => { e.stopPropagation(); deleteSession(session._id) }}
                        className="text-gray-400 hover:text-red-500 ml-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Messages area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">

            {showCategorySelection && (
              <div className="bg-white border border-gray-200 rounded-2xl p-4">
                <p className="text-sm font-semibold text-gray-800 mb-3">What are you looking for?</p>
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {categories.map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => handleCategorySelect(cat.name)}
                      disabled={isLoading}
                      className="flex-shrink-0 px-4 py-2 bg-gradient-to-r from-[#D72626] to-[#F26D46] text-white rounded-full text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      <span>{cat.icon}</span>
                      <span>{cat.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((message, index) => (
              <div key={index} className="space-y-2">
                <div className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[85%] p-3 rounded-2xl ${message.role === 'user'
                        ? 'bg-gradient-to-r from-[#D72626] to-[#F26D46] text-white'
                        : 'bg-white text-gray-800 border border-gray-200'
                      }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  </div>
                </div>

                {/* Inline vendor cards & Match Report button attached to this message */}
                {message.vendors && message.vendors.length > 0 && (
                  <div className="space-y-2 pl-1 max-w-[95%]">
                    {message.vendors.slice(0, 5).map((vendor, idx) => (
                      <div key={idx} className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <p className="font-bold text-sm text-gray-800 leading-tight">
                            {vendor.business_name || 'Vendor'}
                          </p>
                          {vendor.match_score != null && (
                            <span
                              className={`flex-shrink-0 text-xs font-bold px-2 py-0.5 rounded-full ${vendor.match_score >= 80
                                  ? 'bg-green-100 text-green-700'
                                  : vendor.match_score >= 60
                                    ? 'bg-yellow-100 text-yellow-700'
                                    : 'bg-gray-100 text-gray-600'
                                }`}
                            >
                              🎯 {vendor.match_score}% Match
                            </span>
                          )}
                        </div>
                        {vendor.match_reason && (
                          <p className="text-xs text-gray-500 italic mb-1 leading-snug">
                            {vendor.match_reason}
                          </p>
                        )}
                        <p className="text-xs text-gray-500">{vendor.service_category} · {vendor.business_address}</p>
                        <p className="text-xs text-gray-500">Rating: {vendor.rating ?? 0}/5 ⭐</p>
                        {vendor._recommended_package && (
                          <p className="text-xs font-semibold text-[#D72626] mt-1">
                            {vendor._recommended_package.tier === 'Premium' ? '✨ Premium' : 'Recommended'}:{' '}
                            {vendor._recommended_package.name} — PKR{' '}
                            {vendor._recommended_package.price?.toLocaleString()}
                          </p>
                        )}
                      </div>
                    ))}

                    {/* View Full Match Score Report button */}
                    {message.vendors.some(v => v.match_score != null) && (
                      <button
                        onClick={() => setReportModalData({ vendors: message.vendors!, collectedInfo: message.collectedInfo || collectedInfo })}
                        className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-[#D72626]/10 to-[#F26D46]/10 hover:from-[#D72626]/20 hover:to-[#F26D46]/20 border border-[#D72626]/30 text-[#D72626] font-semibold text-sm py-2.5 rounded-xl transition-all duration-200 shadow-sm"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        View Full Match Score Report
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white border border-gray-200 p-3 rounded-2xl">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100" />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200" />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div className="p-4 border-t border-gray-200 bg-white">
            <div className="flex gap-2">
              <input
                type="text"
                ref={inputRef}
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type your message..."
                disabled={isLoading}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-[#D72626] focus:border-transparent disabled:opacity-50"
              />
              <button
                onClick={handleSendMessage}
                disabled={isLoading || !inputValue.trim()}
                className="bg-gradient-to-r from-[#D72626] to-[#F26D46] text-white p-2 rounded-full hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
