import { ipcMain, dialog } from 'electron'
import { writeFileSync } from 'fs'
import {
  addWorkLog,
  getWorkLogs,
  getWorkLogsByDateRange,
  searchWorkLogs,
  getAllWorkLogs,
  getWorkLogsByIds,
  getStats,
  getStatsByDateRange,
  getStatsByDays,
  getCategories,
  updateWorkLogCategories,
  deleteWorkLog,
  restoreWorkLog,
  saveReport,
  getReports,
  updateReportContent,
  deleteReport,
  getSetting,
  setSetting,
  deleteSetting,
  addTask,
  getTasks,
  updateTask,
  deleteTask,
  reorderTasks,
  getAllTags,
  getRecentTags,
  getRecordTags,
  getRecordTagsBatch,
  getTagColor,
  setTagColor,
  deleteTagColor,
  createTag,
  type Task
} from './db'

// --- Input Validation ---

function assertPositiveInt(val: unknown, name: string): asserts val is number {
  if (typeof val !== 'number' || !Number.isInteger(val) || val < 0) {
    throw new Error(`Invalid ${name}: expected positive integer`)
  }
}

function assertNonEmptyString(val: unknown, name: string): asserts val is string {
  if (typeof val !== 'string' || val.trim().length === 0) {
    throw new Error(`Invalid ${name}: expected non-empty string`)
  }
}

function assertOptionalNumber(val: unknown, name: string): void {
  if (val !== undefined && val !== null && typeof val !== 'number') {
    throw new Error(`Invalid ${name}: expected number or undefined`)
  }
}

// --- Settings Whitelist ---

const ALLOWED_SETTINGS_KEYS = new Set([
  'ai_provider', 'ai_base_url', 'ai_model',
  'report_language', 'report_style', 'system_prompt',
  'user_prompt', 'report_template', 'optimize_language', 'optimize_prompt',
  'app_language', 'ai_auto_replace',
  'shortcut_quick_log', 'shortcut_quick_task'
])

function isAllowedSettingsKey(key: string): boolean {
  return ALLOWED_SETTINGS_KEYS.has(key)
}
import { generateReport, optimizeLog } from './ai'
import { deleteStoredApiKey, getStoredApiKey, setStoredApiKey } from './secureSettings'
import { tMain } from './i18n'

export function registerIpcHandlers(): void {
  // --- Work Logs ---

  ipcMain.handle('worklog:add', (_event, content: string, categories?: string[], note?: string) => {
    assertNonEmptyString(content, 'content')
    const log = addWorkLog(content, categories, undefined, undefined, note)
    return log ? { ...log, categories: getRecordTags('work_log', log.id) } : log
  })

  ipcMain.handle('worklog:list', (_event, limit?: number, offset?: number) => {
    assertOptionalNumber(limit, 'limit')
    assertOptionalNumber(offset, 'offset')
    const logs = getWorkLogs(limit, offset)
    if (logs.length === 0) return []
    const ids = logs.map(l => l.id)
    const tagsMap = getRecordTagsBatch('work_log', ids)
    return logs.map((l) => ({ ...l, categories: tagsMap.get(l.id) || [] }))
  })

  ipcMain.handle('worklog:byDateRange', (_event, from: string, to: string) => {
    assertNonEmptyString(from, 'from')
    assertNonEmptyString(to, 'to')
    const logs = getWorkLogsByDateRange(from, to)
    if (logs.length === 0) return []
    const ids = logs.map(l => l.id)
    const tagsMap = getRecordTagsBatch('work_log', ids)
    return logs.map((l) => ({ ...l, categories: tagsMap.get(l.id) || [] }))
  })

  ipcMain.handle('worklog:search', (_event, keyword: string) => {
    assertNonEmptyString(keyword, 'keyword')
    const logs = searchWorkLogs(keyword)
    if (logs.length === 0) return []
    const ids = logs.map(l => l.id)
    const tagsMap = getRecordTagsBatch('work_log', ids)
    return logs.map((l) => ({ ...l, categories: tagsMap.get(l.id) || [] }))
  })

  ipcMain.handle('worklog:categories', () => {
    return getCategories()
  })

  ipcMain.handle('worklog:setCategories', (_event, id: number, categories: string[]) => {
    assertPositiveInt(id, 'id')
    updateWorkLogCategories(id, categories)
  })

  ipcMain.handle('worklog:delete', (_event, id: number) => {
    assertPositiveInt(id, 'id')
    return deleteWorkLog(id)
  })

  ipcMain.handle(
    'worklog:restore',
    (_event, log: { content: string; categories: string[]; created_at: string; task_id: number | null; note: string }) => {
      const restored = restoreWorkLog(log)
      return restored ? { ...restored, categories: getRecordTags('work_log', restored.id) } : restored
    }
  )

  ipcMain.handle('stats:get', (_event, startDate?: string | number, endDate?: string) => {
    if (typeof startDate === 'number') {
      return getStatsByDays(startDate)
    }
    if (startDate && endDate) {
      return getStatsByDateRange(startDate, endDate)
    }
    return getStatsByDays(30)
  })

  // --- Reports ---

  ipcMain.handle(
    'report:generate',
    async (_event, dateFrom: string, dateTo: string) => {
      const logs = getWorkLogsByDateRange(dateFrom, dateTo)
      if (logs.length === 0) {
        throw new Error(tMain('noWorkLogsInRange'))
      }
      const allTasks = getTasks()
      const filteredTasks = allTasks.filter((task) => {
        if (task.status !== 'done') return true
        const completedDate = task.completed_at?.slice(0, 10)
        return Boolean(completedDate && completedDate >= dateFrom && completedDate <= dateTo)
      })
      const taskIds = filteredTasks.map(t => t.id)
      const taskTagsMap = taskIds.length > 0 ? getRecordTagsBatch('task', taskIds) : new Map<number, string[]>()
      const tasks = filteredTasks.map(task => ({
        title: task.title,
        description: task.description,
        status: task.status,
        due_date: task.due_date,
        completed_at: task.completed_at,
        categories: taskTagsMap.get(task.id) || []
      }))
      const content = await generateReport(logs, dateFrom, dateTo, tasks)
      const report = saveReport('custom', dateFrom, dateTo, content)
      return report
    }
  )

  // --- AI ---

  ipcMain.handle('ai:optimizeLog', async (_event, content: string) => {
    return await optimizeLog(content)
  })

  ipcMain.handle('report:list', (_event, limit?: number) => {
    return getReports(limit)
  })

  ipcMain.handle('report:update', (_event, id: number, content: string) => {
    assertPositiveInt(id, 'id')
    assertNonEmptyString(content, 'content')
    return updateReportContent(id, content)
  })

  ipcMain.handle('report:delete', (_event, id: number) => {
    assertPositiveInt(id, 'id')
    return deleteReport(id)
  })

  // --- Tasks ---

  ipcMain.handle('task:add', (_event, title: string, description?: string, status?: 'todo' | 'draft', categories?: string[]) => {
    assertNonEmptyString(title, 'title')
    const task = addTask(title, description, status, categories)
    return task ? { ...task, categories: getRecordTags('task', task.id) } : task
  })

  ipcMain.handle('task:list', () => {
    const tasks = getTasks()
    if (tasks.length === 0) return []
    const ids = tasks.map(t => t.id)
    const tagsMap = getRecordTagsBatch('task', ids)
    return tasks.map((t) => ({ ...t, categories: tagsMap.get(t.id) || [] }))
  })

  ipcMain.handle(
    'task:update',
    (
      _event,
      id: number,
      updates: Partial<Pick<Task, 'title' | 'description' | 'status' | 'position' | 'due_date' | 'category'>> & { categories?: string[] }
    ) => {
      assertPositiveInt(id, 'id')
      const task = updateTask(id, updates)
      return task ? { ...task, categories: getRecordTags('task', task.id) } : task
    }
  )

  ipcMain.handle('task:delete', (_event, id: number) => {
    assertPositiveInt(id, 'id')
    return deleteTask(id)
  })

  ipcMain.handle('task:reorder', (_event, taskIds: number[], status: string) => {
    if (!Array.isArray(taskIds)) throw new Error('Invalid taskIds: expected array')
    assertNonEmptyString(status, 'status')
    reorderTasks(taskIds, status)
  })

  // Complete task + auto create work log
  ipcMain.handle(
    'task:complete',
    (_event, id: number, logContent: string) => {
      assertPositiveInt(id, 'id')
      const categories = getRecordTags('task', id)
      const task = updateTask(id, { status: 'done' })
      if (task && logContent.trim()) {
        addWorkLog(logContent.trim(), categories, id)
      }
      return task ? { ...task, categories } : task
    }
  )

  // --- Settings ---

  ipcMain.handle('settings:get', (_event, key: string) => {
    assertNonEmptyString(key, 'key')
    if (key === 'api_key') {
      return getStoredApiKey()
    }
    if (!isAllowedSettingsKey(key)) return null
    return getSetting(key)
  })

  ipcMain.handle('settings:set', (_event, key: string, value: string) => {
    assertNonEmptyString(key, 'key')
    if (key === 'api_key') {
      setStoredApiKey(value)
      return
    }
    if (!isAllowedSettingsKey(key)) return
    setSetting(key, value)
  })

  ipcMain.handle('settings:delete', (_event, key: string) => {
    assertNonEmptyString(key, 'key')
    if (key === 'api_key') {
      deleteStoredApiKey()
      return
    }
    if (!isAllowedSettingsKey(key)) return
    deleteSetting(key)
  })

  // --- Export ---

  ipcMain.handle('export:logs', async (_event, format: 'csv' | 'markdown', logIds?: number[]) => {
    if (format !== 'csv' && format !== 'markdown') throw new Error('Invalid format: expected csv or markdown')
    const logs = logIds && logIds.length > 0 ? getWorkLogsByIds(logIds) : getAllWorkLogs()
    if (logs.length === 0) throw new Error(tMain('noLogsToExport'))

    const ext = format === 'csv' ? 'csv' : 'md'
    const result = await dialog.showSaveDialog({
      title: tMain('exportLogsTitle'),
      defaultPath: `mywork-logs.${ext}`,
      filters: [
        format === 'csv'
          ? { name: 'CSV', extensions: ['csv'] }
          : { name: 'Markdown', extensions: ['md'] }
      ]
    })

    if (result.canceled || !result.filePath) return null

    let content: string
    if (format === 'csv') {
      const escapeCsvCell = (value: string): string => `"${value.replace(/"/g, '""')}"`
      const header = tMain('csvHeader')
      const rows = logs
        .map((l) => {
          const tags = getRecordTags('work_log', l.id)
          const cells = [l.created_at, l.content, tags.join(';')]
          return cells.map(escapeCsvCell).join(',')
        })
        .join('\n')
      content = header + rows
    } else {
      const grouped = new Map<string, typeof logs>()
      for (const log of logs) {
        const date = log.created_at.slice(0, 10)
        const list = grouped.get(date) || []
        list.push(log)
        grouped.set(date, list)
      }
      const sections = Array.from(grouped.entries()).map(([date, dateLogs]) => {
        const items = dateLogs.map((l) => {
          const tags = getRecordTags('work_log', l.id)
          const tagStr = tags.length > 0 ? ` [${tags.join(', ')}]` : ''
          return `- ${l.created_at.slice(11, 16)} ${l.content}${tagStr}`
        }).join('\n')
        return `## ${date}\n\n${items}`
      })
      content = `${tMain('markdownLogsTitle')}\n\n${sections.join('\n\n')}\n`
    }

    writeFileSync(result.filePath, content, 'utf-8')
    return result.filePath
  })

  ipcMain.handle('export:report', async (_event, reportContent: string, dateRange: string) => {
    const result = await dialog.showSaveDialog({
      title: tMain('exportReportTitle'),
      defaultPath: `mywork-report-${dateRange}.md`,
      filters: [{ name: 'Markdown', extensions: ['md'] }]
    })

    if (result.canceled || !result.filePath) return null

    writeFileSync(result.filePath, reportContent, 'utf-8')
    return result.filePath
  })

  // --- Tags ---

  ipcMain.handle('tag:all', () => {
    return getAllTags()
  })

  ipcMain.handle('tag:recent', (_event, limit?: number) => {
    return getRecentTags(limit)
  })

  ipcMain.handle('tag:create', (_event, name: string) => {
    assertNonEmptyString(name, 'name')
    createTag(name)
  })

  ipcMain.handle('tag:color:get', (_event, tag: string) => {
    return getTagColor(tag)
  })

  ipcMain.handle('tag:color:set', (_event, tag: string, color: string) => {
    setTagColor(tag, color)
  })

  ipcMain.handle('tag:color:delete', (_event, tag: string) => {
    deleteTagColor(tag)
  })
}
