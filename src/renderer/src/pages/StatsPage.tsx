import { useEffect, useState, useRef, useMemo } from 'react'
import { Flame, FileText, CheckCircle2, ListTodo, Calendar, TrendingUp, TrendingDown, Info, CalendarIcon, X } from 'lucide-react'
import { useI18n } from '../stores/languageStore'
import { useWorkLogStore } from '../stores/worklogStore'
import { useTaskStore } from '../stores/taskStore'
import { getTagColors } from '../utils/tagColorUtils'

interface DailyStats {
  date: string
  log_count: number
  task_completed: number
}

interface Stats {
  daily: DailyStats[]
  totalLogs: number
  totalTasksDone: number
  totalTasksActive: number
  streak: number
}

interface TagStat {
  name: string
  count: number
  color: string
}

function formatLocalDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function useCountUp(target: number, duration = 600): number {
  const [value, setValue] = useState(0)
  const startTime = useRef<number | null>(null)
  const frameRef = useRef<number>()

  useEffect(() => {
    if (target === 0) { setValue(0); return }
    startTime.current = null

    const animate = (time: number): void => {
      if (!startTime.current) startTime.current = time
      const progress = Math.min((time - startTime.current) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(eased * target))
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate)
      }
    }
    frameRef.current = requestAnimationFrame(animate)
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current) }
  }, [target, duration])

  return value
}

function StatCard({
  icon: Icon,
  label,
  value,
  suffix,
  color,
  trend,
  trendValue,
  delay = 0
}: {
  icon: typeof Flame
  label: string
  value: number
  suffix?: string
  color: string
  trend?: 'up' | 'down'
  trendValue?: number
  delay?: number
}): JSX.Element {
  const displayValue = useCountUp(value)

  return (
    <div
      className="flex items-start gap-2.5 p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm hover:shadow-md transition-all duration-300"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className={`p-2 rounded-lg ${color} shrink-0`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <p className="text-xl font-bold text-gray-900 dark:text-white tabular-nums">
            {displayValue}
          </p>
          {suffix && (
            <span className="text-xs text-gray-500 dark:text-gray-400">{suffix}</span>
          )}
        </div>
        <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">{label}</p>
        
        {trend && trendValue !== undefined && (
          <div className="flex items-center gap-2 mt-2">
            <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${
              trend === 'up' 
                ? 'text-green-600 dark:text-green-400' 
                : 'text-red-600 dark:text-red-400'
            }`}>
              {trend === 'up' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {trend === 'up' ? '+' : ''}{trendValue}%
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

function BarChart({ data }: { data: DailyStats[] }): JSX.Element {
  const chartData = data && data.length > 0 ? data : []
  const maxVal = Math.max(...chartData.map((d) => Math.max(d.log_count, d.task_completed)), 1)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    setVisible(false)
    const timer = setTimeout(() => setVisible(true), 100)
    return () => clearTimeout(timer)
  }, [chartData.length])

  const yMax = Math.ceil(maxVal * 1.2 / 5) * 5 || 5
  const yTickCount = Math.max(3, Math.min(6, Math.floor(yMax / 5) + 1))
  const yStep = yMax / (yTickCount - 1)
  const yTicks = Array.from({ length: yTickCount }, (_, i) => Math.round(i * yStep))

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex items-center justify-between mb-2 shrink-0">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">任务统计</h3>
          <Info className="w-3.5 h-3.5 text-gray-400" />
        </div>
        <span className="text-[10px] text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
          共 {chartData.length} 天
        </span>
      </div>

      <div className="relative flex-1 min-h-0 ml-7 mr-2">
        <div className="absolute left-0 top-0 bottom-4 w-6 flex flex-col justify-between text-[10px] text-gray-400 dark:text-gray-500 pr-1">
          {yTicks.slice().reverse().map((tick) => (
            <span key={tick} className="text-right leading-none -translate-y-1/2">{tick}</span>
          ))}
        </div>

        <div className="absolute left-0 right-0 bottom-4 h-px bg-gray-200 dark:bg-gray-600" />

        <div className="ml-6 h-full w-full flex items-end gap-[1px] px-[2px]">
          {chartData.length > 0 ? chartData.map((d, i) => {
            const logH = (d.log_count / yMax) * 100
            const taskH = (d.task_completed / yMax) * 100
            
            const day = new Date(d.date + 'T00:00:00')
            const label = `${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`
            const isToday = d.date === formatLocalDate(new Date())

            return (
              <div 
                key={d.date} 
                className="flex-1 flex flex-col items-center group relative rounded px-1 -mx-1 hover:bg-[#FAFBFC] dark:hover:bg-[#1E293B]/30 transition-all duration-200"
                style={{ height: '100%' }}
              >
                <div 
                  className="w-full flex items-end justify-center gap-[2px]"
                  style={{ height: 'calc(100% - 16px)' }}
                >
                  <div 
                    className="w-[45%] bg-blue-500 dark:bg-blue-400 rounded-t transition-all duration-300 ease-out hover:bg-blue-600"
                    style={{
                      height: `${Math.max(logH, d.log_count > 0 ? 4 : 0)}%`,
                      minHeight: d.log_count > 0 ? '8px' : '0',
                      transitionDelay: `${Math.min(i * 15, 300)}ms`,
                      opacity: visible ? 1 : 0
                    }}
                  />
                  <div 
                    className="w-[45%] bg-green-500 dark:bg-green-400 rounded-t transition-all duration-300 ease-out hover:bg-green-600"
                    style={{
                      height: `${Math.max(taskH, d.task_completed > 0 ? 4 : 0)}%`,
                      minHeight: d.task_completed > 0 ? '8px' : '0',
                      transitionDelay: `${Math.min(i * 15 + 50, 350)}ms`,
                      opacity: visible ? 1 : 0
                    }}
                  />
                </div>

                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 whitespace-nowrap">
                  <span className={`text-[8px] leading-none ${
                    isToday ? 'text-blue-600 dark:text-blue-400 font-semibold' : 'text-gray-400 dark:text-gray-500'
                  }`}>
                    {label}
                  </span>
                </div>

                <div className="absolute inset-x-0 top-0 pointer-events-none z-[9999]">
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-gray-900 dark:bg-gray-700 text-white text-[10px] rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-auto">
                    {label}<br/>
                    <span className="inline-block w-1.5 h-1.5 bg-blue-500 rounded-full mr-1 align-middle" />{d.log_count} 日志<br/>
                    <span className="inline-block w-1.5 h-1.5 bg-green-500 rounded-full mr-1 align-middle" />{d.task_completed} 任务
                  </div>
                </div>
              </div>
            )
          }) : (
            <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
              暂无数据
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-6 mt-1 text-[10px] text-gray-500 dark:text-gray-400 shrink-0">
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm bg-blue-500" />
          日志数
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm bg-green-500" />
          完成任务数
        </span>
      </div>
    </div>
  )
}

function HeatMap({ data }: { data: DailyStats[] }): JSX.Element {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const dataMap = new Map(data.map((d) => [d.date, d.log_count + d.task_completed]))
  
  const weeks: { date: Date; count: number }[][] = []
  const startDay = new Date(today)
  startDay.setDate(startDay.getDate() - 83)
  startDay.setDate(startDay.getDate() - startDay.getDay())

  let currentWeek: { date: Date; count: number }[] = []
  for (let d = new Date(startDay); d <= today; d.setDate(d.getDate() + 1)) {
    const dateStr = formatLocalDate(d)
    currentWeek.push({ date: new Date(d), count: dataMap.get(dateStr) || 0 })
    if (currentWeek.length === 7) {
      weeks.push(currentWeek)
      currentWeek = []
    }
  }
  if (currentWeek.length) weeks.push(currentWeek)

  const getColor = (count: number): string => {
    if (count === 0) return 'bg-gray-100 dark:bg-gray-800'
    if (count <= 2) return 'bg-green-200 dark:bg-green-900/50'
    if (count <= 5) return 'bg-green-400 dark:bg-green-700'
    return 'bg-green-600 dark:bg-green-500'
  }

  const monthLabels = useMemo(() => {
    const months: Set<string> = new Set()
    weeks.forEach((week) => {
      if (week.length > 0) {
        const month = week[0].date.toLocaleDateString('zh-CN', { month: 'short' })
        months.add(month)
      }
    })
    return Array.from(months)
  }, [weeks])

  const weekDays = ['一', '二', '三', '四', '五', '六', '日']

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm p-4 min-h-[280px] flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">活跃度热力图（近12周）</h3>
          <Info className="w-3.5 h-3.5 text-gray-400" />
        </div>
        <select className="text-xs px-2 py-1 border border-gray-200 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option>近12周</option>
          <option>近24周</option>
          <option>近一年</option>
        </select>
      </div>

      <div className="overflow-x-auto overflow-visible pb-2">
        <div className="inline-block min-w-full relative">
          <div className="flex">
            <div className="flex flex-col gap-1 mr-2 pt-5 shrink-0">
              {weekDays.map((day) => (
                <div key={day} className="w-4 h-3 flex items-center justify-center text-[10px] text-gray-400 dark:text-gray-500">
                  {day}
                </div>
              ))}
            </div>

            <div className="flex gap-1">
              {weeks.map((week, wi) => (
                <div key={wi} className="flex flex-col gap-1">
                  {week.map((day) => (
                    <div
                      key={formatLocalDate(day.date)}
                      className={`w-3.5 h-3.5 rounded-sm ${getColor(day.count)} transition-all duration-200 hover:scale-125 hover:z-50 cursor-pointer relative`}
                    >
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-1.5 py-0.5 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-[10px] rounded shadow-lg opacity-0 hover:opacity-100 transition-opacity whitespace-nowrap z-[100] pointer-events-none">
                        {formatLocalDate(day.date)}: {day.count}项
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          <div className="flex ml-8 mt-2 gap-8">
            <div className="flex gap-1">
              {monthLabels.map((month) => (
                <span key={month} className="text-[10px] text-gray-400 dark:text-gray-500 min-w-[40px]">
                  {month}
                </span>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-1.5 mt-3 text-[10px] text-gray-400 dark:text-gray-500">
            <span>少</span>
            <span className="w-3.5 h-3.5 rounded-sm bg-gray-100 dark:bg-gray-800" />
            <span className="w-3.5 h-3.5 rounded-sm bg-green-200 dark:bg-green-900/50" />
            <span className="w-3.5 h-3.5 rounded-sm bg-green-400 dark:bg-green-700" />
            <span className="w-3.5 h-3.5 rounded-sm bg-green-600 dark:bg-green-500" />
            <span>多</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function TagUsageChart({ 
  tags, 
  filterDateRange 
}: { 
  tags: TagStat[]; 
  filterDateRange?: { start: string; end: string };
}): JSX.Element {
  const [expanded, setExpanded] = useState(false)
  const [hoveredTag, setHoveredTag] = useState<{ name: string; count: number; x: number; y: number } | null>(null)
  
  const displayData = tags.length > 0 ? tags : []
  const maxCount = Math.max(...displayData.map(t => t.count), 1)
  const displayTags = expanded ? displayData : displayData.slice(0, 11)
  const showMoreButton = displayData.length > 8

  const handleMouseEnter = (tag: TagStat, e: React.MouseEvent) => {
    const rect = (e.target as HTMLElement).getBoundingClientRect()
    setHoveredTag({
      name: tag.name,
      count: tag.count,
      x: rect.left + rect.width / 2,
      y: rect.top
    })
  }

  const handleMouseLeave = () => {
    setHoveredTag(null)
  }

  return (
    <div className="flex flex-col min-h-0">
      <div className="flex items-center justify-between mb-2.5 shrink-0">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">标签使用统计</h3>
          <Info className="w-3.5 h-3.5 text-gray-400" />
        </div>
        <span className="text-[10px] text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
          {displayData.length} 个标签
        </span>
      </div>

      <div className="flex-1 min-h-0 tag-scroll-container space-y-1">
        {displayTags.length > 0 ? displayTags.map((tag, index) => {
          const colors = getTagColors(tag.name)
          const percentage = (tag.count / maxCount) * 100
          
          return (
            <div 
              key={tag.name} 
              className="group cursor-pointer rounded px-2 py-1 -mx-2 hover:bg-[#FAFBFC] dark:hover:bg-[#1E293B]/30 transition-all duration-200"
              onMouseEnter={(e) => handleMouseEnter(tag, e)}
              onMouseLeave={handleMouseLeave}
            >
              <div className="flex items-center gap-2">
                <div className="w-[72px] shrink-0 flex justify-start">
                  <span
                    className="inline-flex items-center px-1 py-0.5 rounded text-[11px] font-medium max-w-full truncate"
                    style={{ backgroundColor: colors.bg, color: colors.text }}
                    title={tag.name}
                  >
                    {tag.name.length > 7 ? tag.name.slice(0, 7) + '...' : tag.name}
                  </span>
                </div>
                <div className="flex-1 h-3.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden relative min-w-0">
                  <div
                    className="h-full rounded-full transition-all duration-300 ease-out relative overflow-hidden"
                    style={{
                      width: `${percentage}%`,
                      backgroundColor: colors.bg
                    }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                  </div>
                  
                  {percentage >= 10 && (
                    <span 
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] font-semibold opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                      style={{ color: colors.text }}
                    >
                      {Math.round(percentage)}%
                    </span>
                  )}
                </div>
                <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 tabular-nums text-right shrink-0 w-5">
                  {tag.count}
                </span>
              </div>
            </div>
          )
        }) : (
          <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
            暂无数据
          </div>
        )}
      </div>

      {hoveredTag && (
        <div 
          className="fixed px-2 py-1 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-[10px] rounded shadow-xl whitespace-nowrap z-[99999] pointer-events-none"
          style={{ 
            left: `${hoveredTag.x}px`, 
            top: `${hoveredTag.y - 28}px`,
            transform: 'translateX(-50%)'
          }}
        >
          {hoveredTag.name}: {hoveredTag.count}次
        </div>
      )}

      {showMoreButton && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full mt-3 py-2 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors duration-200 shrink-0"
        >
          {expanded ? '↑ 收起' : '↓ 查看更多'}
        </button>
      )}
    </div>
  )
}

function TaskTrendChart({ data }: { data: { date: string; completed: number }[] }): JSX.Element {
  const [period, setPeriod] = useState('按周')
  const maxValue = Math.max(...data.map(d => d.completed), 1)
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        setDimensions({
          width: rect.width - 48,
          height: rect.height - 40
        })
      }
    }

    updateDimensions()
    window.addEventListener('resize', updateDimensions)
    return () => window.removeEventListener('resize', updateDimensions)
  }, [])

  const padding = { top: 20, right: 20, bottom: 30, left: 40 }
  const chartWidth = dimensions.width - padding.left - padding.right
  const chartHeight = dimensions.height - padding.top - padding.bottom

  const getX = (index: number) => padding.left + (index / Math.max(data.length - 1, 1)) * chartWidth
  const getY = (value: number) => padding.top + chartHeight - (value / maxValue) * chartHeight

  const linePath = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(d.completed)}`).join(' ')
  const areaPath = `${linePath} L ${getX(data.length - 1)} ${padding.top + chartHeight} L ${getX(0)} ${padding.top + chartHeight} Z`

  const yTicks = [0, 10, 20, 30, 40].filter(v => v <= maxValue * 1.1)

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm p-4 min-h-[280px] flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">任务完成趋势</h3>
          <Info className="w-3.5 h-3.5 text-gray-400" />
        </div>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="text-xs px-2 py-1 border border-gray-200 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option>按周</option>
          <option>按月</option>
          <option>按季度</option>
        </select>
      </div>

      <div ref={containerRef} className="relative flex-1">
        {dimensions.width > 0 && (
          <svg width={dimensions.width} height={dimensions.height} className="overflow-visible">
            <defs>
              <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.2" />
                <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0" />
              </linearGradient>
            </defs>

            {yTicks.map((tick) => (
              <g key={tick}>
                <line
                  x1={padding.left}
                  y1={getY(tick)}
                  x2={padding.left + chartWidth}
                  y2={getY(tick)}
                  stroke="#E5E7EB"
                  strokeWidth="1"
                  strokeDasharray="4,4"
                  className="dark:stroke-gray-700"
                />
                <text
                  x={padding.left - 8}
                  y={getY(tick) + 4}
                  textAnchor="end"
                  className="fill-gray-400 dark:fill-gray-500"
                  fontSize="11"
                >
                  {tick}
                </text>
              </g>
            ))}

            <path
              d={areaPath}
              fill="url(#areaGradient)"
            />

            <path
              d={linePath}
              fill="none"
              stroke="#8B5CF6"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {data.map((d, i) => {
              const cx = getX(i)
              const cy = getY(d.completed)
              return (
                <g key={i}>
                  <circle
                    cx={cx}
                    cy={cy}
                    r="5"
                    fill="white"
                    stroke="#8B5CF6"
                    strokeWidth="2.5"
                    className="cursor-pointer transition-all hover:r-7"
                  >
                    <title>{`${d.date}: ${d.completed}个任务`}</title>
                  </circle>
                  <text
                    x={cx}
                    y={cy - 12}
                    textAnchor="middle"
                    className="fill-gray-600 dark:fill-gray-400"
                    fontSize="11"
                    fontWeight="500"
                  >
                    {d.completed}
                  </text>
                </g>
              )
            })}

            {data.map((d, i) => {
              const x = getX(i)
              return (
                <text
                  key={`label-${i}`}
                  x={x}
                  y={padding.top + chartHeight + 20}
                  textAnchor="middle"
                  className="fill-gray-400 dark:fill-gray-500"
                  fontSize="10"
                >
                  {d.date}
                </text>
              )
            })}
          </svg>
        )}
      </div>
    </div>
  )
}

function StatsPage(): JSX.Element {
  const [fullStats, setFullStats] = useState<Stats | null>(null)
  const [filteredStats, setFilteredStats] = useState<Stats | null>(null)
  const [selectedRange, setSelectedRange] = useState<string>('近7天')
  const [customStartDate, setCustomStartDate] = useState<string>('')
  const [customEndDate, setCustomEndDate] = useState<string>('')
  const logs = useWorkLogStore(s => s.logs)
  const tasks = useTaskStore(s => s.tasks)
  const { t } = useI18n()

  useEffect(() => {
    window.api.stats.get().then(setFullStats)
  }, [])

  const handleFilterChange = () => {
    if (selectedRange === '自定义' && customStartDate && customEndDate) {
      window.api.stats.get(customStartDate, customEndDate).then(setFilteredStats)
    } else {
      const days = getDaysFromRange(selectedRange)
      window.api.stats.get(days).then(setFilteredStats)
    }
  }

  useEffect(() => {
    handleFilterChange()
  }, [selectedRange, customStartDate, customEndDate])

  const getDaysFromRange = (range: string): number => {
    switch (range) {
      case '近7天':
        return 7
      case '近15天':
        return 15
      case '近30天':
        return 30
      case '自定义':
        if (customStartDate && customEndDate) {
          const start = new Date(customStartDate)
          const end = new Date(customEndDate)
          const diffTime = Math.abs(end.getTime() - start.getTime())
          return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1
        }
        return 7
      default:
        return 7
    }
  }

  const resetFilter = () => {
    setSelectedRange('近7天')
    setCustomStartDate('')
    setCustomEndDate('')
    setFilteredStats(null)
  }

  const getFilterDisplayText = (): string => {
    if (selectedRange === '自定义' && customStartDate && customEndDate) {
      if (customStartDate === customEndDate) {
        return customStartDate
      }
      return `${customStartDate} 至 ${customEndDate}`
    }
    return selectedRange
  }

  const isFilterActive: boolean = (() => {
    if (selectedRange !== '近7天') return true
    if (customStartDate || customEndDate) return true
    return false
  })()

  const getFilteredTagStats = useMemo<TagStat[]>(() => {
    if (!logs || !tasks) return []

    const tagMap = new Map<string, number>()

    if (selectedRange === '自定义' && customStartDate && customEndDate) {
      const start = new Date(customStartDate)
      const end = new Date(customEndDate)
      end.setHours(23, 59, 59, 999)

      logs.forEach(log => {
        const logDate = new Date(log.created_at)
        if (logDate >= start && logDate <= end) {
          log.categories?.forEach(cat => {
            tagMap.set(cat, (tagMap.get(cat) || 0) + 1)
          })
        }
      })

      tasks.forEach(task => {
        if (task.completed_at) {
          const taskDate = new Date(task.completed_at)
          if (taskDate >= start && taskDate <= end) {
            task.categories?.forEach(cat => {
              tagMap.set(cat, (tagMap.get(cat) || 0) + 1)
            })
          }
        }
      })
    } else {
      logs.forEach(log => {
        log.categories?.forEach(cat => {
          tagMap.set(cat, (tagMap.get(cat) || 0) + 1)
        })
      })

      tasks.forEach(task => {
        task.categories?.forEach(cat => {
          tagMap.set(cat, (tagMap.get(cat) || 0) + 1)
        })
      })
    }

    return Array.from(tagMap.entries())
      .map(([name, count]) => ({ name, count, color: '' }))
      .sort((a, b) => b.count - a.count)
  }, [logs, tasks, selectedRange, customStartDate, customEndDate])

  const getFilledDailyStats = (stats: Stats | null): DailyStats[] => {
    if (!stats?.daily || stats.daily.length === 0) return []

    let startDate: Date
    let endDate: Date

    if (selectedRange === '自定义' && customStartDate && customEndDate) {
      startDate = new Date(customStartDate)
      endDate = new Date(customEndDate)
    } else {
      const days = getDaysFromRange(selectedRange)
      endDate = new Date()
      endDate.setHours(0, 0, 0, 0)
      startDate = new Date(endDate)
      startDate.setDate(startDate.getDate() - days + 1)
    }

    const filled: DailyStats[] = []
    const dailyMap = new Map(stats.daily.map(d => [d.date, d]))

    const current = new Date(startDate)
    while (current <= endDate) {
      const dateStr = formatLocalDate(current)
      const existing = dailyMap.get(dateStr)
      filled.push(existing || { date: dateStr, log_count: 0, task_completed: 0 })
      current.setDate(current.getDate() + 1)
    }

    return filled
  }

  const taskTrendData = useMemo(() => {
    const weeklyData: { date: string; completed: number }[] = []
    const today = new Date()

    for (let i = 11; i >= 0; i--) {
      const weekStart = new Date(today)
      weekStart.setDate(weekStart.getDate() - (i * 7))
      weekStart.setDate(weekStart.getDate() - weekStart.getDay())
      
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekEnd.getDate() + 6)

      const completedInWeek = tasks.filter(task => {
        if (!task.completed_at) return false
        const completedDate = new Date(task.completed_at)
        return completedDate >= weekStart && completedDate <= weekEnd
      }).length

      const month = weekStart.getMonth() + 1
      const day = weekStart.getDate()
      const endMonth = weekEnd.getMonth() + 1
      const endDay = weekEnd.getDate()

      weeklyData.push({
        date: `${month}.${day}-${endMonth}.${endDay}`,
        completed: completedInWeek
      })
    }

    return weeklyData
  }, [tasks])

  const stats = filteredStats || fullStats

  if (!fullStats) {
    return (
      <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">{t('stats.title')}</h2>
            </div>
            <select 
              disabled
              className="text-sm px-3 py-1.5 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 opacity-50 cursor-not-allowed"
            >
              <option>近7天</option>
            </select>
          </div>
        </div>

        <div className="flex-1 overflow-hidden p-6">
          <div className="w-full max-w-none flex flex-col gap-5 h-full">
            <div className="grid grid-cols-4 gap-4 shrink-0">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-24 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl animate-pulse" />
              ))}
            </div>
            
            <div className="grid grid-cols-2 gap-5 flex-1 min-h-0">
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl animate-pulse flex-1 min-h-0" />
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl animate-pulse flex-1 min-h-0" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  const filledDailyStats = getFilledDailyStats(stats)

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">{t('stats.title')}</h2>
          </div>
          
          <div className="flex items-center gap-3">
            {isFilterActive && (
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center px-2 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-medium rounded-md">
                  筛选: {getFilterDisplayText()}
                </span>
                <button
                  onClick={resetFilter}
                  className="inline-flex items-center gap-1 px-2 py-0.5 text-xs text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                >
                  <X className="w-3 h-3" />
                  取消筛选
                </button>
              </div>
            )}
            
            <select 
              value={selectedRange}
              onChange={(e) => setSelectedRange(e.target.value)}
              className="text-sm px-3 py-1.5 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="近7天">近7天</option>
              <option value="近15天">近15天</option>
              <option value="近30天">近30天</option>
              <option value="自定义">自定义</option>
            </select>
            
            {selectedRange === '自定义' && (
              <div className="flex items-center gap-2">
                <div className="relative">
                  <CalendarIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="pl-9 pr-3 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <span className="text-sm text-gray-500 dark:text-gray-400">至</span>
                <div className="relative">
                  <CalendarIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="pl-9 pr-3 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden p-5">
        <div className="w-full max-w-none flex flex-col gap-5 h-full">
          <div className="grid grid-cols-4 gap-4 shrink-0">
            <StatCard
              icon={Calendar}
              label="连续记录天数"
              value={fullStats.streak}
              suffix="天"
              color="bg-blue-50 dark:bg-blue-900/30 text-blue-600"
              delay={0}
            />
            <StatCard
              icon={FileText}
              label="总日志数"
              value={fullStats.totalLogs}
              suffix="条"
              color="bg-green-50 dark:bg-green-900/30 text-green-600"
              trend="up"
              trendValue={18}
              delay={60}
            />
            <StatCard
              icon={CheckCircle2}
              label="已完成任务数"
              value={fullStats.totalTasksDone}
              suffix="个"
              color="bg-purple-50 dark:bg-purple-900/30 text-purple-600"
              trend="up"
              trendValue={20}
              delay={120}
            />
            <StatCard
              icon={ListTodo}
              label="进行中任务数"
              value={fullStats.totalTasksActive}
              suffix="个"
              color="bg-orange-50 dark:bg-orange-900/30 text-orange-600"
              trend="down"
              trendValue={11}
              delay={180}
            />
          </div>

          <div className="grid grid-cols-2 gap-5 flex-1 min-h-0">
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm p-4 flex flex-col min-h-0">
              <TagUsageChart 
                tags={getFilteredTagStats} 
                filterDateRange={selectedRange === '自定义' && customStartDate && customEndDate ? { start: customStartDate, end: customEndDate } : undefined}
              />
            </div>
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm p-4 flex flex-col min-h-0">
              <BarChart data={filledDailyStats} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default StatsPage