import { useEffect, useRef, useState, useCallback } from 'react'
import { ClipboardList, Columns3, Plus } from 'lucide-react'
import { useToast } from './Toast'
import { useI18n } from '../stores/languageStore'
import { TagSelector } from './TagSelector'

type Mode = 'log' | 'task'

interface RecentItem {
  id: number
  content: string
  time: string
  type: 'log' | 'task'
  categories: string[]
}

interface Props {
  initialMode: Mode
  onClose: () => void
}

export function QuickCreate({ initialMode, onClose }: Props): JSX.Element {
  const [mode, setMode] = useState<Mode>(initialMode)
  const [value, setValue] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [recentItems, setRecentItems] = useState<RecentItem[]>([])
  const [tagDropdownOpen, setTagDropdownOpen] = useState(false)
  const [isDark, setIsDark] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const toast = useToast()
  const { t } = useI18n()
  
  // 检测当前主题
  useEffect(() => {
    const checkDarkMode = () => {
      const isDarkMode = document.documentElement.classList.contains('dark') ||
        window.matchMedia('(prefers-color-scheme: dark)').matches
      setIsDark(isDarkMode)
    }
    
    checkDarkMode()
    
    // 监听主题变化
    const observer = new MutationObserver(checkDarkMode)
    observer.observe(document.documentElement, { 
      attributes: true, 
      attributeFilter: ['class'] 
    })
    
    return () => observer.disconnect()
  }, [])

  const parseCategory = useCallback((text: string): { content: string; category: string } => {
    const match = text.match(/#(\S+)\s*/)
    if (match) {
      return { content: text.replace(match[0], '').trim(), category: match[1] }
    }
    return { content: text, category: '' }
  }, [])

  // Function to resize window based on content
  const resizeWindow = useCallback(() => {
    // Give multiple animation frames for rendering to complete
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const quickCreateEl = document.querySelector('.quick-create-container')
        let contentHeight = 0
        
        if (quickCreateEl) {
          contentHeight = quickCreateEl.getBoundingClientRect().height
        } else {
          const body = document.body
          const html = document.documentElement
          contentHeight = Math.max(
            body.scrollHeight,
            body.offsetHeight,
            html.clientHeight,
            html.scrollHeight,
            html.offsetHeight
          )
        }
        
        // Extra space for tag dropdown when open
        const dropdownExtra = tagDropdownOpen ? 220 : 0
        // Send to main process with padding
        window.api.quickCreate?.resize?.(Math.ceil(contentHeight) + 38 + dropdownExtra)
      })
    })
  }, [tagDropdownOpen])

  useEffect(() => {
    inputRef.current?.focus()
    // Resize on initial load
    resizeWindow()
  }, [resizeWindow])

  useEffect(() => {
    inputRef.current?.focus()
    // Resize when mode changes
    resizeWindow()
  }, [mode, resizeWindow])

  useEffect(() => {
    // Resize when selected tags change
    resizeWindow()
  }, [selectedTags, recentItems, resizeWindow])

  useEffect(() => {
    const fetchRecentItems = async (): Promise<void> => {
      try {
        if (mode === 'log') {
          const logs = await window.api.worklog.list(3, 0)
          const recentLogs: RecentItem[] = logs.map(log => ({
            id: log.id,
            content: log.content,
            time: new Date(log.created_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
            type: 'log' as const,
            categories: log.categories || (log.category ? [log.category] : [])
          }))
          setRecentItems(recentLogs)
        } else {
          const tasks = await window.api.task.list()
          const completedTasks: RecentItem[] = tasks
            .filter(task => task.status === 'done' && task.completed_at)
            .sort((a, b) => new Date(b.completed_at!).getTime() - new Date(a.completed_at!).getTime())
            .slice(0, 3)
            .map(task => ({
              id: task.id,
              content: task.title,
              time: new Date(task.completed_at!).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
              type: 'task' as const,
              categories: task.categories || (task.category ? [task.category] : [])
            }))
          setRecentItems(completedTasks)
        }
      } catch (error) {
        console.error('Failed to fetch recent items:', error)
      }
    }

    fetchRecentItems()
  }, [mode])

  const handleSubmit = useCallback(async (): Promise<void> => {
    const trimmed = value.trim()
    if (!trimmed) return
    setSubmitting(true)
    try {
      if (mode === 'log') {
        const { content, category: parsedCategory } = parseCategory(trimmed)
        const categories = selectedTags.length > 0 ? selectedTags : (parsedCategory ? [parsedCategory] : [])
        await window.api.worklog.add(content, categories)
        toast.success(t('quick.logSaved'))
      } else {
        await window.api.task.add(trimmed, undefined, undefined, selectedTags)
        toast.success(t('quick.taskSaved'))
      }
      onClose()
    } finally {
      setSubmitting(false)
    }
  }, [value, mode, selectedTags, parseCategory, toast, t, onClose])

  const handleKeyDown = useCallback((e: React.KeyboardEvent): void => {
    if (e.key === 'Enter') handleSubmit()
    if (e.key === 'Escape') onClose()
    if (e.key === 'Tab') {
      e.preventDefault()
      setMode((m) => (m === 'log' ? 'task' : 'log'))
      setValue('')
    }
  }, [handleSubmit, onClose])

  return (
    <div className="quick-create-container w-full">
      {/* 阴影容器 - 使用 drop-shadow 确保阴影跟随圆角 */}
      <div 
        className="w-full"
        style={{
          filter: isDark 
            ? 'drop-shadow(0 4px 24px rgba(0, 0, 0, 0.35))' 
            : 'drop-shadow(0 4px 16px rgba(0, 0, 0, 0.05))'
        }}
      >
        {/* 主内容容器 */}
        <div 
          className="flex flex-col bg-white dark:bg-slate-900 rounded-b-3xl border-b border-x border-slate-200 dark:border-slate-700 px-8 py-2 animate-fade-in-up"
          style={{
            overflow: 'hidden',
            backgroundClip: 'padding-box'
          }}
        >
          {/* Mode Tabs */}
          <div className="shrink-0 mb-1.5">
            <div className="flex bg-slate-100 dark:bg-slate-800 rounded-xl p-0.5 gap-1">
              <button
                onClick={() => { setMode('log'); setValue('') }}
                className={`flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm font-medium flex-1 rounded-lg transition-all duration-150 ${
                  mode === 'log'
                    ? 'text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-700 shadow-md'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/50'
                }`}
              >
                <ClipboardList className="w-3.5 h-3.5" />
                {t('quick.log')}
              </button>
              <button
                onClick={() => { setMode('task'); setValue('') }}
                className={`flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm font-medium flex-1 rounded-lg transition-all duration-150 ${
                  mode === 'task'
                    ? 'text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-700 shadow-md'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/50'
                }`}
              >
                <Columns3 className="w-3.5 h-3.5" />
                {t('quick.task')}
              </button>
            </div>
          </div>

          {/* Recent Items */}
          {recentItems.length > 0 && (
            <div className="shrink-0 mb-1.5">
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-2 border border-slate-200 dark:border-slate-700">
                <div className="space-y-1">
                  {recentItems.map((item) => (
                    <div key={`${item.type}-${item.id}`} className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                      <span className="shrink-0 text-slate-500 dark:text-slate-500 font-medium bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
                        {item.time}
                      </span>
                      <span className="truncate flex-1 min-w-0">
                        {item.content}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Input Section */}
          <div className="relative mb-1.5">
            <input
              ref={inputRef}
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={mode === 'log' ? t('quick.logPlaceholder') : t('quick.taskPlaceholder')}
              disabled={submitting}
              className="w-full px-3.5 py-2 text-base text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 
                overflow-y-hidden bg-white dark:bg-slate-800 
                border-2 border-slate-200 dark:border-slate-700 rounded-xl outline-none
                focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10
                hover:border-slate-300 dark:hover:border-slate-600
                disabled:opacity-50 transition-all duration-150"
              style={{ minHeight: '38px', maxHeight: '52px' }}
            />
          </div>

          {/* Tag Selector */}
          <div className="shrink-0 mb-1.5">
            <TagSelector
              selectedTags={selectedTags}
              onTagsChange={setSelectedTags}
              onDropdownChange={setTagDropdownOpen}
            />
          </div>

          {/* Footer */}
          <div className="shrink-0 flex items-center justify-between">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {t('quick.help')}
            </span>
            <button
              onClick={handleSubmit}
              disabled={!value.trim() || submitting}
              className="flex items-center justify-center gap-2 px-5 py-1.5 bg-blue-500 hover:bg-blue-600 active:bg-blue-700
                disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:cursor-not-allowed
                text-white text-sm font-semibold rounded-lg shadow-md hover:shadow-lg
                transition-all duration-150 shrink-0 btn-bounce"
            >
              {submitting ? (
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Plus className="w-3.5 h-3.5" />
              )}
              {mode === 'log' ? t('quick.submitLog') : t('common.add')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
