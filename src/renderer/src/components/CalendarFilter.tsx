import { useState, useMemo, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react'
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isToday } from 'date-fns'
import { zhCN } from 'date-fns/locale'

interface CalendarFilterProps {
  selectedDate: Date | null
  onDateSelect: (date: Date | null) => void
  hasLogDates?: Set<string>
  dateRangeStart?: Date | null
  dateRangeEnd?: Date | null
  onDateRangeSelect?: (start: Date | null, end: Date | null) => void
}

export function CalendarFilter({ 
  selectedDate, 
  onDateSelect,
  hasLogDates = new Set(),
  dateRangeStart,
  dateRangeEnd,
  onDateRangeSelect
}: CalendarFilterProps): JSX.Element {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectingRange, setSelectingRange] = useState(false)
  const [rangeStart, setRangeStart] = useState<Date | null>(null)
  const [hoveredDate, setHoveredDate] = useState<Date | null>(null)

  useEffect(() => {
    if (dateRangeStart) {
      setCurrentMonth(dateRangeStart)
    } else if (selectedDate) {
      setCurrentMonth(selectedDate)
    }
  }, [selectedDate, dateRangeStart])

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth)
    const monthEnd = endOfMonth(monthStart)
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 })
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd })
  }, [currentMonth])

  const handleDayClick = (day: Date) => {
    if (selectingRange && onDateRangeSelect) {
      if (!rangeStart) {
        setRangeStart(day)
      } else {
        const start = day < rangeStart ? day : rangeStart
        const end = day < rangeStart ? rangeStart : day
        onDateRangeSelect(start, end)
        setSelectingRange(false)
        setRangeStart(null)
        setHoveredDate(null)
      }
    } else {
      onDateSelect(isSameDay(day, selectedDate || new Date(0)) ? null : day)
    }
  }

  const isInRange = (day: Date) => {
    if (!dateRangeStart || !dateRangeEnd) return false
    return day >= dateRangeStart && day <= dateRangeEnd
  }

  const isRangeStart = (day: Date) => dateRangeStart && isSameDay(day, dateRangeStart)
  const isRangeEnd = (day: Date) => dateRangeEnd && isSameDay(day, dateRangeEnd)

  const isInPreviewRange = (day: Date) => {
    if (!selectingRange || !rangeStart || !hoveredDate) return false
    const start = hoveredDate < rangeStart ? hoveredDate : rangeStart
    const end = hoveredDate < rangeStart ? rangeStart : hoveredDate
    return day >= start && day <= end
  }

  const isPreviewRangeStart = (day: Date) => {
    if (!selectingRange || !rangeStart) return false
    return isSameDay(day, rangeStart)
  }

  const isPreviewRangeEnd = (day: Date) => {
    if (!selectingRange || !rangeStart || !hoveredDate) return false
    const actualEnd = hoveredDate < rangeStart ? rangeStart : hoveredDate
    return isSameDay(day, actualEnd)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
          {format(currentMonth, 'yyyy年M月', { locale: zhCN })}
        </h3>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
          >
            <ChevronLeft className="w-4 h-4 text-[#64748B] dark:text-[#94A3B8]" />
          </button>
          <button
            onClick={() => setCurrentMonth(new Date())}
            className="px-2 py-1 text-xs text-[#3B82F6] hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
          >
            今天
          </button>
          <button
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
          >
            <ChevronRight className="w-4 h-4 text-[#64748B] dark:text-[#94A3B8]" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {['日', '一', '二', '三', '四', '五', '六'].map((day) => (
          <div
            key={day}
            className="text-center text-xs font-medium text-[#94A3B8] dark:text-[#64748B] py-1"
          >
            {day}
          </div>
        ))}
        {calendarDays.map((day, i) => {
          const dateKey = format(day, 'yyyy-MM-dd')
          const hasLog = hasLogDates.has(dateKey)
          const isSelected = selectedDate && isSameDay(day, selectedDate)
          const isCurrentMonth = isSameMonth(day, currentMonth)
          const isTodayDate = isToday(day)
          const isRangeStartDay = isRangeStart(day)
          const isRangeEndDay = isRangeEnd(day)
          const isInRangeDay = isInRange(day)
          const isInPreviewRangeDay = isInPreviewRange(day)
          const isPreviewRangeStartDay = isPreviewRangeStart(day)
          const isPreviewRangeEndDay = isPreviewRangeEnd(day)
          
          let dayClass = 'w-8 h-8 flex items-center justify-center text-sm rounded-full transition-all duration-200 cursor-pointer'
          
          if (isRangeStartDay || isRangeEndDay) {
            dayClass += ' bg-[#3B82F6] text-white hover:bg-[#2563EB] font-medium shadow-sm'
          } else if (isInRangeDay) {
            dayClass += ' bg-[#EEF4FF] dark:bg-[#1E3A5F] text-[#3B82F6] dark:text-[#60A5FA]'
          } else if (isSelected) {
            dayClass += ' bg-[#3B82F6] text-white hover:bg-[#2563EB] font-medium shadow-sm'
          } else if (isPreviewRangeStartDay || isPreviewRangeEndDay) {
            dayClass += ' bg-[#3B82F6] text-white font-medium shadow-sm'
          } else if (isInPreviewRangeDay) {
            dayClass += ' bg-[#EEF4FF] dark:bg-[#1E3A5F] text-[#3B82F6] dark:text-[#60A5FA]'
          } else if (!isCurrentMonth) {
            dayClass += ' text-[#CBD5E1] dark:text-[#475569]'
          } else {
            dayClass += ' text-[#475569] dark:text-[#CBD5E1]'
            if (isTodayDate) {
              dayClass += ' text-[#3B82F6] dark:text-[#60A5FA] font-medium'
            }
          }

          return (
            <button
              key={i}
              onClick={() => handleDayClick(day)}
              onMouseEnter={() => setHoveredDate(day)}
              onMouseLeave={() => setHoveredDate(null)}
              className={dayClass}
            >
              <div className="relative">
                {format(day, 'd')}
                {hasLog && (
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-[#3B82F6] rounded-full" />
                )}
              </div>
            </button>
          )
        })}
      </div>

      {onDateRangeSelect && (
        <button
          onClick={() => {
            const newSelectingRange = !selectingRange
            setSelectingRange(newSelectingRange)
            setRangeStart(null)
            setHoveredDate(null)
            if (newSelectingRange) {
              onDateSelect(null)
              onDateRangeSelect(null, null)
            }
          }}
          className={`w-full py-1.5 text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
            selectingRange
              ? 'bg-[#EEF4FF] dark:bg-[#1E3A5F] text-[#3B82F6] dark:text-[#60A5FA]'
              : 'text-[#64748B] dark:text-[#94A3B8] hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
        >
          <CalendarIcon className="w-3.5 h-3.5" />
          {selectingRange ? '取消范围选择' : '选择日期范围'}
        </button>
      )}
    </div>
  )
}
