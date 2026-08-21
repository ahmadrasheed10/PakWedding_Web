import { useEffect, useState, useRef } from 'react'
import { useAuthStore } from '../../store/authStore'
import api from '../../services/api'
import Sidebar from '../../components/Sidebar'
import EmojiPicker from "emoji-picker-react";


interface Conversation {
  _id: string
  user_id: string
  vendor_id: string
  last_message?: string
  last_message_at: string
  user_name?: string
  vendor_name?: string
  vendor_category?: string
  unread_count: number
}

interface Message {
  _id: string
  conversation_id: string
  sender_id: string
  text: string
  image_url?: string | null
  created_at: string
  is_read: boolean
}
export default function MessagesPage() {
  const { user } = useAuthStore()
  const isVendor = user?.role === 'vendor'

  const [vendorId, setVendorId] = useState<string | null>(null)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConversation, setActiveConversation] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const messageInputRef = useRef<HTMLInputElement>(null)

  const emojiPickerRef = useRef<HTMLDivElement>(null);

const [imageFile, setImageFile] = useState<File | null>(null)
const [imagePreview, setImagePreview] = useState<string | null>(null)
const [uploadingImage, setUploadingImage] = useState(false)

const fileInputRef = useRef<HTMLInputElement>(null)
const [viewingImage, setViewingImage] = useState<string | null>(null)
const [imageZoom, setImageZoom] = useState(1)

const [showNotification, setShowNotification] = useState(false)
const [notificationCount, setNotificationCount] = useState(0)

const openImageViewer = (imageUrl: string) => {
  setViewingImage(imageUrl)
  setImageZoom(1)
}

const closeImageViewer = () => {
  setViewingImage(null)
  setImageZoom(1)
}

const handleInputKeyDown = (
  e: React.KeyboardEvent<HTMLInputElement>
) => {
  if (e.key === 'Enter') {
    e.preventDefault()

    if (imageFile || newMessage.trim()) {
      handleSendMessage(e as unknown as React.FormEvent)
    }
  }
}

useEffect(() => {
  const handleClickOutside = (event: MouseEvent) => {
    if (
      emojiPickerRef.current &&
      !emojiPickerRef.current.contains(event.target as Node)
    ) {
      setShowEmojiPicker(false);
    }
    setTimeout(() => {
      messageInputRef.current?.focus()
    }, 0)
  };

  document.addEventListener("mousedown", handleClickOutside);

  return () => {
    document.removeEventListener("mousedown", handleClickOutside);
  };
}, []);

const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
  const items = e.clipboardData.items

  for (const item of items) {
    if (item.type.startsWith('image/')) {
      const file = item.getAsFile()

      if (!file) return

      const allowedTypes = [
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
      ]

      const maxSize = 5 * 1024 * 1024

      if (!allowedTypes.includes(file.type)) {
        alert('Invalid image type.')
        return
      }

      if (file.size > maxSize) {
        alert('Image size exceeds 5MB limit.')
        return
      }

      setImageFile(file)

      const reader = new FileReader()

      reader.onloadend = () => {
        setImagePreview(reader.result as string)
      }

      reader.readAsDataURL(file)

      // Stop browser from inserting anything into the input
      e.preventDefault()

      setTimeout(() => {
        messageInputRef.current?.focus()
      }, 0)

      break
    }
  }
}

const handleChatImageChange = (
  e: React.ChangeEvent<HTMLInputElement>
) => {
  const file = e.target.files?.[0]

  if (!file) {
    return
  }

  const allowedTypes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
  ]

  const maxSize = 5 * 1024 * 1024

  if (!allowedTypes.includes(file.type)) {
    alert('Invalid image type. Only JPG, PNG, GIF and WEBP are allowed.')
    e.target.value = ''
    return
  }

  if (file.size > maxSize) {
    alert('Image size exceeds 5MB limit.')
    e.target.value = ''
    return
  }

  setImageFile(file)

  const reader = new FileReader()

  reader.onloadend = () => {
    setImagePreview(reader.result as string)
  }

  reader.readAsDataURL(file)

  setTimeout(() => {
    messageInputRef.current?.focus()
  }, 0)
}

const removeSelectedImage = () => {
  setImageFile(null)
  setImagePreview(null)

  if (fileInputRef.current) {
    fileInputRef.current.value = ''
  }
}

const uploadChatImage = async (): Promise<string | null> => {
  if (!imageFile) {
    return null
  }

  const formData = new FormData()

  formData.append('file', imageFile)

  const response = await api.post(
    '/uploads/chat/image',
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }
  )

  return response.data?.image_url || null
}

  const sidebarItems = isVendor ? [
    { path: '/vendor/dashboard', label: 'Dashboard', icon: '📊' },
    { path: '/vendor/bookings', label: 'Bookings', icon: '📅' },
    { path: '/vendor/messages', label: 'Messages', icon: '💬' },
    { path: '/vendor/profile', label: 'Profile', icon: '👤' },
    { path: '/vendor/packages', label: 'Packages', icon: '📦' },
    { path: '/vendor/reviews', label: 'Reviews', icon: '⭐' },
  ] : [
    { path: '/dashboard', label: 'Dashboard', icon: '📊' },
    { path: '/vendors', label: 'Find Vendors', icon: '🔍' },
    { path: '/bookings/history', label: 'My Bookings', icon: '📅' },
    { path: '/messages', label: 'Messages', icon: '💬' },
    { path: '/budget-planner', label: 'Budget Planner', icon: '💰' },
    { path: '/checklist', label: 'Checklist', icon: '✅' },
    { path: '/favorites', label: 'Favorites', icon: '❤️' },
    { path: '/reviews', label: 'My Reviews', icon: '⭐' },
  ]

  useEffect(() => {
    const fetchVendorId = async () => {
      if (!isVendor) return
      try {
        const res = await api.get('/vendors/me')
        const vid = res.data?._id || res.data?.id
        setVendorId(vid || null)
      } catch (err) {
        console.error('Could not fetch vendor profile', err)
      }
    }
    fetchVendorId()
  }, [isVendor])

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && viewingImage) {
        closeImageViewer()
      }
    }
  
    document.addEventListener('keydown', handleEscape)
  
    return () => {
      document.removeEventListener('keydown', handleEscape)
    }
  }, [viewingImage])

  useEffect(() => {
    if (isVendor && vendorId === null) return // Wait for vendor ID
    loadConversations()
  }, [isVendor, vendorId])

  useEffect(() => {
    if (!activeConversation) return
  
    loadMessages(activeConversation)
  
    const wsProtocol =
      window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  
    const wsHost = window.location.host
  
    const ws = new WebSocket(
      `${wsProtocol}//${wsHost}/chat/ws/${activeConversation}`
    )
  
    ws.onopen = () => {
      console.log('WebSocket connected')
    }
  
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data)
    
      // Update messages inside the currently open conversation
      setMessages(prev => {
        if (prev.some(m => m._id === message._id)) {
          return prev
        }
    
        return [...prev, message]
      })
    
      // Update conversation list
      setConversations(prev =>
        prev.map(conv =>
          conv._id === message.conversation_id
            ? {
                ...conv,
                last_message: message.text || '📷 Image',
                last_message_at: message.created_at,
    
                // Only increase unread if the message is from the other person
                unread_count:
                  message.sender_id !== getSenderId()
                    ? (conv.unread_count || 0) + 1
                    : conv.unread_count || 0,
              }
            : conv
        )
      )
    
      // Update notification count
      if (message.sender_id !== getSenderId()) {
        setNotificationCount(prev => prev + 1)
        setShowNotification(true)
      }
    
      // Scroll to bottom
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({
          behavior: 'smooth'
        })
      }, 50)
    }
  
    ws.onerror = (error) => {
      console.error('WebSocket error:', error)
    }
  

    ws.onclose = () => {
      console.log('WebSocket disconnected')
    }
  
    return () => {
      ws.close()
    }
  
  }, [activeConversation])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeConversation])

  const loadConversations = async () => {
    try {
      const endpoint = isVendor
        ? '/chat/conversations/vendor'
        : '/chat/conversations/user'
  
      const res = await api.get(endpoint)
  
      const data = res.data || []
  
      setConversations(data)
  
      // Calculate total unread messages
      const totalUnread = data.reduce(
        (total: number, conversation: Conversation) =>
          total + (conversation.unread_count || 0),
        0
      )
  
      setNotificationCount(totalUnread)
  
      if (totalUnread > 0) {
        setShowNotification(true)
      }
  
    } catch (err) {
      console.error('Failed to load conversations', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isVendor && vendorId === null) return
  
    const interval = setInterval(() => {
      loadConversations()
    }, 2000) 
  
    return () => {
      clearInterval(interval)
    }
  }, [isVendor, vendorId])


  useEffect(() => {
    if (!activeConversation) return
  
    const interval = setInterval(() => {
      loadMessages(activeConversation, true)
    }, 2000)
  
    return () => {
      clearInterval(interval)
    }
  }, [activeConversation, vendorId])

  const loadMessages = async (convId: string, silent = false) => {
    try {

      const params = isVendor && vendorId ? { as_vendor: vendorId } : {}
      const res = await api.get(`/chat/conversations/${convId}/messages`, { params })
      setMessages(res.data || [])
      if (!silent) {
        setConversations(prev => prev.map(c =>
          c._id === convId ? { ...c, unread_count: 0 } : c
        ))
        // Scroll to bottom when opening a conversation
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
      }
    } catch (err) {
      console.error('Failed to load messages', err)
    }
  }

  const getSenderId = () => {
    // Vendors send as their vendor profile ID; users send as their user ID
    if (isVendor && vendorId) return vendorId
    return user?.id || ''
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
  
    if (
      (!newMessage.trim() && !imageFile) ||
      !activeConversation ||
      sending
    ) {
      return
    }
  
    const text = newMessage.trim()
    setNewMessage('')
    setSending(true)
  
    const senderId = getSenderId()
  
    // Declare this BEFORE try so catch can access it
    const optimisticMsg: Message = {
      _id: 'temp-' + Date.now(),
      conversation_id: activeConversation,
      sender_id: senderId,
      text,
      image_url: null,
      created_at: new Date().toISOString(),
      is_read: false,
    }
  
    try {
      // Upload image if selected
      let imageUrl: string | null = null
  
      if (imageFile) {
        setUploadingImage(true)
        imageUrl = await uploadChatImage()
        setUploadingImage(false)
      }
  
      // Add image URL to optimistic message
      optimisticMsg.image_url = imageUrl
  
      // Show message immediately
      setMessages(prev => [...prev, optimisticMsg])
  
      setConversations(prev =>
        prev.map(c =>
          c._id === activeConversation
            ? {
                ...c,
                last_message: text || '📷 Image',
                last_message_at: new Date().toISOString(),
              }
            : c
        )
      )
  
      // Send to backend
      const res = await api.post(
        `/chat/conversations/${activeConversation}/messages`,
        {
          text,
          sender_id: senderId,
          image_url: imageUrl,
        }
      )
  
      // Replace temporary message with real message
      setMessages(prev =>
        prev.map(m =>
          m._id === optimisticMsg._id
            ? { ...res.data, image_url: imageUrl || res.data.image_url }
            : m
        )
      )
  
      // Clear selected image
      setImageFile(null)
      setImagePreview(null)
  
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
  
      // Scroll to bottom
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({
          behavior: 'smooth',
        })
      }, 100)
  
    } catch (err) {
      console.error('Failed to send message', err)
  
      // Remove optimistic message if sending failed
      setMessages(prev =>
        prev.filter(m => m._id !== optimisticMsg._id)
      )
    } finally {
      setSending(false)
      setUploadingImage(false)
    }
  }
  const isMine = (msg: Message) => msg.sender_id === getSenderId()

  const getConversationName = (conv: Conversation) => {
    if (isVendor) {
      return conv.user_name || 'User'
    }
    const name = conv.vendor_name || 'Vendor'
    const category = conv.vendor_category ? ` - ${conv.vendor_category}` : ''
    return `${name}${category}`
  }

  return (
    <div className="flex h-screen bg-gray-50" style={{ paddingTop: '0' }}>
      
      <Sidebar items={sidebarItems} title={isVendor ? 'Vendor Dashboard' : 'User Dashboard'} />

      <div className="flex-1 flex overflow-hidden pt-16 lg:pt-0">
        {/* ─── Conversation List ─── */}
        <div className="w-80 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col">
          <div className="px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-white to-orange-50/40">
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <span>💬</span> Messages
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
            {loading ? (
              <div className="p-6 text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-primary-200 border-t-primary-600 mb-2"></div>
                <p className="text-sm text-gray-400">Loading conversations...</p>
              </div>
            ) : conversations.length === 0 ? (
              <div className="p-6 text-center">
                <div className="text-5xl mb-3">💌</div>
                <p className="text-gray-500 font-medium">No messages yet</p>
                {!isVendor && (
                  <p className="text-xs text-gray-400 mt-1">Browse vendors and click "Message Vendor" to start chatting</p>
                )}
              </div>
            ) : (
              conversations.map(conv => (
                <button
                  key={conv._id}
                  onClick={() => setActiveConversation(conv._id)}
                  className={`w-full text-left px-5 py-4 hover:bg-orange-50/60 transition-all duration-150 ${
                    activeConversation === conv._id
                      ? 'bg-orange-50 border-l-4 border-primary-500'
                      : 'border-l-4 border-transparent'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-gray-800 text-sm truncate">
                      {getConversationName(conv)}
                    </span>
                    {conv.unread_count > 0 && (
                      <span className="bg-primary-500 text-white text-xs font-bold px-2 py-0.5 rounded-full ml-2 flex-shrink-0">
                        {conv.unread_count}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 truncate">
                    {conv.last_message || 'Start the conversation...'}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>

        {/* ─── Chat Area ─── */}
        <div className="flex-1 flex flex-col bg-gradient-to-br from-gray-50 to-orange-50/20 overflow-hidden">
          {activeConversation ? (
            <>
              {/* Chat Header */}
              <div className="px-6 py-4 bg-white border-b border-gray-100 shadow-sm flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-400 to-orange-400 flex items-center justify-center text-white font-bold text-lg">
                  {getConversationName(conversations.find(c => c._id === activeConversation)!)?.[0]?.toUpperCase() || '?'}
                </div>
                <div>
                  <h3 className="font-bold text-gray-800">
                    {getConversationName(conversations.find(c => c._id === activeConversation)!)}
                  </h3>
                  
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-6 space-y-3">
                {messages.length === 0 && (
                  <div className="text-center py-10 text-gray-400">
                    <div className="text-4xl mb-2">👋</div>
                    <p className="text-sm">Say hello to start the conversation!</p>
                  </div>
                )}
                {messages.map((msg, idx) => (
                  <div key={msg._id || idx} className={`flex ${isMine(msg) ? 'justify-end' : 'justify-start'}`}>
                    <div
  className={`max-w-[68%] rounded-2xl px-4 py-2.5 shadow-sm ${
    isMine(msg)
      ? 'bg-gradient-to-br from-primary-500 to-orange-500 text-white rounded-br-sm'
      : 'bg-white text-gray-800 border border-gray-100 rounded-bl-sm'
  }`}
>
{msg.image_url && (
  <img
    src={msg.image_url}
    alt="Shared image"
    onClick={() => openImageViewer(msg.image_url!)}
    className="max-w-[250px] max-h-[300px] rounded-xl object-cover mb-2 cursor-pointer hover:opacity-90 transition"
  />
)}

  {/* Text */}
  {msg.text && (
    <p className="text-sm leading-relaxed">
      {msg.text}
    </p>
  )}

  {/* Time */}
  <p
    className={`text-xs mt-1 ${
      isMine(msg) ? 'text-orange-100' : 'text-gray-400'
    }`}
  >
    {new Date(msg.created_at).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Karachi',
    })}

    {isMine(msg) && (
      <span className="ml-1">
        {msg.is_read ? '✓✓' : '✓'}
      </span>
    )}
  </p>
</div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
<div className="px-6 py-4 bg-white border-t border-gray-100">

  <form
    onSubmit={handleSendMessage}
    className="flex gap-3 items-end"
  >

    {/* Input + Pickers */}
    <div className="relative flex-1">

      {/* Emoji Picker */}
      {showEmojiPicker && (
        <div
          ref={emojiPickerRef}
          className="absolute bottom-14 left-0 z-50"
        >
          <EmojiPicker
            onEmojiClick={(emojiData) => {
              setNewMessage(prev => prev + emojiData.emoji)

              setTimeout(() => {
                messageInputRef.current?.focus()
              }, 0)
            }}
          />
        </div>
      )}

      {/* Image Preview */}
      {imagePreview && (
        <div className="absolute bottom-14 left-0 z-50 bg-white p-2 rounded-xl shadow-lg border border-gray-200">

          <div className="relative">

            <img
              src={imagePreview}
              alt="Selected image"
              className="w-32 h-32 object-cover rounded-lg"
            />

            <button
              type="button"
              onClick={removeSelectedImage}
              className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center text-sm"
            >
              ×
            </button>

          </div>

        </div>
      )}

      {/* Input Container */}
      <div className="flex items-center rounded-full bg-gray-100 border border-gray-200 px-2">

        {/* Emoji Button */}
        <button
          type="button"
          onClick={() => {
            setShowEmojiPicker(prev => !prev)
        
            setTimeout(() => {
              messageInputRef.current?.focus()
            }, 0)
          }}
          
          className="w-9 h-9 flex-shrink-0 flex items-center justify-center text-xl hover:bg-gray-200 rounded-full transition"
        >
          😊
        </button>

        {/* Image Button */}
        <button
          type="button"
          onClick={() => {
            fileInputRef.current?.click()
          }}
          disabled={uploadingImage}
          className="w-9 h-9 flex-shrink-0 flex items-center justify-center text-xl hover:bg-gray-200 rounded-full transition disabled:opacity-50"
        >
          📎
        </button>

        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          onChange={handleChatImageChange}
          className="hidden"
          onPaste={handlePaste}
        />

        {/* Text Input */}
        <input
          ref={messageInputRef}
          type="text"
          value={newMessage}
          onPaste={handlePaste}
          onChange={e => setNewMessage(e.target.value)}
          onKeyDown={handleInputKeyDown}
          placeholder="Type a message..."
          className="flex-1 px-3 py-3 bg-transparent focus:outline-none text-sm"
          autoFocus
        />

      </div>

    </div>

    {/* Send Button */}
    <button
      type="submit"
      disabled={
        (!newMessage.trim() && !imageFile) ||
        sending ||
        uploadingImage
      }
      className="flex-shrink-0 w-11 h-11 bg-gradient-to-br from-primary-500 to-orange-500 hover:from-primary-600 hover:to-orange-600 text-white rounded-full flex items-center justify-center shadow-md transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {uploadingImage ? (
        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
      ) : (
        <svg
          className="w-5 h-5 rotate-90"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 19l9 2-9-18-9 18-9 2zm0 0v-8"
          />
        </svg>
      )}
    </button>

  </form>

</div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center">
              <div className="text-8xl mb-4 opacity-60">💬</div>
              <h3 className="text-xl font-bold text-gray-600 mb-2">Your Messages</h3>
              <p className="text-gray-400 text-sm max-w-xs text-center">
                {isVendor
                  ? 'Select a conversation from the list to read and reply to messages from your customers.'
                  : 'Select a conversation to read your messages, or go to a vendor profile and click "Message Vendor" to start a new chat.'}
              </p>
            </div>
          )}
        </div>
      </div>
      {viewingImage && (
  <div
    className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center"
    onClick={closeImageViewer}
  >
    {/* Close */}
    <button
      type="button"
      onClick={closeImageViewer}
      className="absolute top-5 right-5 w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 text-white text-2xl flex items-center justify-center"
    >
      ×
    </button>

    {/* Image */}
    <img
      src={viewingImage}
      alt="Full size"
      onClick={e => e.stopPropagation()}
      style={{
        transform: `scale(${imageZoom})`,
      }}
      className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg transition-transform duration-200 cursor-zoom-in"
    />
  </div>
)}
    </div>
  )
}
