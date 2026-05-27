import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { existsSync, copyFileSync, mkdirSync } from 'fs'

let db: Database.Database

const DB_NAME = 'mywork.db'

function formatLocalDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getDbPath(): string {
  const userDataPath = app.getPath('userData')
  return join(userDataPath, DB_NAME)
}

function getBackupPath(): string {
  const userDataPath = app.getPath('userData')
  const backupDir = join(userDataPath, 'backups')
  if (!existsSync(backupDir)) {
    mkdirSync(backupDir, { recursive: true })
  }
  const date = formatLocalDate(new Date())
  return join(backupDir, `mywork-${date}.db`)
}

function runIntegrityCheck(): boolean {
  try {
    const result = db.pragma('integrity_check') as { integrity_check: string }[]
    return result[0]?.integrity_check === 'ok'
  } catch {
    return false
  }
}

function createBackup(): void {
  const backupPath = getBackupPath()
  if (!existsSync(backupPath)) {
    try {
      copyFileSync(getDbPath(), backupPath)
    } catch {
      // backup failure is non-critical
    }
  }
}

function createTables(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS work_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content TEXT NOT NULL,
      category TEXT DEFAULT '',
      note TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      task_id INTEGER,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'todo' CHECK(status IN ('todo', 'in_progress', 'done', 'draft')),
      board_column TEXT NOT NULL DEFAULT 'todo',
      position INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      completed_at TEXT,
      due_date TEXT DEFAULT NULL,
      category TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL CHECK(type IN ('weekly', 'monthly', 'quarterly', 'custom')),
      date_from TEXT NOT NULL,
      date_to TEXT NOT NULL,
      content TEXT NOT NULL,
      generated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tags (
      name TEXT PRIMARY KEY,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS record_tags (
      record_type TEXT NOT NULL,
      record_id INTEGER NOT NULL,
      tag_name TEXT NOT NULL,
      PRIMARY KEY (record_type, record_id, tag_name),
      FOREIGN KEY (tag_name) REFERENCES tags(name) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_work_logs_created_at ON work_logs(created_at);
    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
    CREATE INDEX IF NOT EXISTS idx_reports_dates ON reports(date_from, date_to);
    CREATE INDEX IF NOT EXISTS idx_record_tags_type_id ON record_tags(record_type, record_id);
  `)
}

function runMigrations(): void {
  const colInfo = db.prepare("PRAGMA table_info('tasks')").all() as { name: string }[]
  const hasDueDate = colInfo.some((c) => c.name === 'due_date')

  // SQLite can't ALTER CHECK constraints, so recreate table if needed
  const tableInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='tasks'").get() as { sql: string } | undefined
  const hasCategory = colInfo.some((c) => c.name === 'category')
  if (tableInfo?.sql && !tableInfo.sql.includes("'draft'")) {
    const dueDateSelect = hasDueDate ? 'due_date' : 'NULL as due_date'
    const categorySelect = hasCategory ? 'category' : "'' as category"
    db.exec(`
      CREATE TABLE IF NOT EXISTS tasks_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT DEFAULT '',
        status TEXT NOT NULL DEFAULT 'todo' CHECK(status IN ('todo', 'in_progress', 'done', 'draft')),
        board_column TEXT NOT NULL DEFAULT 'todo',
        position INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
        completed_at TEXT,
        due_date TEXT DEFAULT NULL,
        category TEXT DEFAULT ''
      );
      INSERT INTO tasks_new (
        id,
        title,
        description,
        status,
        board_column,
        position,
        created_at,
        updated_at,
        completed_at,
        ${dueDateSelect},
        ${categorySelect}
      )
      SELECT
        id,
        title,
        description,
        status,
        board_column,
        position,
        created_at,
        updated_at,
        completed_at,
        ${dueDateSelect},
        ${categorySelect}
      FROM tasks;
      DROP TABLE tasks;
      ALTER TABLE tasks_new RENAME TO tasks;
      CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
    `)
    return
  }

  if (!hasDueDate) {
    db.exec("ALTER TABLE tasks ADD COLUMN due_date TEXT DEFAULT NULL")
  }

  // Migrate: add category column to tasks
  const updatedColInfo = db.prepare("PRAGMA table_info('tasks')").all() as { name: string }[]
  if (!updatedColInfo.some((c) => c.name === 'category')) {
    db.exec("ALTER TABLE tasks ADD COLUMN category TEXT DEFAULT ''")
  }

  // Migrate: add note column to work_logs
  const logColInfo = db.prepare("PRAGMA table_info('work_logs')").all() as { name: string }[]
  if (!logColInfo.some((c) => c.name === 'note')) {
    db.exec("ALTER TABLE work_logs ADD COLUMN note TEXT DEFAULT ''")
  }

  // Migrate: create tags table and populate from record_tags
  const tagsTableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='tags'").get()
  if (!tagsTableExists) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS tags (
        name TEXT PRIMARY KEY,
        created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
      );
    `)
  }

  // Migrate: populate tags from record_tags and existing category columns
  const tagsCount = (db.prepare('SELECT COUNT(*) as c FROM tags').get() as { c: number }).c
  if (tagsCount === 0) {
    db.exec(`
      INSERT OR IGNORE INTO tags (name)
      SELECT DISTINCT tag_name FROM record_tags;
      INSERT OR IGNORE INTO tags (name)
      SELECT DISTINCT category FROM work_logs WHERE category != '';
      INSERT OR IGNORE INTO tags (name)
      SELECT DISTINCT category FROM tasks WHERE category != '';
    `)
  }

  // Migrate: populate record_tags from existing category columns
  const tagCount = (db.prepare('SELECT COUNT(*) as c FROM record_tags').get() as { c: number }).c
  if (tagCount === 0) {
    db.exec(`
      INSERT OR IGNORE INTO record_tags (record_type, record_id, tag_name)
      SELECT 'work_log', id, category FROM work_logs WHERE category != '';
      INSERT OR IGNORE INTO record_tags (record_type, record_id, tag_name)
      SELECT 'task', id, category FROM tasks WHERE category != '';
    `)
  }
}

export function initDatabase(): void {
  const dbPath = getDbPath()
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  createTables()
  runMigrations()

  if (!runIntegrityCheck()) {
    console.error('Database integrity check failed!')
  }

  createBackup()
}

export function getDatabase(): Database.Database {
  return db
}

// --- Work Logs CRUD ---

export interface WorkLog {
  id: number
  content: string
  category: string
  note: string
  created_at: string
  task_id: number | null
}

function resolveWorkLogTaskId(taskId: number | null): number | null {
  if (taskId === null) return null
  const exists = db.prepare('SELECT 1 FROM tasks WHERE id = ?').get(taskId)
  return exists ? taskId : null
}

export function addWorkLog(
  content: string,
  categories: string[] = [],
  taskId: number | null = null,
  createdAt?: string,
  note = ''
): WorkLog {
  const resolvedTaskId = resolveWorkLogTaskId(taskId)
  const legacyCategory = categories[0] || ''
  let log: WorkLog
  if (createdAt) {
    const stmt = db.prepare(
      'INSERT INTO work_logs (content, category, task_id, created_at, note) VALUES (?, ?, ?, ?, ?) RETURNING *'
    )
    log = stmt.get(content, legacyCategory, resolvedTaskId, createdAt, note) as WorkLog
  } else {
    const stmt = db.prepare(
      'INSERT INTO work_logs (content, category, task_id, note) VALUES (?, ?, ?, ?) RETURNING *'
    )
    log = stmt.get(content, legacyCategory, resolvedTaskId, note) as WorkLog
  }
  if (categories.length > 0) {
    setRecordTags('work_log', log.id, categories)
  }
  return log
}

export function getWorkLogs(limit = 200, offset = 0): WorkLog[] {
  const stmt = db.prepare(
    'SELECT * FROM work_logs ORDER BY created_at DESC LIMIT ? OFFSET ?'
  )
  return stmt.all(limit, offset) as WorkLog[]
}

export function getWorkLogsByDateRange(from: string, to: string): WorkLog[] {
  const stmt = db.prepare(
    'SELECT * FROM work_logs WHERE date(created_at) >= date(?) AND date(created_at) <= date(?) ORDER BY created_at ASC'
  )
  return stmt.all(from, to) as WorkLog[]
}

export function searchWorkLogs(keyword: string, limit = 200): WorkLog[] {
  const stmt = db.prepare(
    'SELECT * FROM work_logs WHERE content LIKE ? ORDER BY created_at DESC LIMIT ?'
  )
  return stmt.all(`%${keyword}%`, limit) as WorkLog[]
}

export function deleteWorkLog(id: number): boolean {
  const stmt = db.prepare('DELETE FROM work_logs WHERE id = ?')
  const result = stmt.run(id)
  return result.changes > 0
}

export function restoreWorkLog(log: { content: string; categories: string[]; created_at: string; task_id: number | null; note: string }): WorkLog {
  return addWorkLog(log.content, log.categories, log.task_id, log.created_at, log.note)
}

// --- Reports CRUD ---

export interface Report {
  id: number
  type: string
  date_from: string
  date_to: string
  content: string
  generated_at: string
}

export function saveReport(
  type: string,
  dateFrom: string,
  dateTo: string,
  content: string
): Report {
  const stmt = db.prepare(
    'INSERT INTO reports (type, date_from, date_to, content) VALUES (?, ?, ?, ?) RETURNING *'
  )
  return stmt.get(type, dateFrom, dateTo, content) as Report
}

export function getReports(limit = 50): Report[] {
  const stmt = db.prepare('SELECT * FROM reports ORDER BY generated_at DESC LIMIT ?')
  return stmt.all(limit) as Report[]
}

export function updateReportContent(id: number, content: string): Report | null {
  const stmt = db.prepare('UPDATE reports SET content = ? WHERE id = ? RETURNING *')
  return stmt.get(content, id) as Report | null
}

export function deleteReport(id: number): boolean {
  const stmt = db.prepare('DELETE FROM reports WHERE id = ?')
  const result = stmt.run(id)
  return result.changes > 0
}

// --- Tasks CRUD ---

export interface Task {
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
}

export function addTask(title: string, description = '', status: 'todo' | 'draft' = 'todo', categories: string[] = []): Task {
  const maxPos = db.prepare(
    'SELECT COALESCE(MAX(position), -1) + 1 as next FROM tasks WHERE status = ?'
  ).get(status) as { next: number }

  const legacyCategory = categories[0] || ''
  const stmt = db.prepare(
    'INSERT INTO tasks (title, description, status, board_column, position, category) VALUES (?, ?, ?, ?, ?, ?) RETURNING *'
  )
  const task = stmt.get(title, description, status, status, maxPos.next, legacyCategory) as Task
  if (categories.length > 0) {
    setRecordTags('task', task.id, categories)
  }
  return task
}

export function getTasks(): Task[] {
  const stmt = db.prepare('SELECT * FROM tasks ORDER BY position ASC')
  return stmt.all() as Task[]
}

export function updateTask(
  id: number,
  updates: Partial<Pick<Task, 'title' | 'description' | 'status' | 'position' | 'due_date' | 'category'>> & { categories?: string[] }
): Task | null {
  const fields: string[] = []
  const values: unknown[] = []

  if (updates.title !== undefined) {
    fields.push('title = ?')
    values.push(updates.title)
  }
  if (updates.description !== undefined) {
    fields.push('description = ?')
    values.push(updates.description)
  }
  if (updates.status !== undefined) {
    fields.push('status = ?', 'board_column = ?')
    values.push(updates.status, updates.status)
    if (updates.status === 'done') {
      fields.push("completed_at = datetime('now', 'localtime')")
    } else {
      fields.push('completed_at = NULL')
    }
  }
  if (updates.position !== undefined) {
    fields.push('position = ?')
    values.push(updates.position)
  }
  if (updates.due_date !== undefined) {
    fields.push('due_date = ?')
    values.push(updates.due_date)
  }
  if (updates.category !== undefined) {
    fields.push('category = ?')
    values.push(updates.category)
  }

  fields.push("updated_at = datetime('now', 'localtime')")
  values.push(id)

  const stmt = db.prepare(
    `UPDATE tasks SET ${fields.join(', ')} WHERE id = ? RETURNING *`
  )
  const task = stmt.get(...values) as Task | null

  if (task && updates.categories !== undefined) {
    setRecordTags('task', id, updates.categories)
  }

  return task
}

export function deleteTask(id: number): boolean {
  const stmt = db.prepare('DELETE FROM tasks WHERE id = ?')
  return stmt.run(id).changes > 0
}

export function reorderTasks(taskIds: number[], status: string): void {
  const stmt = db.prepare(`
    UPDATE tasks
    SET
      position = ?,
      board_column = ?,
      status = ?,
      updated_at = datetime('now', 'localtime'),
      completed_at = CASE
        WHEN ? = 'done' AND completed_at IS NULL THEN datetime('now', 'localtime')
        WHEN ? != 'done' THEN NULL
        ELSE completed_at
      END
    WHERE id = ?
  `)
  const tx = db.transaction((ids: number[]) => {
    ids.forEach((id, index) => {
      stmt.run(index, status, status, status, status, id)
    })
  })
  tx(taskIds)
}

// --- Settings CRUD ---

export interface DailyStats {
  date: string
  log_count: number
  task_completed: number
}

export type StatsResult = {
  daily: DailyStats[]
  totalLogs: number
  totalTasksDone: number
  totalTasksActive: number
  streak: number
}

function mergeDailyWithTasks(daily: DailyStats[], taskDone: { date: string; cnt: number }[]): DailyStats[] {
  const doneMap = new Map(taskDone.map((r) => [r.date, r.cnt]))
  for (const d of daily) {
    d.task_completed = doneMap.get(d.date) || 0
  }
  doneMap.forEach((cnt, date) => {
    if (!daily.find((d) => d.date === date)) {
      daily.push({ date, log_count: 0, task_completed: cnt })
    }
  })
  daily.sort((a, b) => a.date.localeCompare(b.date))
  return daily
}

function getGlobalTotals(): { totalLogs: number; totalTasksDone: number; totalTasksActive: number } {
  const totalLogs = (db.prepare('SELECT COUNT(*) as c FROM work_logs').get() as { c: number }).c
  const totalTasksDone = (db.prepare("SELECT COUNT(*) as c FROM tasks WHERE status = 'done'").get() as { c: number }).c
  const totalTasksActive = (db.prepare("SELECT COUNT(*) as c FROM tasks WHERE status IN ('todo', 'in_progress')").get() as { c: number }).c
  return { totalLogs, totalTasksDone, totalTasksActive }
}

function getStreak(): number {
  const allDailyLogs = db.prepare(`
    SELECT date(created_at) as date FROM work_logs
    WHERE created_at >= datetime('now', '-366 days', 'localtime')
    GROUP BY date(created_at)
  `).all() as { date: string }[]
  const allLogDates = new Set(allDailyLogs.map((d) => d.date))

  let streak = 0
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  for (let i = 0; i <= 365; i++) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const dateStr = formatLocalDate(d)
    if (allLogDates.has(dateStr)) {
      streak++
    } else if (i === 0) {
      continue
    } else {
      break
    }
  }
  return streak
}

export function getStatsByDateRange(from: string, to: string): StatsResult {
  const daily = db.prepare(`
    SELECT date(created_at) as date, COUNT(*) as log_count, 0 as task_completed
    FROM work_logs
    WHERE date(created_at) >= date(?) AND date(created_at) <= date(?)
    GROUP BY date(created_at)
    ORDER BY date ASC
  `).all(from, to) as DailyStats[]

  const taskDone = db.prepare(`
    SELECT date(completed_at) as date, COUNT(*) as cnt
    FROM tasks
    WHERE completed_at IS NOT NULL AND date(completed_at) >= date(?) AND date(completed_at) <= date(?)
    GROUP BY date(completed_at)
  `).all(from, to) as { date: string; cnt: number }[]

  mergeDailyWithTasks(daily, taskDone)
  const { totalLogs, totalTasksDone, totalTasksActive } = getGlobalTotals()
  return { daily, totalLogs, totalTasksDone, totalTasksActive, streak: getStreak() }
}

export function getStatsByDays(days = 30): StatsResult {
  const safeDays = Math.floor(days)
  const daily = db.prepare(`
    SELECT date(created_at) as date, COUNT(*) as log_count, 0 as task_completed
    FROM work_logs
    WHERE created_at >= datetime('now', '-' || ? || ' days', 'localtime')
    GROUP BY date(created_at)
    ORDER BY date ASC
  `).all(safeDays) as DailyStats[]

  const taskDone = db.prepare(`
    SELECT date(completed_at) as date, COUNT(*) as cnt
    FROM tasks
    WHERE completed_at IS NOT NULL AND completed_at >= datetime('now', '-' || ? || ' days', 'localtime')
    GROUP BY date(completed_at)
  `).all(safeDays) as { date: string; cnt: number }[]

  mergeDailyWithTasks(daily, taskDone)
  const { totalLogs, totalTasksDone, totalTasksActive } = getGlobalTotals()
  return { daily, totalLogs, totalTasksDone, totalTasksActive, streak: getStreak() }
}

/** @deprecated Use getStatsByDateRange or getStatsByDays instead */
export function getStats(startDate?: string, endDate?: string): StatsResult {
  if (startDate && endDate) {
    return getStatsByDateRange(startDate, endDate)
  }
  return getStatsByDays(30)
}

export function getAllWorkLogs(): WorkLog[] {
  return db.prepare('SELECT * FROM work_logs ORDER BY created_at DESC').all() as WorkLog[]
}

export function getWorkLogsByIds(ids: number[]): WorkLog[] {
  if (ids.length === 0) return []
  const placeholders = ids.map(() => '?').join(',')
  const stmt = db.prepare(`SELECT * FROM work_logs WHERE id IN (${placeholders}) ORDER BY created_at DESC`)
  return stmt.all(...ids) as WorkLog[]
}

export function getCategories(): string[] {
  return getAllTags()
}

export function updateWorkLogCategories(id: number, categories: string[]): void {
  setRecordTags('work_log', id, categories)
}

export function getSetting(key: string): string | null {
  const stmt = db.prepare('SELECT value FROM settings WHERE key = ?')
  const row = stmt.get(key) as { value: string } | undefined
  return row?.value ?? null
}

export function setSetting(key: string, value: string): void {
  const stmt = db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?'
  )
  stmt.run(key, value, value)
}

export function deleteSetting(key: string): void {
  const stmt = db.prepare('DELETE FROM settings WHERE key = ?')
  stmt.run(key)
}

// --- Tags ---

const TAG_COLORS = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
  '#14b8a6', // teal
  '#6366f1', // indigo
]

export function createTag(name: string): void {
  db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)').run(name)
}

export function getAllTags(): string[] {
  const rows = db.prepare(
    'SELECT name FROM tags ORDER BY name'
  ).all() as { name: string }[]
  return rows.map((r) => r.name)
}

export function getRecordTags(recordType: string, recordId: number): string[] {
  const rows = db.prepare(
    'SELECT tag_name FROM record_tags WHERE record_type = ? AND record_id = ? ORDER BY tag_name'
  ).all(recordType, recordId) as { tag_name: string }[]
  return rows.map((r) => r.tag_name)
}

export function setRecordTags(recordType: string, recordId: number, tags: string[]): void {
  const tx = db.transaction((rt: string, rid: number, ts: string[]) => {
    for (const tag of ts) {
      if (tag) createTag(tag)
    }
    db.prepare('DELETE FROM record_tags WHERE record_type = ? AND record_id = ?').run(rt, rid)
    const insert = db.prepare('INSERT INTO record_tags (record_type, record_id, tag_name) VALUES (?, ?, ?)')
    for (const tag of ts) {
      if (tag) insert.run(rt, rid, tag)
    }
    const legacyCategory = ts[0] || ''
    if (rt === 'work_log') {
      db.prepare('UPDATE work_logs SET category = ? WHERE id = ?').run(legacyCategory, rid)
    } else {
      db.prepare('UPDATE tasks SET category = ? WHERE id = ?').run(legacyCategory, rid)
    }
  })
  tx(recordType, recordId, tags)
}

export function getRecordTagsBatch(recordType: string, recordIds: number[]): Map<number, string[]> {
  if (recordIds.length === 0) return new Map()
  const placeholders = recordIds.map(() => '?').join(',')
  const rows = db.prepare(
    `SELECT record_id, tag_name FROM record_tags WHERE record_type = ? AND record_id IN (${placeholders}) ORDER BY tag_name`
  ).all(recordType, ...recordIds) as { record_id: number; tag_name: string }[]
  const map = new Map<number, string[]>()
  for (const row of rows) {
    const arr = map.get(row.record_id) || []
    arr.push(row.tag_name)
    map.set(row.record_id, arr)
  }
  return map
}

export function getRecentTags(limit = 10): string[] {
  const rows = db.prepare(`
    SELECT t.name as tag_name, MAX(rt.rowid) as last_used
    FROM tags t
    LEFT JOIN record_tags rt ON t.name = rt.tag_name
    GROUP BY t.name
    ORDER BY last_used DESC NULLS LAST, t.created_at DESC
    LIMIT ?
  `).all(limit) as { tag_name: string }[]
  return rows.map((r) => r.tag_name)
}

export function getTagColor(tag: string): string {
  const stored = getSetting(`tag_color:${tag}`)
  if (stored) return stored
  // Auto-assign a color based on hash
  const hash = Array.from(tag).reduce((h, c) => h + c.charCodeAt(0), 0)
  return TAG_COLORS[hash % TAG_COLORS.length]
}

export function setTagColor(tag: string, color: string): void {
  // Ensure tag exists before setting color
  createTag(tag)
  setSetting(`tag_color:${tag}`, color)
}

export function deleteTagColor(tag: string): void {
  deleteSetting(`tag_color:${tag}`)
}
