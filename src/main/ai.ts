import { getSetting } from './db'
import { getStoredApiKey } from './secureSettings'
import { getResolvedLanguage, tMain } from './i18n'

// --- Rate Limiting ---
const RATE_LIMIT_MS = 3000 // minimum 3 seconds between AI calls
let lastAiCallTime = 0

function checkRateLimit(): void {
  const now = Date.now()
  const elapsed = now - lastAiCallTime
  if (elapsed < RATE_LIMIT_MS) {
    throw new Error(`请等待 ${Math.ceil((RATE_LIMIT_MS - elapsed) / 1000)} 秒后再试`)
  }
  lastAiCallTime = now
}

interface Message {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface ReportTaskContext {
  title: string
  description?: string
  status: 'todo' | 'in_progress' | 'done' | 'draft'
  due_date?: string | null
  completed_at?: string | null
  categories?: string[]
}

const DEFAULT_SYSTEM_PROMPT = `你是一个专业的工作报告助手。请根据用户提供的工作日志，生成一份结构化的工作总结报告。

要求：
- 语言：{{language}}
- 风格：{{style}}
- 时间范围：{{dateFrom}} 至 {{dateTo}}
- 输出格式：Markdown
- 项目识别：从工作日志中识别用 [] 包裹的项目名称（即标签），同时结合任务中的标签进行分类
- 项目名称必须直接使用日志或任务中标签里的原名称，不要修改或创建新的项目名称
- 严格按照标签（项目）进行分类归纳，将同一标签（项目）的工作内容和相关任务合并整理
- 突出关键成果和产出
- 简洁有力，避免流水账`

const DEFAULT_REPORT_TEMPLATE = `## 工作总结 ({{dateFrom}} - {{dateTo}})

### 主要产出

**1. [项目名称]**
*   [工作项1描述]
*   [工作项2描述]

**2. [项目名称]**
*   [工作项1描述]
*   [工作项2描述]`

const DEFAULT_SYSTEM_PROMPT_EN = `You are a professional work report assistant. Generate a structured work summary from the user's work logs.

Requirements:
- Language: {{language}}
- Style: {{style}}
- Date range: {{dateFrom}} to {{dateTo}}
- Output format: Markdown
- Project identification: Identify project names (tags) enclosed in [] from work logs, and also combine with tags from tasks for classification
- Project names must use the original names from logs or task tags directly, do not modify or create new project names
- Group work strictly by tags (projects), merge related work items and tasks under the same tag (project)
- Highlight key outcomes and deliverables
- Keep it concise and useful; avoid a raw chronological dump`

const DEFAULT_REPORT_TEMPLATE_EN = `## Work Summary ({{dateFrom}} - {{dateTo}})

### Key Outcomes

**1. [Project Name]**
*   [Work item 1 description]
*   [Work item 2 description]

**2. [Project Name]**
*   [Work item 1 description]
*   [Work item 2 description]`

const DEFAULT_USER_PROMPT = `按照不同的标签（项目），将能合并的内容合并总结工作内容，我的工作内容如下：
{{logs}}
{{tasks}}

请参考以下格式模板输出：
{{template}}`

const DEFAULT_USER_PROMPT_EN = `Group and summarize work content by tags (projects), merge related items. My work content is as follows:
{{logs}}
{{tasks}}

Use this output template as the structure:
{{template}}`

const DEFAULT_OPTIMIZE_PROMPT = `你是一个专业的工作日志助手。请优化用户的工作日志内容，使其更清晰、更专业。

要求：
- 语言：{{language}}
- 保持原意不变
- 语言简洁有力
- 格式规范
- 只返回优化后的内容，不要其他说明`

const DEFAULT_OPTIMIZE_PROMPT_EN = `You are a professional work log assistant. Optimize the user's work log to make it clearer and more professional.

Requirements:
- Language: {{language}}
- Keep the original meaning
- Use concise and strong language
- Keep formatting clean
- Only return the optimized content, no additional explanation`

export async function optimizeLog(content: string): Promise<string> {
  checkRateLimit()
  const apiKey = getStoredApiKey()
  if (!apiKey) {
    throw new Error(tMain('apiKeyMissing'))
  }

  const resolvedLanguage = getResolvedLanguage()
  const provider = getSetting('ai_provider') || 'openai'
  const baseUrl = getSetting('ai_base_url') || ''
  const model = getSetting('ai_model') || ''
  const language = getSetting('optimize_language') || (resolvedLanguage === 'zh' ? '中文' : 'English')
  const customPrompt = getSetting('optimize_prompt') || (resolvedLanguage === 'zh' ? DEFAULT_OPTIMIZE_PROMPT : DEFAULT_OPTIMIZE_PROMPT_EN)

  const vars: Record<string, string> = { language }
  const systemPrompt = replaceVars(customPrompt, vars)

  const messages: Message[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: content }
  ]

  if (provider === 'anthropic') {
    return callAnthropic(apiKey, baseUrl, model, messages)
  }
  return callOpenAI(apiKey, baseUrl, model, messages)
}

export async function generateReport(
  logs: { content: string; created_at: string }[],
  dateFrom: string,
  dateTo: string,
  tasks: ReportTaskContext[] = []
): Promise<string> {
  checkRateLimit()
  const apiKey = getStoredApiKey()
  if (!apiKey) {
    throw new Error(tMain('apiKeyMissing'))
  }

  const resolvedLanguage = getResolvedLanguage()
  const provider = getSetting('ai_provider') || 'openai'
  const baseUrl = getSetting('ai_base_url') || ''
  const model = getSetting('ai_model') || ''
  const language = getSetting('report_language') || (resolvedLanguage === 'zh' ? '中文' : 'English')
  const style = getSetting('report_style') || (resolvedLanguage === 'zh' ? '简洁专业' : 'Concise professional')
  const customSystemPrompt = getSetting('system_prompt') || (resolvedLanguage === 'zh' ? DEFAULT_SYSTEM_PROMPT : DEFAULT_SYSTEM_PROMPT_EN)
  const reportTemplate = getSetting('report_template') || (resolvedLanguage === 'zh' ? DEFAULT_REPORT_TEMPLATE : DEFAULT_REPORT_TEMPLATE_EN)
  const customUserPrompt = getSetting('user_prompt') || (resolvedLanguage === 'zh' ? DEFAULT_USER_PROMPT : DEFAULT_USER_PROMPT_EN)

  const systemVars: Record<string, string> = { language, style, dateFrom, dateTo }
  const systemPrompt = replaceVars(customSystemPrompt, systemVars)
  const templateHint = replaceVars(reportTemplate, systemVars)

  const logsText = logs
    .map((log) => `[${log.created_at}] ${log.content}`)
    .join('\n')

  const taskContext = formatTaskContext(tasks)
  const taskBlock = taskContext ? tMain('taskContextTitle', { tasks: taskContext }) : ''
  
  const userVars: Record<string, string> = { 
    logs: logsText,
    tasks: taskBlock,
    template: templateHint 
  }
  const userMessage = replaceVars(customUserPrompt, userVars)

  const messages: Message[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage }
  ]

  if (provider === 'anthropic') {
    return callAnthropic(apiKey, baseUrl, model, messages)
  }
  return callOpenAI(apiKey, baseUrl, model, messages)
}

function replaceVars(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] || '')
}

function formatTaskContext(tasks: ReportTaskContext[]): string {
  if (tasks.length === 0) return ''
  const separator = getResolvedLanguage() === 'zh' ? '，' : ', '

  const statusLabel: Record<ReportTaskContext['status'], string> = {
    todo: tMain('taskTodo'),
    in_progress: tMain('taskInProgress'),
    done: tMain('taskDone'),
    draft: tMain('taskDraft')
  }

  return tasks
    .slice(0, 100)
    .map((task) => {
      const meta = [
        statusLabel[task.status],
        task.due_date ? tMain('taskDue', { date: task.due_date }) : '',
        task.completed_at ? tMain('taskCompletedAt', { date: task.completed_at }) : ''
      ].filter(Boolean).join(separator)
      const description = task.description?.trim() ? ` — ${task.description.trim()}` : ''
      const tagsStr = task.categories && task.categories.length > 0 ? ` [标签: ${task.categories.join(', ')}]` : ''
      return `- [${meta}] ${task.title}${description}${tagsStr}`
    })
    .join('\n')
}

async function callOpenAI(
  apiKey: string,
  baseUrl: string,
  model: string,
  messages: Message[]
): Promise<string> {
  const url = baseUrl
    ? `${baseUrl.replace(/\/+$/, '')}/chat/completions`
    : 'https://api.openai.com/v1/chat/completions'

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model || 'gpt-4o-mini',
      messages,
      temperature: 0.7,
      max_tokens: 2000
    })
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`${tMain('openAiError')}: ${response.status} - ${error}`)
  }

  const data = await response.json()
  return data.choices[0]?.message?.content || tMain('noGeneratedContent')
}

async function callAnthropic(
  apiKey: string,
  baseUrl: string,
  model: string,
  messages: Message[]
): Promise<string> {
  const systemMsg = messages.find((m) => m.role === 'system')
  const userMsg = messages.find((m) => m.role === 'user')

  const url = baseUrl
    ? `${baseUrl.replace(/\/+$/, '')}/v1/messages`
    : 'https://api.anthropic.com/v1/messages'

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: model || 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      system: systemMsg?.content || '',
      messages: [{ role: 'user', content: userMsg?.content || '' }]
    })
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`${tMain('anthropicError')}: ${response.status} - ${error}`)
  }

  const data = await response.json()
  return data.content[0]?.text || tMain('noGeneratedContent')
}

export { 
  DEFAULT_SYSTEM_PROMPT, 
  DEFAULT_REPORT_TEMPLATE, 
  DEFAULT_SYSTEM_PROMPT_EN, 
  DEFAULT_REPORT_TEMPLATE_EN,
  DEFAULT_USER_PROMPT,
  DEFAULT_USER_PROMPT_EN,
  DEFAULT_OPTIMIZE_PROMPT,
  DEFAULT_OPTIMIZE_PROMPT_EN
}
