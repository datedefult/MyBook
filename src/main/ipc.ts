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
  getTagColor,
  setTagColor,
  deleteTagColor,
  createTag,
  type Task
} from './db'
import { generateReport, optimizeLog } from './ai'
import { deleteStoredApiKey, getStoredApiKey, setStoredApiKey } from './secureSettings'
import { tMain } from './i18n'

export function registerIpcHandlers(): void {
  // --- Work Logs ---

  ipcMain.handle('worklog:add', (_event, content: string, categories?: string[], note?: string) => {
    const log = addWorkLog(content, categories, undefined, undefined, note)
    return log ? { ...log, categories: getRecordTags('work_log', log.id) } : log
  })

  ipcMain.handle('worklog:list', (_event, limit?: number, offset?: number) => {
    const logs = getWorkLogs(limit, offset)
    return logs.map((l) => ({ ...l, categories: getRecordTags('work_log', l.id) }))
  })

  ipcMain.handle('worklog:byDateRange', (_event, from: string, to: string) => {
    const logs = getWorkLogsByDateRange(from, to)
    return logs.map((l) => ({ ...l, categories: getRecordTags('work_log', l.id) }))
  })

  ipcMain.handle('worklog:search', (_event, keyword: string) => {
    const logs = searchWorkLogs(keyword)
    return logs.map((l) => ({ ...l, categories: getRecordTags('work_log', l.id) }))
  })

  ipcMain.handle('worklog:categories', () => {
    return getCategories()
  })

  ipcMain.handle('worklog:setCategories', (_event, id: number, categories: string[]) => {
    updateWorkLogCategories(id, categories)
  })

  ipcMain.handle('worklog:delete', (_event, id: number) => {
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
    return getStats(startDate as string, endDate)
  })

  // --- Reports ---

  ipcMain.handle(
    'report:generate',
    async (_event, dateFrom: string, dateTo: string) => {
      const logs = getWorkLogsByDateRange(dateFrom, dateTo)
      if (logs.length === 0) {
        throw new Error(tMain('noWorkLogsInRange'))
      }
      const tasks = getTasks().filter((task) => {
        if (task.status !== 'done') return true
        const completedDate = task.completed_at?.slice(0, 10)
        return Boolean(completedDate && completedDate >= dateFrom && completedDate <= dateTo)
      }).map(task => ({
        title: task.title,
        description: task.description,
        status: task.status,
        due_date: task.due_date,
        completed_at: task.completed_at,
        categories: getRecordTags('task', task.id)
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
    return updateReportContent(id, content)
  })

  ipcMain.handle('report:delete', (_event, id: number) => {
    return deleteReport(id)
  })

  // --- Tasks ---

  ipcMain.handle('task:add', (_event, title: string, description?: string, status?: 'todo' | 'draft', categories?: string[]) => {
    const task = addTask(title, description, status, categories)
    return task ? { ...task, categories: getRecordTags('task', task.id) } : task
  })

  ipcMain.handle('task:list', () => {
    const tasks = getTasks()
    return tasks.map((t) => ({ ...t, categories: getRecordTags('task', t.id) }))
  })

  ipcMain.handle(
    'task:update',
    (
      _event,
      id: number,
      updates: Partial<Pick<Task, 'title' | 'description' | 'status' | 'position' | 'due_date' | 'category'>> & { categories?: string[] }
    ) => {
      const task = updateTask(id, updates)
      return task ? { ...task, categories: getRecordTags('task', task.id) } : task
    }
  )

  ipcMain.handle('task:delete', (_event, id: number) => {
    return deleteTask(id)
  })

  ipcMain.handle('task:reorder', (_event, taskIds: number[], status: string) => {
    reorderTasks(taskIds, status)
  })

  // Complete task + auto create work log
  ipcMain.handle(
    'task:complete',
    (_event, id: number, logContent: string) => {
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
    if (key === 'api_key') {
      return getStoredApiKey()
    }
    return getSetting(key)
  })

  ipcMain.handle('settings:set', (_event, key: string, value: string) => {
    if (key === 'api_key') {
      setStoredApiKey(value)
      return
    }
    setSetting(key, value)
  })

  ipcMain.handle('settings:delete', (_event, key: string) => {
    if (key === 'api_key') {
      deleteStoredApiKey()
      return
    }
    deleteSetting(key)
  })

  // --- Export ---

  ipcMain.handle('export:logs', async (_event, format: 'csv' | 'markdown', logIds?: number[]) => {
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
