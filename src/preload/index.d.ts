import { ElectronAPI } from '@electron-toolkit/preload'

interface WorkLog {
  id: number
  content: string
  category: string
  categories: string[]
  note: string
  created_at: string
  task_id: number | null
}

interface Report {
  id: number
  type: string
  date_from: string
  date_to: string
  content: string
  generated_at: string
}

interface Task {
  id: number
  title: string
  description: string
  status: 'todo' | 'in_progress' | 'done' | 'draft'
  board_column: string
  position: number
  created_at: string
  updated_at: string
  completed_at: string | null
  due_date: string | null
  category: string
  categories: string[]
}

type QuickCreateType = 'log' | 'task'
type NavigatePage = 'worklog' | 'kanban' | 'report' | 'stats' | 'settings'
type AppLanguage = 'system' | 'zh' | 'en'
type UpdateStatus = 'idle' | 'checking' | 'available' | 'not_available' | 'downloading' | 'downloaded' | 'error'

interface AppUpdateState {
  status: UpdateStatus
  currentVersion: string
  version?: string
  releaseName?: string
  releaseDate?: string
  releaseNotes?: string
  releaseUrl?: string
  downloadUrl?: string
  progress?: number
  error?: string
  canInstall?: boolean
}

interface API {
  app: {
    setLanguage: (language: AppLanguage) => Promise<void>
    getVersion: () => Promise<string>
    getDataPath: () => Promise<string>
    getUpdateState: () => Promise<AppUpdateState>
    checkForUpdates: () => Promise<AppUpdateState>
    installUpdate: () => Promise<boolean>
  }
  on: {
    quickCreate: (cb: (type: QuickCreateType) => void) => () => void
    navigate: (cb: (page: NavigatePage) => void) => () => void
    updateStatus: (cb: (state: AppUpdateState) => void) => () => void
  }
  task: {
    add: (title: string, description?: string, status?: 'todo' | 'draft', categories?: string[]) => Promise<Task>
    list: () => Promise<Task[]>
    update: (id: number, updates: Partial<Pick<Task, 'title' | 'description' | 'status' | 'position' | 'due_date' | 'category'>> & { categories?: string[] }) => Promise<Task | null>
    delete: (id: number) => Promise<boolean>
    reorder: (taskIds: number[], status: string) => Promise<void>
    complete: (id: number, logContent: string) => Promise<Task | null>
  }
  worklog: {
    add: (content: string, categories?: string[], note?: string) => Promise<WorkLog>
    list: (limit?: number, offset?: number) => Promise<WorkLog[]>
    byDateRange: (from: string, to: string) => Promise<WorkLog[]>
    search: (keyword: string) => Promise<WorkLog[]>
    categories: () => Promise<string[]>
    setCategories: (id: number, categories: string[]) => Promise<void>
    delete: (id: number) => Promise<boolean>
    restore: (log: { content: string; categories: string[]; created_at: string; task_id: number | null; note: string }) => Promise<WorkLog>
  }
  stats: {
    get: (startDate?: string | number, endDate?: string) => Promise<{
      daily: { date: string; log_count: number; task_completed: number }[]
      totalLogs: number
      totalTasksDone: number
      totalTasksActive: number
      streak: number
    }>
  }
  report: {
    generate: (dateFrom: string, dateTo: string) => Promise<Report>
    list: (limit?: number) => Promise<Report[]>
    update: (id: number, content: string) => Promise<Report | null>
    delete: (id: number) => Promise<boolean>
  }
  ai: {
    optimizeLog: (content: string) => Promise<string>
  }
  settings: {
    get: (key: string) => Promise<string | null>
    set: (key: string, value: string) => Promise<void>
    delete: (key: string) => Promise<void>
  }
  shortcut: {
    update: (key: string, value: string) => Promise<boolean>
  }
  export: {
    logs: (format: 'csv' | 'markdown', logIds?: number[]) => Promise<string | null>
    report: (content: string, dateRange: string) => Promise<string | null>
  }
  tag: {
    all: () => Promise<string[]>
    recent: (limit?: number) => Promise<string[]>
    getColor: (tag: string) => Promise<string>
    setColor: (tag: string, color: string) => Promise<void>
    deleteColor: (tag: string) => Promise<void>
  }
  quickCreate: {
    close: () => void
    resize: (height: number) => void
    onSetMode: (cb: (mode: QuickCreateType) => void) => () => void
  }
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: API
  }
}
