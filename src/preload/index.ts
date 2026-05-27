import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

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

const noUpdateState: AppUpdateState = { status: 'not_available', currentVersion: '' }

const api = {
  app: {
    setLanguage: (language: AppLanguage) => ipcRenderer.invoke('app:language:update', language),
    getVersion: () => ipcRenderer.invoke('app:get-version') as Promise<string>,
    getDataPath: () => ipcRenderer.invoke('app:get-data-path') as Promise<string>,
    getUpdateState: () => Promise.resolve(noUpdateState),
    checkForUpdates: () => Promise.resolve(noUpdateState),
    installUpdate: () => Promise.resolve(false)
  },
  worklog: {
    add: (content: string, categories?: string[], note?: string) =>
      ipcRenderer.invoke('worklog:add', content, categories, note),
    list: (limit?: number, offset?: number) =>
      ipcRenderer.invoke('worklog:list', limit, offset),
    byDateRange: (from: string, to: string) =>
      ipcRenderer.invoke('worklog:byDateRange', from, to),
    search: (keyword: string) => ipcRenderer.invoke('worklog:search', keyword),
    categories: () => ipcRenderer.invoke('worklog:categories') as Promise<string[]>,
    setCategories: (id: number, categories: string[]) =>
      ipcRenderer.invoke('worklog:setCategories', id, categories),
    delete: (id: number) => ipcRenderer.invoke('worklog:delete', id),
    restore: (log: { content: string; categories: string[]; created_at: string; task_id: number | null; note?: string }) =>
      ipcRenderer.invoke('worklog:restore', log)
  },
  task: {
    add: (title: string, description?: string, status?: 'todo' | 'draft', categories?: string[]) =>
      ipcRenderer.invoke('task:add', title, description, status, categories),
    list: () => ipcRenderer.invoke('task:list'),
    update: (id: number, updates: Record<string, unknown>) =>
      ipcRenderer.invoke('task:update', id, updates),
    delete: (id: number) => ipcRenderer.invoke('task:delete', id),
    reorder: (taskIds: number[], status: string) =>
      ipcRenderer.invoke('task:reorder', taskIds, status),
    complete: (id: number, logContent: string) =>
      ipcRenderer.invoke('task:complete', id, logContent)
  },
  stats: {
    get: (startDate?: string | number, endDate?: string) => ipcRenderer.invoke('stats:get', startDate, endDate)
  },
  report: {
    generate: (dateFrom: string, dateTo: string) =>
      ipcRenderer.invoke('report:generate', dateFrom, dateTo),
    list: (limit?: number) => ipcRenderer.invoke('report:list', limit),
    update: (id: number, content: string) =>
      ipcRenderer.invoke('report:update', id, content),
    delete: (id: number) => ipcRenderer.invoke('report:delete', id)
  },
  ai: {
    optimizeLog: (content: string) => ipcRenderer.invoke('ai:optimizeLog', content)
  },
  settings: {
    get: (key: string) => ipcRenderer.invoke('settings:get', key),
    set: (key: string, value: string) => ipcRenderer.invoke('settings:set', key, value),
    delete: (key: string) => ipcRenderer.invoke('settings:delete', key)
  },
  shortcut: {
    update: (key: string, value: string) => ipcRenderer.invoke('shortcut:update', key, value)
  },
  export: {
    logs: (format: 'csv' | 'markdown', logIds?: number[]) =>
      ipcRenderer.invoke('export:logs', format, logIds),
    report: (content: string, dateRange: string) =>
      ipcRenderer.invoke('export:report', content, dateRange)
  },
  tag: {
    all: () => ipcRenderer.invoke('tag:all') as Promise<string[]>,
    recent: (limit?: number) => ipcRenderer.invoke('tag:recent', limit) as Promise<string[]>,
    create: (name: string) => ipcRenderer.invoke('tag:create', name),
    getColor: (tag: string) => ipcRenderer.invoke('tag:color:get', tag) as Promise<string>,
    setColor: (tag: string, color: string) => ipcRenderer.invoke('tag:color:set', tag, color),
    deleteColor: (tag: string) => ipcRenderer.invoke('tag:color:delete', tag)
  },
  quickCreate: {
    close: () => ipcRenderer.send('quick-create:close'),
    resize: (height: number) => ipcRenderer.send('quick-create:resize', height),
    onSetMode: (cb: (mode: QuickCreateType) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, mode: QuickCreateType): void => cb(mode)
      ipcRenderer.on('quick-create:set-mode', handler)
      return () => {
        ipcRenderer.removeListener('quick-create:set-mode', handler)
      }
    }
  },
  on: {
    quickCreate: (cb: (type: QuickCreateType) => void) => {
      const logHandler = (): void => cb('log')
      const taskHandler = (): void => cb('task')
      ipcRenderer.on('quick-create:log', logHandler)
      ipcRenderer.on('quick-create:task', taskHandler)
      return () => {
        ipcRenderer.removeListener('quick-create:log', logHandler)
        ipcRenderer.removeListener('quick-create:task', taskHandler)
      }
    },
    navigate: (cb: (page: NavigatePage) => void) => {
      const pages: NavigatePage[] = ['worklog', 'kanban', 'report', 'stats', 'settings']
      const handlers = pages.map((page) => {
        const handler = (): void => cb(page)
        ipcRenderer.on(`navigate:${page}`, handler)
        return { page, handler }
      })
      return () => {
        handlers.forEach(({ page, handler }) =>
          ipcRenderer.removeListener(`navigate:${page}`, handler)
        )
      }
    },
    updateStatus: (_cb: (state: AppUpdateState) => void) => {
      // Auto-update disabled, no events to listen for
      return () => {}
    }
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore
  window.electron = electronAPI
  // @ts-ignore
  window.api = api
}
