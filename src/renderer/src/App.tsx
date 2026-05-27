import { useState, useEffect, useCallback, useRef } from 'react'
import { Settings, FileText, ClipboardList, Columns3, BarChart3 } from 'lucide-react'
import WorkLogPage from './pages/WorkLogPage'
import ReportPage from './pages/ReportPage'
import KanbanPage from './pages/KanbanPage'
import StatsPage from './pages/StatsPage'
import SettingsPage from './pages/SettingsPage'
import { useToast } from './components/Toast'
import { useThemeStore } from './stores/themeStore'
import { useI18n, useLanguageStore } from './stores/languageStore'

type Page = 'worklog' | 'kanban' | 'report' | 'stats' | 'settings'

function App(): JSX.Element {
  const [currentPage, setCurrentPage] = useState<Page>('worklog')
  const initTheme = useThemeStore((s) => s.init)
  const initLanguage = useLanguageStore((s) => s.init)
  const { t } = useI18n()
  const toast = useToast()
  const updateDownloadedNotifiedRef = useRef(false)

  useEffect(() => {
    initTheme()
    initLanguage()
  }, [])

  useEffect(() => {
    const unsubscribe = window.api.on.updateStatus((state) => {
      if (state.status === 'downloaded' && !updateDownloadedNotifiedRef.current) {
        updateDownloadedNotifiedRef.current = true
        toast.success(t('settings.updateDownloaded'))
      }
    })

    return unsubscribe
  }, [t, toast])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey

      if (isMod && e.key === '1') {
        e.preventDefault(); setCurrentPage('worklog')
      } else if (isMod && e.key === '2') {
        e.preventDefault(); setCurrentPage('kanban')
      } else if (isMod && e.key === '3') {
        e.preventDefault(); setCurrentPage('report')
      } else if (isMod && e.key === '4') {
        e.preventDefault(); setCurrentPage('stats')
      } else if (isMod && e.key === ',') {
        e.preventDefault(); setCurrentPage('settings')
      } else if (e.key === 'Escape' && currentPage === 'settings') {
        setCurrentPage('worklog')
      }
    },
    [currentPage]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // Listen for IPC events from main process (menu bar / global shortcuts)
  useEffect(() => {
    const unsubNav = window.api.on.navigate((page) => {
      setCurrentPage(page)
    })
    return () => {
      unsubNav()
    }
  }, [])

  // Track page changes for transition direction
  const prevPageRef = useRef<Page>(currentPage)
  const [pageKey, setPageKey] = useState(0)

  useEffect(() => {
    if (prevPageRef.current !== currentPage) {
      prevPageRef.current = currentPage
      setPageKey((k) => k + 1)
    }
  }, [currentPage])

  if (currentPage === 'settings') {
    return <SettingsPage onBack={() => setCurrentPage('worklog')} />
  }

  const navBtn = (page: Page, icon: JSX.Element, label: string): JSX.Element => (
    <button
      onClick={() => setCurrentPage(page)}
      className={`group relative px-4 py-2.5 text-sm font-medium rounded-lg transition-all duration-150 ease-out ${
        currentPage === page
          ? 'bg-blue-500 text-white shadow-md'
          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-200'
      }`}
    >
      <span className="flex items-center gap-1.5">
        <span className={currentPage === page ? 'scale-110' : ''}>{icon}</span>
        {label}
      </span>
      {currentPage === page && (
        <span className="absolute inset-0 rounded-lg bg-blue-600 -z-10 animate-pulse-soft"></span>
      )}
    </button>
  )

  return (
    <div className="h-screen flex flex-col bg-white dark:bg-slate-950">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-slate-200/80 dark:border-slate-700/50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm shrink-0">
        {/* 左侧导航 - 四个页面按钮 */}
        <nav className="flex items-center gap-1">
          {navBtn('worklog', <ClipboardList className="w-4 h-4" />, t('nav.worklog'))}
          {navBtn('kanban', <Columns3 className="w-4 h-4" />, t('nav.kanban'))}
          {navBtn('report', <FileText className="w-4 h-4" />, t('nav.report'))}
          {navBtn('stats', <BarChart3 className="w-4 h-4" />, t('nav.stats'))}
        </nav>

        {/* 右侧设置按钮 */}
        <button
          onClick={() => setCurrentPage('settings')}
          className="p-2.5 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/50 rounded-lg transition-all duration-150 settings-spin"
          aria-label={t('nav.settings')}
        >
          <Settings className="w-5 h-5" />
        </button>
      </header>

      {/* Content - 自适应满区域 */}
      <main className="flex-1 min-h-0 overflow-hidden">
        <div key={pageKey} className="h-full page-enter">
          {currentPage === 'worklog' && <WorkLogPage />}
          {currentPage === 'kanban' && <KanbanPage />}
          {currentPage === 'report' && <ReportPage />}
          {currentPage === 'stats' && <StatsPage />}
        </div>
      </main>
    </div>
  )
}

export default App
