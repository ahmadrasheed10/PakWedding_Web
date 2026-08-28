import { useState, useEffect, useMemo } from 'react'
import { getVendorAvailability, TimeSlot, BookedSlot } from '../services/bookingService'

interface VendorAvailabilityCalendarProps {
  vendorId: string
  selectedDate?: string
  selectedSlot?: TimeSlot
  onSelectSlot?: (date: string, slot: TimeSlot) => void
  readOnly?: boolean
}

export default function VendorAvailabilityCalendar({
  vendorId,
  selectedDate,
  selectedSlot,
  onSelectSlot,
  readOnly = false,
}: VendorAvailabilityCalendarProps) {
  const today = useMemo(() => new Date(), [])
  const [currentYear, setCurrentYear] = useState<number>(today.getFullYear())
  const [currentMonth, setCurrentMonth] = useState<number>(today.getMonth() + 1) // 1-indexed
  const [bookedDates, setBookedDates] = useState<Record<string, BookedSlot[]>>({})
  const [loading, setLoading] = useState<boolean>(false)
  const [activeDate, setActiveDate] = useState<string>(
    selectedDate || today.toISOString().split('T')[0]
  )
  const [activeSlot, setActiveSlot] = useState<TimeSlot | undefined>(selectedSlot)


  useEffect(() => {
    if (!vendorId) return

    let isMounted = true
    const loadAvailability = async () => {
      setLoading(true)
      try {
        const data = await getVendorAvailability(vendorId, currentYear, currentMonth)
        if (isMounted && data?.booked_dates) {
          setBookedDates(data.booked_dates)
        }
      } catch (err) {
        console.error('Failed to load vendor availability:', err)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    loadAvailability()
    return () => {
      isMounted = false
    }
  }, [vendorId, currentYear, currentMonth])

  // Sync internal activeDate/activeSlot if props change
  useEffect(() => {
    if (selectedDate) setActiveDate(selectedDate)
    if (selectedSlot) setActiveSlot(selectedSlot)
  }, [selectedDate, selectedSlot])

  // Month navigation
  const handlePrevMonth = () => {
    if (currentMonth === 1) {
      setCurrentMonth(12)
      setCurrentYear((y) => y - 1)
    } else {
      setCurrentMonth((m) => m - 1)
    }
  }

  const handleNextMonth = () => {
    if (currentMonth === 12) {
      setCurrentMonth(1)
      setCurrentYear((y) => y + 1)
    } else {
      setCurrentMonth((m) => m + 1)
    }
  }

  // Days in month calculation
  const calendarDays = useMemo(() => {
    const firstDayIndex = new Date(currentYear, currentMonth - 1, 1).getDay() // 0 is Sun
    const totalDaysInMonth = new Date(currentYear, currentMonth, 0).getDate()

    const days: { dateStr: string; dayNumber: number; isCurrentMonth: boolean; isPast: boolean }[] = []

    // Padding for previous month
    for (let i = 0; i < firstDayIndex; i++) {
      days.push({ dateStr: '', dayNumber: 0, isCurrentMonth: false, isPast: true })
    }

    // Days of current month
    for (let d = 1; d <= totalDaysInMonth; d++) {
      const monthStr = String(currentMonth).padStart(2, '0')
      const dayStr = String(d).padStart(2, '0')
      const dateStr = `${currentYear}-${monthStr}-${dayStr}`
      const checkDate = new Date(currentYear, currentMonth - 1, d, 23, 59, 59)
      const isPast = checkDate < today

      days.push({
        dateStr,
        dayNumber: d,
        isCurrentMonth: true,
        isPast,
      })
    }

    return days
  }, [currentYear, currentMonth, today])

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ]

  // Slot status helper
  const getSlotStatus = (dateStr: string, slot: TimeSlot) => {
    const slots = bookedDates[dateStr] || []
    const matched = slots.find((s) => s.slot === slot)
    if (!matched) return { isBooked: false, isPending: false, status: 'available' }
    const isHardBooked = matched.status === 'approved' || matched.status === 'confirmed'
    return {
      isBooked: isHardBooked,
      isPending: matched.status === 'pending',
      status: matched.status,
    }
  }

  const getDateStatus = (dateStr: string) => {
    if (!dateStr) return 'empty'
    const slot1 = getSlotStatus(dateStr, '1-4')
    const slot2 = getSlotStatus(dateStr, '7-10')

    const bookedCount = (slot1.isBooked ? 1 : 0) + (slot2.isBooked ? 1 : 0)
    if (bookedCount === 2) return 'fully-booked'
    if (bookedCount === 1) return 'partially-booked'
    if (slot1.isPending || slot2.isPending) return 'tentative'
    return 'available'
  }

  const handleDateClick = (dateStr: string, isPast: boolean) => {
    if (isPast || !dateStr) return
    setActiveDate(dateStr)

    const slot1 = getSlotStatus(dateStr, '1-4')
    const slot2 = getSlotStatus(dateStr, '7-10')

    let newSlot: TimeSlot | undefined = activeSlot
    if (activeSlot === '1-4' && slot1.isBooked) {
      newSlot = slot2.isBooked ? undefined : '7-10'
    } else if (activeSlot === '7-10' && slot2.isBooked) {
      newSlot = slot1.isBooked ? undefined : '1-4'
    } else if (!activeSlot) {
      newSlot = !slot1.isBooked ? '1-4' : !slot2.isBooked ? '7-10' : undefined
    }

    setActiveSlot(newSlot)
    if (newSlot && onSelectSlot) {
      onSelectSlot(dateStr, newSlot)
    }
  }

  const handleSlotSelect = (slot: TimeSlot) => {
    if (readOnly) return
    const status = getSlotStatus(activeDate, slot)
    if (status.isBooked) return

    setActiveSlot(slot)
    if (onSelectSlot) {
      onSelectSlot(activeDate, slot)
    }
  }

  const activeSlot1 = getSlotStatus(activeDate, '1-4')
  const activeSlot2 = getSlotStatus(activeDate, '7-10')

  return (
    <div className="bg-white rounded-2xl border border-rose-100 shadow-sm p-4 sm:p-6 select-none">
      {/* Calendar Header */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
        <div>
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <span>📅</span>
            <span>{monthNames[currentMonth - 1]} {currentYear}</span>
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">Live availability synced with database</p>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handlePrevMonth}
            className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-rose-50 hover:text-primary-600 transition-colors cursor-pointer"
            title="Previous Month"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            type="button"
            onClick={handleNextMonth}
            className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-rose-50 hover:text-primary-600 transition-colors cursor-pointer"
            title="Next Month"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-between text-xs text-gray-600 gap-2 mb-4 bg-gray-50/80 p-2.5 rounded-xl border border-gray-100">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
          <span>Available (2 Slots)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
          <span>1 Slot Left</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
          <span>Fully Booked</span>
        </div>
      </div>

      {/* Days of week */}
      <div className="grid grid-cols-7 gap-1 text-center font-semibold text-xs text-gray-500 mb-2">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div key={day} className="py-1">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1 mb-6 relative">
        {loading && (
          <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] flex items-center justify-center z-10 rounded-xl">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary-600 border-t-transparent"></div>
          </div>
        )}

        {calendarDays.map((day, idx) => {
          if (!day.isCurrentMonth) {
            return <div key={`empty-${idx}`} className="h-11 sm:h-12" />
          }

          const status = getDateStatus(day.dateStr)
          const isSelected = activeDate === day.dateStr
          const isToday =
            today.getFullYear() === currentYear &&
            today.getMonth() + 1 === currentMonth &&
            today.getDate() === day.dayNumber

          let dotColor = 'bg-emerald-500'
          if (status === 'fully-booked') {
            dotColor = 'bg-rose-500'
          } else if (status === 'partially-booked') {
            dotColor = 'bg-amber-500'
          }

          return (
            <button
              key={day.dateStr}
              type="button"
              disabled={day.isPast}
              onClick={() => handleDateClick(day.dateStr, day.isPast)}
              className={`h-11 sm:h-12 rounded-xl flex flex-col items-center justify-center p-1 transition-all relative border ${
                isSelected && !readOnly
                  ? 'border-primary-600 bg-primary-50 ring-2 ring-primary-500/20 font-bold text-primary-900 shadow-sm'
                  : isSelected && readOnly
                  ? 'border-gray-300 bg-gray-100 text-gray-800'
                  : isToday
                  ? 'border-primary-300 bg-rose-50/40 text-gray-900 font-semibold'
                  : 'border-transparent hover:border-gray-200 hover:bg-gray-50 text-gray-800'
              } ${day.isPast ? 'opacity-30 cursor-not-allowed bg-gray-50' : readOnly ? 'cursor-default' : 'cursor-pointer'}`}
            >
              <span className="text-xs sm:text-sm">{day.dayNumber}</span>
              {!day.isPast && (
                <div className="flex items-center gap-0.5 mt-0.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* Selected Date Details & 2 Time Slot Options */}
      {activeDate && (
        <div className="border-t border-gray-100 pt-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <span className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Selected Date</span>
              <h4 className="text-sm font-bold text-gray-900">
                {new Date(activeDate + 'T00:00:00').toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </h4>
            </div>
            {readOnly && (
              <span className="text-xs px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 font-medium">
                Live Status
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Slot 1: 1:00 PM - 4:00 PM (Afternoon) */}
            <div
              onClick={() => handleSlotSelect('1-4')}
              className={`p-3.5 rounded-xl border-2 transition-all flex flex-col justify-between ${
                activeSlot1.isBooked
                  ? 'border-gray-200 bg-gray-50/80 opacity-60 cursor-not-allowed'
                  : !readOnly && activeSlot === '1-4'
                  ? 'border-primary-600 bg-primary-50/50 shadow-md ring-2 ring-primary-500/20 cursor-pointer'
                  : readOnly
                  ? 'border-gray-200 cursor-default'
                  : 'border-gray-200 hover:border-primary-300 hover:bg-rose-50/20 cursor-pointer'
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-1.5 font-bold text-gray-900 text-sm">
                    <span>🌞</span>
                    <span>1:00 PM - 4:00 PM</span>
                  </div>
                  <span className="text-xs text-gray-500">Day / Afternoon Timing</span>
                </div>
                {activeSlot1.isBooked ? (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    Booked
                  </span>
                ) : activeSlot1.isPending ? (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                    Pending
                  </span>
                ) : (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                    Available
                  </span>
                )}
              </div>

              {!activeSlot1.isBooked && !readOnly && (
                <div className="mt-3 flex items-center justify-between text-xs font-semibold">
                  <span className={activeSlot === '1-4' ? 'text-primary-700' : 'text-gray-600'}>
                    {activeSlot === '1-4' ? '✓ Selected Slot' : 'Click to select'}
                  </span>
                  <div
                    className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                      activeSlot === '1-4'
                        ? 'border-primary-600 bg-primary-600 text-white'
                        : 'border-gray-300'
                    }`}
                  >
                    {activeSlot === '1-4' && (
                      <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Slot 2: 7:00 PM - 10:00 PM (Evening) */}
            <div
              onClick={() => handleSlotSelect('7-10')}
              className={`p-3.5 rounded-xl border-2 transition-all flex flex-col justify-between ${
                activeSlot2.isBooked
                  ? 'border-gray-200 bg-gray-50/80 opacity-60 cursor-not-allowed'
                  : !readOnly && activeSlot === '7-10'
                  ? 'border-primary-600 bg-primary-50/50 shadow-md ring-2 ring-primary-500/20 cursor-pointer'
                  : readOnly
                  ? 'border-gray-200 cursor-default'
                  : 'border-gray-200 hover:border-primary-300 hover:bg-rose-50/20 cursor-pointer'
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-1.5 font-bold text-gray-900 text-sm">
                    <span>🌙</span>
                    <span>7:00 PM - 10:00 PM</span>
                  </div>
                  <span className="text-xs text-gray-500">Night / Evening Timing</span>
                </div>
                {activeSlot2.isBooked ? (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    Booked
                  </span>
                ) : activeSlot2.isPending ? (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                    Pending
                  </span>
                ) : (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                    Available
                  </span>
                )}
              </div>

              {!activeSlot2.isBooked && !readOnly && (
                <div className="mt-3 flex items-center justify-between text-xs font-semibold">
                  <span className={activeSlot === '7-10' ? 'text-primary-700' : 'text-gray-600'}>
                    {activeSlot === '7-10' ? '✓ Selected Slot' : 'Click to select'}
                  </span>
                  <div
                    className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                      activeSlot === '7-10'
                        ? 'border-primary-600 bg-primary-600 text-white'
                        : 'border-gray-300'
                    }`}
                  >
                    {activeSlot === '7-10' && (
                      <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
