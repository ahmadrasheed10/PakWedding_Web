import { useEffect, useRef, useState } from 'react'
import { useAuthStore } from '../store/authStore'
import api from '../services/api'

export default function MessageNotification() {
  const { user } = useAuthStore()

  const [notificationCount, setNotificationCount] = useState(0)
  const [showNotification, setShowNotification] = useState(false)

  // Keeps track of unread messages from previous check
  const previousUnreadRef = useRef<number | null>(null)

  useEffect(() => {
    if (!user) return

    const checkUnreadMessages = async () => {
      try {
        const endpoint =
          user.role === 'vendor'
            ? '/chat/conversations/vendor'
            : '/chat/conversations/user'

        const res = await api.get(endpoint)

        const conversations = res.data || []

        const totalUnread = conversations.reduce(
          (total: number, conversation: any) =>
            total + (conversation.unread_count || 0),
          0
        )

        const previousUnread = previousUnreadRef.current

        setNotificationCount(totalUnread)

        /*
         * First check after login:
         * If unread messages already exist, show notification.
         */
        if (previousUnread === null) {
          if (totalUnread > 0) {
            setShowNotification(true)
          }
        }

        /*
         * Later checks:
         * If unread count increased, a new message arrived.
         */
        else if (totalUnread > previousUnread) {
          setShowNotification(true)
        }

        previousUnreadRef.current = totalUnread

      } catch (error) {
        console.error(
          'Failed to check unread messages:',
          error
        )
      }
    }

    // Check immediately when Dashboard opens
    checkUnreadMessages()

    // Check every 3 seconds for new messages
    const interval = setInterval(() => {
      checkUnreadMessages()
    }, 3000)

    return () => {
      clearInterval(interval)
    }
  }, [user])

  if (!showNotification || notificationCount === 0) {
    return null
  }

  return (
    <div className="fixed top-5 right-5 z-[200] bg-white border border-gray-200 shadow-xl rounded-xl p-4 flex items-center gap-3">

      {/* Icon */}
      <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-xl">
        💬
      </div>

      {/* Text */}
      <div>
        <p className="font-semibold text-gray-800">
          New messages
        </p>

        <p className="text-sm text-gray-500">
          You have {notificationCount}{' '}
          {notificationCount === 1
            ? 'new message'
            : 'new messages'}
        </p>
      </div>

      {/* Close */}
      <button
        type="button"
        onClick={() => setShowNotification(false)}
        className="ml-3 text-gray-400 hover:text-gray-600 text-xl"
      >
        ×
      </button>

    </div>
  )
}