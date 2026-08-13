import { useState, useRef, useEffect } from 'react'
import api from '../services/api'
import { useAuthStore } from '../store/authStore'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface ChatResponse {
  response: string
  type: string
  vendors?: any[]
  collected_info?: any
  expected_field?: string | null
  data?: any[]
}

export default function Chatbot() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Hi! I\'m your wedding planning assistant. I can help you find vendors, check your bookings, reviews, and favorites. How can I assist you today?' }
  ])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [collectedInfo, setCollectedInfo] = useState<any>({})
  const [expectedField, setExpectedField] = useState<string | null>(null)
  const [vendorResults, setVendorResults] = useState<any[]>([])
  const [showCategorySelection, setShowCategorySelection] = useState(true)
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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, isOpen])

  const handleCategorySelect = async (category: string) => {
    setShowCategorySelection(false)
    setCollectedInfo({ category })
    setExpectedField(null)
    setVendorResults([])
    const userMessage: Message = { role: 'user', content: `I'm looking for ${category}` }
    setMessages(prev => [...prev, userMessage])
    setIsLoading(true)

    try {
      const conversationHistory = messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }))

      const response = await api.post('/chatbot/chat', {
        message: `I'm looking for ${category}`,
        conversation_history: conversationHistory,
        collected_info: { category },
        expected_field: null
      })

      const data: ChatResponse = response.data
      const assistantMessage: Message = { role: 'assistant', content: data.response }
      setMessages(prev => [...prev, assistantMessage])

      setCollectedInfo(data.collected_info || {})
      setExpectedField(data.expected_field ?? null)

      if (data.type === 'vendor_results' && data.vendors?.length) {
        setVendorResults(data.vendors)
      } else {
        // Any response that isn't a fresh set of vendor results (e.g. an
        // "I couldn't find any vendors in Kashmir, which city instead?"
        // question) must not leave the previous search's cards on screen —
        // those cards belong to a search that no longer applies.
        setVendorResults([])
      }
      
    } catch (error) {
      
      console.error('Error sending message:', error)
      const errorMessage: Message = { 
        role: 'assistant', 
        content: 'Sorry, I encountered an error. Please try again.' 
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleResetCategory = () => {
    setShowCategorySelection(true)
    setCollectedInfo({})
    setExpectedField(null)
    setVendorResults([])
  }

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return

    const userMessage: Message = { role: 'user', content: inputValue }
    setMessages(prev => [...prev, userMessage])
    setInputValue('')
    setIsLoading(true)
    // Clear the previous search's vendor cards immediately — they belong
    // to the old query and shouldn't linger while we wait for (or in case
    // we never get) a fresh vendor_results response for this message.
    setVendorResults([])

    try {
      const conversationHistory = messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }))

      const response = await api.post('/chatbot/chat', {
        message: inputValue,
        conversation_history: conversationHistory,
        collected_info: collectedInfo,
        expected_field: expectedField
      })

      const data: ChatResponse = response.data
      const assistantMessage: Message = { role: 'assistant', content: data.response }
      setMessages(prev => [...prev, assistantMessage])

      setCollectedInfo(data.collected_info || {})
      setExpectedField(data.expected_field ?? null)

      if (data.type === 'vendor_results' && data.vendors?.length) {
        setVendorResults(data.vendors)
      } else {
        setVendorResults([])
      }
    } catch (error) {
      console.error('Error sending message:', error)
      const errorMessage: Message = { 
        role: 'assistant', 
        content: 'Sorry, I encountered an error. Please try again.' 
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (!isLoading && isOpen) {
        inputRef.current?.focus()
    }
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
      
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 bg-gradient-to-r from-[#D72626] to-[#F26D46] text-white p-4 rounded-full shadow-2xl hover:scale-110 transition-transform duration-300 group"
          title="Ask AI"
        >
          <div className="flex items-center gap-2">
            <span className="text-2xl">🤖 Assistant</span>
            <span className="font-bold text-sm hidden group-hover:inline"></span>
          </div>
        </button>
      )}

      
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-96 h-[500px] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden border-2 border-[#D72626]/20">
          <div className="bg-gradient-to-r from-[#D72626] to-[#F26D46] text-white p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl"></span>
              <h3 className="font-bold">Wedding Assistant</h3>
            </div>
            <div className="flex items-center gap-2">
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

          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
            {showCategorySelection && (
              <div className="bg-white border border-gray-200 rounded-2xl p-4">
                <p className="text-sm font-semibold text-gray-800 mb-3">What are you looking for?</p>
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {categories.map((cat) => (
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
              <div
                key={index}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] p-3 rounded-2xl ${
                    message.role === 'user'
                      ? 'bg-gradient-to-r from-[#D72626] to-[#F26D46] text-white'
                      : 'bg-white text-gray-800 border border-gray-200'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                </div>
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

            {vendorResults.length > 0 && (
              <div className="space-y-2">
                {vendorResults.slice(0, 5).map((vendor, idx) => (
                  <div key={idx} className="bg-white border border-gray-200 rounded-xl p-3">
                    <p className="font-bold text-sm text-gray-800">{vendor.business_name || 'Vendor'}</p>
                    <p className="text-xs text-gray-500">{vendor.service_category} · {vendor.business_address}</p>
                    <p className="text-xs text-gray-500">Rating: {vendor.rating ?? 0}/5 </p>
                    {vendor._recommended_package && (
                      <p className="text-xs font-semibold text-[#D72626] mt-1">
                        {vendor._recommended_package.tier === 'Premium' ? '\ Premium' : 'Recommended'}: {vendor._recommended_package.name} — PKR {vendor._recommended_package.price?.toLocaleString()}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          <div className="p-4 border-t border-gray-200 bg-white">
            <div className="flex gap-2">
              <input
                type="text"
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
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