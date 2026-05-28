# MyWork 项目优化建议

> 审查日期：2026-05-27 | 审查范围：全项目（主进程、渲染进程、构建配置、依赖）

---

## 目录

1. [安全问题](#1-安全问题)
2. [性能优化](#2-性能优化)
3. [前端优化](#3-前端优化)
4. [代码质量](#4-代码质量)
5. [构建与依赖](#5-构建与依赖)
6. [优先级总览](#6-优先级总览)

---

## 1. 安全问题

### 🔴 1.1 沙箱未启用（高危）

主窗口和快捷创建窗口都使用了 `sandbox: false`：

```ts
webPreferences: {
  preload: join(__dirname, '../preload/index.js'),
  sandbox: false   // ← 安全风险
}
```

**影响**：渲染进程可更广泛地访问 Node.js API，若存在 XSS 漏洞，攻击者可获得深度系统权限。

**建议**：启用沙箱，确保所有 Node 访问通过 preload 桥接：
```ts
webPreferences: {
  contextIsolation: true,
  sandbox: true,
  preload: join(__dirname, '../preload/index.js')
}
```

### 🔴 1.2 IPC 处理器无输入验证（高危）

所有 IPC 处理器均未验证输入参数。渲染进程可传入：
- 空字符串、负数 ID、NaN 值
- 超大字符串（内存 DoS）
- 无效日期字符串

**建议**：添加验证层：
```ts
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
```

### 🟡 1.3 Settings IPC 允许任意键读写（中危）

渲染进程可读写**任意**设置键，包括内部键如 `shortcut_quick_log`、`tag_color:*` 等。

**建议**：添加白名单：
```ts
const ALLOWED_SETTINGS_KEYS = new Set([
  'ai_provider', 'ai_base_url', 'ai_model',
  'report_language', 'report_style', 'system_prompt',
  'user_prompt', 'report_template', 'optimize_language', 'optimize_prompt',
  'app_language'
])
```

### 🟡 1.4 `shell.openExternal` 未验证 URL（低危）

```ts
shell.openExternal(details.url)  // ← 无验证
```

**建议**：限制为 `https:` 和 `http:` 协议：
```ts
const url = new URL(details.url)
if (url.protocol === 'https:' || url.protocol === 'http:') {
  shell.openExternal(details.url)
}
```

### 🟡 1.5 缺少 CSP（内容安全策略）

未配置 CSP 头。**建议**通过 `session.defaultSession.webRequest.onHeadersReceived` 添加。

---

## 2. 性能优化

### 🔴 2.1 N+1 查询模式（高影响）

`worklog:list` IPC 处理器中，每条日志单独查询标签：

```ts
const logs = getWorkLogs(limit, offset)
return logs.map((l) => ({ ...l, categories: getRecordTags('work_log', l.id) }))
// 200 条日志 → 201 次查询
```

**建议**：批量查询标签：
```ts
export function getRecordTagsBatch(recordType: string, recordIds: number[]): Map<number, string[]> {
  if (recordIds.length === 0) return new Map()
  const placeholders = recordIds.map(() => '?').join(',')
  const rows = db.prepare(`
    SELECT record_id, tag_name FROM record_tags
    WHERE record_type = ? AND record_id IN (${placeholders})
  `).all(recordType, ...recordIds) as { record_id: number; tag_name: string }[]
  const map = new Map<number, string[]>()
  for (const row of rows) {
    const arr = map.get(row.record_id) || []
    arr.push(row.tag_name)
    map.set(row.record_id, arr)
  }
  return map
}
```

### 🟡 2.2 `getStats` SQL 字符串拼接（安全 + 性能）

```ts
`WHERE created_at >= datetime('now', '-${days} days', 'localtime')`  // ← 字符串拼接
```

**建议**：使用参数化查询：
```ts
db.prepare(`
  SELECT ... WHERE created_at >= datetime('now', '-' || ? || ' days', 'localtime')
`).all(days)
```

### 🟡 2.3 连续天数计算扫描全表

```ts
const allDailyLogs = db.prepare(`
  SELECT date(created_at) as date FROM work_logs GROUP BY date(created_at)
`).all()
```

**建议**：限制为最近 366 天：
```ts
WHERE created_at >= datetime('now', '-366 days', 'localtime')
```

### 🟡 2.4 `setRecordTags` 非原子操作

标签操作（创建标签、删除旧标签、插入新标签）未包裹在事务中。

**建议**：
```ts
export const setRecordTags = db.transaction((recordType: string, recordId: number, tags: string[]) => {
  // ... 所有操作在事务中执行
})
```

### 🟢 2.5 预编译语句未缓存

每次函数调用都创建新的 `db.prepare()`。对高频路径，建议在模块级别缓存：
```ts
const stmts = {
  getWorkLogs: db.prepare('SELECT * FROM work_logs ORDER BY created_at DESC LIMIT ? OFFSET ?'),
  // ...
}
```

---

## 3. 前端优化

### 🔴 3.1 Zustand Store 解构导致多余重渲染

所有页面使用完整解构：
```ts
const { logs, fetchLogs, deleteLog, ... } = useWorkLogStore()  // ← 任何字段变化都触发重渲染
```

**建议**：使用选择器：
```ts
const logs = useWorkLogStore(s => s.logs)
const fetchLogs = useWorkLogStore(s => s.fetchLogs)
```

### 🔴 3.2 WorkLogPage 过于庞大（1165 行，25 个 useState）

单个组件包含日志列表、日历过滤、草稿保存、编辑、删除等全部逻辑。

**建议**：拆分为子组件：
- `WorkLogHeader` — 搜索、过滤器
- `WorkLogEditor` — 编辑表单
- `WorkLogList` — 日志列表
- `WorkLogCalendar` — 日历视图

### 🔴 3.3 `grouped` 未使用 useMemo

```ts
const grouped = groupLogsByDate(filteredLogs)  // ← 每次渲染重新计算
```

**建议**：
```ts
const grouped = useMemo(() => groupLogsByDate(filteredLogs), [filteredLogs])
```

### 🟡 3.4 `saveDraft` 每次按键触发

localStorage 写入无防抖。

**建议**：
```ts
const saveDraft = useMemo(
  () => debounce((draft: string) => localStorage.setItem('draft', draft), 500),
  []
)
```

### 🟡 3.5 ~50 个硬编码中文字符串

项目已有完整 i18n 系统，但大量组件中仍硬编码中文：
- CalendarFilter 星期标题
- 各种按钮文本、占位符、提示信息

**建议**：逐一迁移到 i18n 系统。

### 🟡 3.6 TagSelector 重复代码

`TagDropdown` 和 `TagPortalDropdown` 有 90% 重复的下拉代码。

**建议**：提取公共 `TagDropdownBase` 组件。

### 🟡 3.7 Tags 在 3 个地方独立获取

标签在 WorkLogPage、KanbanPage、ReportPage 中分别获取。

**建议**：创建共享的 `useTags()` hook 或 `tagStore`。

### 🟢 3.8 缺少 React.memo

没有任何组件使用 `React.memo`。对纯展示组件（TagBadge、Toast 等）应添加 memo。

---

## 4. 代码质量

### 🔴 4.1 `stats:get` 类型混乱

参数类型为 `string | number`，但在调用处强转为 `string`，内部又用 `typeof === 'number'` 判断。

**建议**：拆分为两个函数：
```ts
export function getStatsByDateRange(from: string, to: string): StatsResult { ... }
export function getStatsByDays(days: number): StatsResult { ... }
```

### 🟡 4.2 `getMainWindow()` 脆弱

```ts
function getMainWindow(): BrowserWindow | null {
  return BrowserWindow.getAllWindows()[0] || null  // ← 假设第一个窗口是主窗口
}
```

**建议**：存储主窗口引用：
```ts
let mainWindow: BrowserWindow | null = null
```

### 🟡 4.3 类型重复定义

`WorkLog`、`Task` 等类型在 `db.ts`、`preload/index.ts`、`preload/index.d.ts` 三处重复。

**建议**：提取到 `src/shared/types.ts`。

### 🟡 4.4 缺少优雅关闭

应用退出时未关闭数据库：
```ts
app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  // ← 缺少: db.close()
})
```

### 🟡 4.5 硬编码魔法数字

```ts
const windowWidth = Math.floor(screenWidth * 0.5)  // 50%
const windowHeight = 180
const maxHeight = 600
limit = 200  // 默认查询限制
```

**建议**：提取为命名常量。

### 🟡 4.6 Menu.setApplicationMenu(null) 重复调用 4+ 次

**建议**：在应用初始化时调用一次。

### 🟢 4.7 createQuickCreateWindow 中动态 require

```ts
const { screen } = require('electron')  // ← 已在顶层导入
```

---

## 5. 构建与依赖

### 🟡 5.1 未使用的依赖 `electron-updater`

`updater.ts` 完全是空实现（所有函数为 no-op），但 `electron-updater` 仍在 `dependencies` 中。

**建议**：从 `dependencies` 中移除。

### 🟡 5.2 过时的依赖

| 包 | 当前版本 | 最新版本 | 备注 |
|---|---|---|---|
| `electron` | `^31` | `36.x` | 安全补丁、Chromium 更新 |
| `electron-builder` | `^24` | `26.x` | |
| `typescript` | `^5.5` | `5.8.x` | |
| `tailwindcss` | `^3.4` | `4.x` | CSS-first 配置，更快构建 |

### 🟡 5.3 TypeScript 配置不完整

两个 tsconfig 均缺少：
- `target` — 默认为 `ES3`，应为 `ES2022`
- `isolatedModules: true` — Vite 要求
- `resolveJsonModule: true`
- `noUnusedLocals: true` — 捕获死代码
- `noUnusedParameters: true`

`tsconfig.web.json` 缺少：
- `lib: ["ES2022", "DOM", "DOM.Iterable"]`

### 🟡 5.4 包大小优化

| 关注点 | 严重性 | 详情 |
|---|---|---|
| `better-sqlite3` 原生二进制 | ⚠️ | ~5-10MB/平台，必须保留 |
| `react-markdown` | ⚠️ | 拉入 `remark-*` 生态（~50-80KB），可考虑 `marked`（~30KB） |
| `@dnd-kit` 4 个包 | ⚠️ | 仅 KanbanPage 使用，可懒加载 |
| 重复导入 `index.css` | ⚠️ | `main.tsx` 和 `quick-create.tsx` 都导入完整 CSS |

**建议**：
1. 懒加载 KanbanPage：`const KanbanPage = React.lazy(() => import('./pages/KanbanPage'))`
2. 在 `electron.vite.config.ts` 添加 chunk splitting：
```ts
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        'vendor-react': ['react', 'react-dom'],
        'vendor-dnd': ['@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/modifiers'],
      }
    }
  }
}
```

### 🟢 5.5 AI 调用无速率限制

`ai:optimizeLog` 和 `report:generate` 无频率限制，可能被滥用消耗 API 额度。

---

## 6. 优先级总览

### 🔴 P0 — 必须立即修复

| # | 问题 | 文件 | 影响 |
|---|---|---|---|
| 1 | 启用沙箱 + contextIsolation | `index.ts` | 安全 |
| 2 | IPC 输入验证 | `ipc.ts` | 安全 |
| 3 | Settings 键白名单 | `ipc.ts` | 安全 |
| 4 | N+1 查询 → 批量查询 | `db.ts`, `ipc.ts` | 性能 |
| 5 | Zustand 选择器 | 所有页面 | 性能 |

### 🟡 P1 — 近期优化

| # | 问题 | 影响 |
|---|---|---|
| 6 | `stats:get` 类型拆分 | 代码质量 |
| 7 | 存储 mainWindow 引用 | 健壮性 |
| 8 | 提取共享类型到 `src/shared/types.ts` | 可维护性 |
| 9 | 添加 `db.close()` 优雅关闭 | 数据安全 |
| 10 | `setRecordTags` 事务包裹 | 数据一致性 |
| 11 | WorkLogPage 组件拆分 | 可维护性 |
| 12 | `grouped` useMemo | 性能 |
| 13 | `saveDraft` 防抖 | 性能 |
| 14 | 移除 `electron-updater` | 包大小 |
| 15 | 升级 Electron / TypeScript / electron-builder | 安全 |
| 16 | tsconfig 完善（target, isolatedModules 等） | 类型安全 |
| 17 | 懒加载 KanbanPage | 启动性能 |

### 🟢 P2 — 长期改进

| # | 问题 | 影响 |
|---|---|---|
| 18 | 硬编码中文 → i18n | 国际化 |
| 19 | TagSelector 去重 | 可维护性 |
| 20 | 共享 tagStore/hook | 架构 |
| 21 | 添加 React.memo | 性能 |
| 22 | 提取魔法数字为常量 | 可读性 |
| 23 | 预编译语句缓存 | 性能 |
| 24 | 添加 CSP 头 | 安全 |
| 25 | shell.openExternal URL 验证 | 安全 |
| 26 | AI 调用速率限制 | 成本控制 |
| 27 | `react-markdown` → `marked` 评估 | 包大小 |

---

## 项目亮点 ✅

审查中也发现了以下做得好的方面：

- **API 密钥处理**：通过 `safeStorage` 加密存储，并有从明文到加密的自动迁移
- **Zustand Store 设计**：清晰、分层合理
- **i18n 系统**：类型安全的翻译键（`as const` + `TranslationKey` 推导）
- **CSS 设计系统**：`index.css` 中的变量、动画、组件层完善
- **暗色模式支持**：全面且一致
- **TagBadge 无障碍**：正确的 `role`、`tabIndex`、`onKeyDown`
- **数据库设计**：WAL 模式、外键启用、每日自动备份

---

> 建议按 P0 → P1 → P2 的顺序逐步实施。每个优先级内的条目可并行处理。
