import { useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  Eye,
  EyeOff,
  Trash2,
  RotateCcw,
  Keyboard,
  Sun,
  Moon,
  Monitor,
  FolderOpen
} from 'lucide-react'
import { useToast } from '../components/Toast'
import { useThemeStore } from '../stores/themeStore'
import { useI18n, useLanguageStore } from '../stores/languageStore'
import type { AppLanguage, ResolvedLanguage } from '../lib/i18n'

// Convert a KeyboardEvent to an Electron-style accelerator string
function eventToAccelerator(e: KeyboardEvent): string | null {
  // Ignore modifier-only keydowns
  if (['Meta', 'Control', 'Alt', 'Shift'].includes(e.key)) return null
  const parts: string[] = []
  if (e.metaKey || e.ctrlKey) parts.push('CmdOrCtrl')
  if (e.altKey) parts.push('Alt')
  if (e.shiftKey) parts.push('Shift')
  // Map special keys
  const keyMap: Record<string, string> = {
    ' ': 'Space', ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right',
    Backspace: 'Backspace', Delete: 'Delete', Escape: 'Escape', Enter: 'Return',
    Tab: 'Tab', Home: 'Home', End: 'End', PageUp: 'PageUp', PageDown: 'PageDown'
  }
  const key = keyMap[e.key] ?? (e.key.length === 1 ? e.key.toUpperCase() : e.key)
  parts.push(key)
  // Need at least a modifier + key for a global shortcut
  if (parts.length < 2) return null
  return parts.join('+')
}

function ShortcutCapture({
  value,
  onChange,
  capturingLabel
}: {
  value: string
  onChange: (v: string) => void
  capturingLabel: string
}): JSX.Element {
  const [capturing, setCapturing] = useState(false)
  const ref = useRef<HTMLButtonElement>(null)

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    e.preventDefault()
    e.stopPropagation()
    if (e.key === 'Escape') { setCapturing(false); return }
    const acc = eventToAccelerator(e.nativeEvent)
    if (acc) {
      onChange(acc)
      setCapturing(false)
    }
  }

  return (
    <button
      ref={ref}
      onFocus={() => setCapturing(true)}
      onBlur={() => setCapturing(false)}
      onKeyDown={capturing ? handleKeyDown : undefined}
      className={`flex items-center gap-2.5 px-4 py-2.5 border rounded-lg text-sm font-mono transition-all duration-150 outline-none
        ${capturing
          ? 'border-blue-500 ring-2 ring-blue-200 dark:ring-blue-800/50 bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400'
          : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer'
        }`}
    >
      <Keyboard className="w-4 h-4 text-slate-400 shrink-0" />
      {capturing ? capturingLabel : value}
    </button>
  )
}

interface Props {
  onBack: () => void
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

const DEFAULT_USER_PROMPT = `按照不同的标签（项目），将同一个项目下能合并的内容合并总结工作内容，我的工作内容如下：
{{logs}}
{{tasks}}

请参考以下格式模板输出：
{{template}}`

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

function getDefaultSystemPrompt(language: ResolvedLanguage): string {
  return language === 'zh' ? DEFAULT_SYSTEM_PROMPT : DEFAULT_SYSTEM_PROMPT_EN
}

function getDefaultReportTemplate(language: ResolvedLanguage): string {
  return language === 'zh' ? DEFAULT_REPORT_TEMPLATE : DEFAULT_REPORT_TEMPLATE_EN
}

function getDefaultUserPrompt(language: ResolvedLanguage): string {
  return language === 'zh' ? DEFAULT_USER_PROMPT : DEFAULT_USER_PROMPT_EN
}

function getDefaultOptimizePrompt(language: ResolvedLanguage): string {
  return language === 'zh' ? DEFAULT_OPTIMIZE_PROMPT : DEFAULT_OPTIMIZE_PROMPT_EN
}

function SettingsPage({ onBack }: Props): JSX.Element {
  const isMac = navigator.userAgent.includes('Mac')
  const modifierLabel = isMac ? 'Cmd' : 'Ctrl'
  const { language: appLanguage, resolvedLanguage, t } = useI18n()
  const setAppLanguage = useLanguageStore((s) => s.setLanguage)
  const previousLanguageRef = useRef<ResolvedLanguage>(resolvedLanguage)
  const [apiKey, setApiKey] = useState('')
  const [hasKey, setHasKey] = useState(false)
  const [showKey, setShowKey] = useState(false)
  const [editing, setEditing] = useState(false)
  const [provider, setProvider] = useState('openai')
  const [baseUrl, setBaseUrl] = useState('')
  const [model, setModel] = useState('')
  const [reportLanguage, setReportLanguage] = useState(resolvedLanguage === 'zh' ? '中文' : 'English')
  const [style, setStyle] = useState(t('settings.styleConcise'))
  const [systemPrompt, setSystemPrompt] = useState(getDefaultSystemPrompt(resolvedLanguage))
  const [reportTemplate, setReportTemplate] = useState(getDefaultReportTemplate(resolvedLanguage))
  const [userPrompt, setUserPrompt] = useState(getDefaultUserPrompt(resolvedLanguage))
  const [shortcutLog, setShortcutLog] = useState('CmdOrCtrl+Shift+L')
  const [shortcutTask, setShortcutTask] = useState('CmdOrCtrl+Shift+T')
  const [optimizeLanguage, setOptimizeLanguage] = useState(resolvedLanguage === 'zh' ? '中文' : 'English')
  const [optimizePrompt, setOptimizePrompt] = useState(getDefaultOptimizePrompt(resolvedLanguage))
  const [autoReplace, setAutoReplace] = useState(false)
  const [dataPath, setDataPath] = useState('')
  const toast = useToast()
  const { theme, setTheme } = useThemeStore()
  const styleOptions = [
    t('settings.styleConcise'),
    t('settings.styleDetailed'),
    t('settings.styleCasual')
  ]

  useEffect(() => {
    loadSettings()

    void window.api.app.getDataPath().then(setDataPath)
  }, [])

  useEffect(() => {
    const previousLanguage = previousLanguageRef.current
    if (previousLanguage === resolvedLanguage) return

    setReportLanguage((current) => {
      const previousDefault = previousLanguage === 'zh' ? '中文' : 'English'
      return current === previousDefault ? (resolvedLanguage === 'zh' ? '中文' : 'English') : current
    })
    setStyle((current) => {
      const previousDefault = previousLanguage === 'zh' ? '简洁专业' : 'Concise professional'
      return current === previousDefault ? t('settings.styleConcise') : current
    })
    setSystemPrompt((current) => {
      const previousDefault = getDefaultSystemPrompt(previousLanguage)
      return current.trim() === previousDefault.trim() ? getDefaultSystemPrompt(resolvedLanguage) : current
    })
    setReportTemplate((current) => {
      const previousDefault = getDefaultReportTemplate(previousLanguage)
      return current.trim() === previousDefault.trim() ? getDefaultReportTemplate(resolvedLanguage) : current
    })
    setUserPrompt((current) => {
      const previousDefault = getDefaultUserPrompt(previousLanguage)
      return current.trim() === previousDefault.trim() ? getDefaultUserPrompt(resolvedLanguage) : current
    })
    setOptimizePrompt((current) => {
      const previousDefault = getDefaultOptimizePrompt(previousLanguage)
      return current.trim() === previousDefault.trim() ? getDefaultOptimizePrompt(resolvedLanguage) : current
    })
    setOptimizeLanguage((current) => {
      const previousDefault = previousLanguage === 'zh' ? '中文' : 'English'
      return current === previousDefault ? (resolvedLanguage === 'zh' ? '中文' : 'English') : current
    })

    previousLanguageRef.current = resolvedLanguage
  }, [resolvedLanguage, t])

  const loadSettings = async (): Promise<void> => {
    const key = await window.api.settings.get('api_key')
    if (key) {
      setApiKey(key)
      setHasKey(true)
    }
    const p = await window.api.settings.get('ai_provider')
    if (p) setProvider(p)
    const b = await window.api.settings.get('ai_base_url')
    if (b) setBaseUrl(b)
    const m = await window.api.settings.get('ai_model')
    if (m) setModel(m)
    const l = await window.api.settings.get('report_language')
    if (l) {
      setReportLanguage(l)
    } else {
      setReportLanguage(resolvedLanguage === 'zh' ? '中文' : 'English')
    }
    const s = await window.api.settings.get('report_style')
    if (s) {
      setStyle(s)
    } else {
      setStyle(t('settings.styleConcise'))
    }
    const sp = await window.api.settings.get('system_prompt')
    if (sp) setSystemPrompt(sp)
    const rt = await window.api.settings.get('report_template')
    if (rt) setReportTemplate(rt)
    const up = await window.api.settings.get('user_prompt')
    if (up) setUserPrompt(up)
    const sl = await window.api.settings.get('shortcut_quick_log')
    if (sl) setShortcutLog(sl)
    const st = await window.api.settings.get('shortcut_quick_task')
    if (st) setShortcutTask(st)
    const ol = await window.api.settings.get('optimize_language')
    if (ol) {
      setOptimizeLanguage(ol)
    } else {
      setOptimizeLanguage(resolvedLanguage === 'zh' ? '中文' : 'English')
    }
    const op = await window.api.settings.get('optimize_prompt')
    if (op) setOptimizePrompt(op)
    const ar = await window.api.settings.get('ai_auto_replace')
    if (ar) setAutoReplace(ar === 'true')
  }

  const handleShortcutChange = async (
    key: 'shortcut_quick_log' | 'shortcut_quick_task',
    value: string,
    setter: (v: string) => void
  ): Promise<void> => {
    const updated = await window.api.shortcut.update(key, value)
    if (!updated) {
      toast.error(t('settings.shortcutTaken'))
      return
    }

    setter(value)
    toast.success(t('settings.shortcutSaved'))
  }

  const maskKey = (key: string): string => {
    if (key.length <= 8) return '****'
    return key.slice(0, 4) + '****' + key.slice(-4)
  }

  const handleSaveKey = async (): Promise<void> => {
    if (!apiKey.trim()) return
    await window.api.settings.set('api_key', apiKey.trim())
    setHasKey(true)
    setEditing(false)
    toast.success(t('settings.apiKeySaved'))
  }

  const handleDeleteKey = async (): Promise<void> => {
    await window.api.settings.delete('api_key')
    setApiKey('')
    setHasKey(false)
    setEditing(false)
    toast.success(t('settings.apiKeyDeleted'))
  }

  const saveSetting = async (key: string, value: string): Promise<void> => {
    if (value.trim()) {
      await window.api.settings.set(key, value.trim())
    } else {
      await window.api.settings.delete(key)
    }
  }

  const handleProviderChange = async (value: string): Promise<void> => {
    setProvider(value)
    await window.api.settings.set('ai_provider', value)
  }

  const handleBaseUrlBlur = async (): Promise<void> => {
    await saveSetting('ai_base_url', baseUrl)
  }

  const handleModelBlur = async (): Promise<void> => {
    await saveSetting('ai_model', model)
  }

  const handleLanguageChange = async (value: string): Promise<void> => {
    setReportLanguage(value)
    await window.api.settings.set('report_language', value)
  }

  const handleStyleChange = async (value: string): Promise<void> => {
    setStyle(value)
    await window.api.settings.set('report_style', value)
  }

  const handleAppLanguageChange = async (value: AppLanguage): Promise<void> => {
    await setAppLanguage(value)
  }

  const handleSystemPromptBlur = async (): Promise<void> => {
    if (systemPrompt.trim() === getDefaultSystemPrompt(resolvedLanguage).trim()) {
      await window.api.settings.delete('system_prompt')
    } else {
      await window.api.settings.set('system_prompt', systemPrompt)
    }
  }

  const handleReportTemplateBlur = async (): Promise<void> => {
    if (reportTemplate.trim() === getDefaultReportTemplate(resolvedLanguage).trim()) {
      await window.api.settings.delete('report_template')
    } else {
      await window.api.settings.set('report_template', reportTemplate)
    }
  }

  const resetSystemPrompt = async (): Promise<void> => {
    setSystemPrompt(getDefaultSystemPrompt(resolvedLanguage))
    await window.api.settings.delete('system_prompt')
    toast.success(t('settings.systemPromptReset'))
  }

  const resetReportTemplate = async (): Promise<void> => {
    setReportTemplate(getDefaultReportTemplate(resolvedLanguage))
    await window.api.settings.delete('report_template')
    toast.success(t('settings.templateReset'))
  }

  const handleUserPromptBlur = async (): Promise<void> => {
    if (userPrompt.trim() === getDefaultUserPrompt(resolvedLanguage).trim()) {
      await window.api.settings.delete('user_prompt')
    } else {
      await window.api.settings.set('user_prompt', userPrompt)
    }
  }

  const resetUserPrompt = async (): Promise<void> => {
    setUserPrompt(getDefaultUserPrompt(resolvedLanguage))
    await window.api.settings.delete('user_prompt')
    toast.success(t('settings.userPromptReset') || '用户提示词已恢复默认')
  }

  const handleOptimizeLanguageChange = async (value: string): Promise<void> => {
    setOptimizeLanguage(value)
    await window.api.settings.set('optimize_language', value)
  }

  const handleOptimizePromptBlur = async (): Promise<void> => {
    if (optimizePrompt.trim() === getDefaultOptimizePrompt(resolvedLanguage).trim()) {
      await window.api.settings.delete('optimize_prompt')
    } else {
      await window.api.settings.set('optimize_prompt', optimizePrompt)
    }
  }

  const resetOptimizePrompt = async (): Promise<void> => {
    setOptimizePrompt(getDefaultOptimizePrompt(resolvedLanguage))
    await window.api.settings.delete('optimize_prompt')
    toast.success('AI 帮写提示词已重置')
  }

  const handleAutoReplaceChange = async (value: boolean): Promise<void> => {
    setAutoReplace(value)
    await window.api.settings.set('ai_auto_replace', value ? 'true' : 'false')
  }

  return (
    <div className="h-screen flex flex-col bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <header className="flex items-center px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
        <button
          onClick={onBack}
          className="p-2 text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all duration-150 mr-2"
          aria-label={t('settings.back')}
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{t('settings.title')}</h1>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-8">
          {/* AI Configuration */}
          <section>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-1">{t('settings.aiConfig')}</h2>
            <div className="h-px bg-slate-200 dark:bg-slate-700 mb-5" />

            {/* API Key */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">API Key</label>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">{t('settings.apiKeyHelp')}</p>
              {hasKey && !editing ? (
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-sm text-slate-600 dark:text-slate-400 font-mono border border-slate-200 dark:border-slate-700">
                    {showKey ? apiKey : maskKey(apiKey)}
                  </code>
                  <button
                    onClick={() => setShowKey(!showKey)}
                    className="p-2.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all duration-150"
                    aria-label={showKey ? t('settings.hide') : t('settings.show')}
                  >
                    {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => setEditing(true)}
                    className="px-4 py-2 text-sm text-blue-600 border border-blue-300 dark:border-blue-700 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-all duration-150 font-medium"
                  >
                    {t('settings.modify')}
                  </button>
                  <button
                    onClick={handleDeleteKey}
                    className="p-2.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-all duration-150"
                    aria-label={t('settings.deleteApiKey')}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={t('settings.apiKeyPlaceholder')}
                    className="flex-1 px-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800/50 bg-white dark:bg-slate-800 dark:text-slate-100 transition-all duration-150"
                  />
                  <button
                    onClick={handleSaveKey}
                    className="px-5 py-2.5 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-all duration-150 font-medium shadow-sm hover:shadow-md"
                  >
                    {t('common.save')}
                  </button>
                  {editing && (
                    <button
                      onClick={() => {
                        setEditing(false)
                        loadSettings()
                      }}
                      className="px-4 py-2.5 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-all duration-150"
                    >
                      {t('common.cancel')}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* AI Provider */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">{t('settings.aiProvider')}</label>
              <select
                value={provider}
                onChange={(e) => handleProviderChange(e.target.value)}
                className="px-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800/50 bg-white dark:bg-slate-800 dark:text-slate-100 transition-all duration-150 cursor-pointer hover:border-slate-400"
              >
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic (Claude)</option>
              </select>
            </div>

            {/* Base URL */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">{t('settings.baseUrl')}</label>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                {t('settings.baseUrlHelp')}
              </p>
              <input
                type="text"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                onBlur={handleBaseUrlBlur}
                placeholder={provider === 'openai' ? 'https://api.openai.com' : 'https://api.anthropic.com'}
                className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800/50 bg-white dark:bg-slate-800 dark:text-slate-100 font-mono transition-all duration-150"
              />
            </div>
            {/* Model */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">{t('settings.modelName')}</label>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                {t('settings.modelHelp')}
              </p>
              <input
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                onBlur={handleModelBlur}
                placeholder={provider === 'openai' ? 'gpt-4o-mini' : 'claude-sonnet-4-20250514'}
                className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800/50 bg-white dark:bg-slate-800 dark:text-slate-100 font-mono transition-all duration-150"
              />
            </div>
          </section>

          {/* AI 帮写 Preferences */}
          <section>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-1">AI 帮写设置</h2>
            <div className="h-px bg-slate-200 dark:bg-slate-700 mb-5" />

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">输出语言</label>
                <select
                  value={optimizeLanguage}
                  onChange={(e) => handleOptimizeLanguageChange(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800/50 bg-white dark:bg-slate-800 dark:text-slate-100 transition-all duration-150 cursor-pointer hover:border-slate-400"
                >
                  <option value="中文">中文</option>
                  <option value="English">English</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">默认自动替换</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleAutoReplaceChange(true)}
                    className={`flex-1 px-4 py-2.5 border rounded-lg text-sm transition-all duration-150 font-medium ${
                      autoReplace
                        ? 'bg-blue-500 text-white border-blue-500 shadow-sm hover:shadow-md'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 hover:border-blue-300 dark:hover:border-blue-700'
                    }`}
                  >
                    开启
                  </button>
                  <button
                    onClick={() => handleAutoReplaceChange(false)}
                    className={`flex-1 px-4 py-2.5 border rounded-lg text-sm transition-all duration-150 font-medium ${
                      !autoReplace
                        ? 'bg-blue-500 text-white border-blue-500 shadow-sm hover:shadow-md'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 hover:border-blue-300 dark:hover:border-blue-700'
                    }`}
                  >
                    关闭
                  </button>
                </div>
              </div>
            </div>

            {/* Optimize Prompt */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">AI 帮写提示词</label>
                <button
                  onClick={resetOptimizePrompt}
                  className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 transition-all duration-150"
                  title="恢复默认"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  恢复默认
                </button>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                自定义 AI 帮写时使用的系统提示词
              </p>
              <textarea
                value={optimizePrompt}
                onChange={(e) => setOptimizePrompt(e.target.value)}
                onBlur={handleOptimizePromptBlur}
                rows={8}
                className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800/50 bg-white dark:bg-slate-800 dark:text-slate-100 font-mono leading-relaxed resize-y transition-all duration-150"
              />
            </div>
          </section>

          {/* Report Preferences */}
          <section>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-1">{t('settings.reportPrefs')}</h2>
            <div className="h-px bg-slate-200 dark:bg-slate-700 mb-5" />

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">{t('settings.reportLanguage')}</label>
                <select
                  value={reportLanguage}
                  onChange={(e) => handleLanguageChange(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800/50 bg-white dark:bg-slate-800 dark:text-slate-100 transition-all duration-150 cursor-pointer hover:border-slate-400"
                >
                  <option value="中文">中文</option>
                  <option value="English">English</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">{t('settings.reportStyle')}</label>
                <select
                  value={style}
                  onChange={(e) => handleStyleChange(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800/50 bg-white dark:bg-slate-800 dark:text-slate-100 transition-all duration-150 cursor-pointer hover:border-slate-400"
                >
                  {!styleOptions.includes(style) && <option value={style}>{style}</option>}
                  {styleOptions.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* System Prompt */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">{t('settings.systemPrompt')}</label>
                <button
                  onClick={resetSystemPrompt}
                  className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 transition-all duration-150"
                  title={t('settings.restoreDefault')}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  {t('settings.restoreDefault')}
                </button>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                {t('settings.promptHelp')}
              </p>
              <textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                onBlur={handleSystemPromptBlur}
                rows={8}
                className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800/50 bg-white dark:bg-slate-800 dark:text-slate-100 font-mono leading-relaxed resize-y transition-all duration-150"
              />
            </div>

            {/* Report Template */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">{t('settings.reportTemplate')}</label>
                <button
                  onClick={resetReportTemplate}
                  className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 transition-all duration-150"
                  title={t('settings.restoreDefault')}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  {t('settings.restoreDefault')}
                </button>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                {t('settings.templateHelp')}
              </p>
              <textarea
                value={reportTemplate}
                onChange={(e) => setReportTemplate(e.target.value)}
                onBlur={handleReportTemplateBlur}
                rows={10}
                className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800/50 bg-white dark:bg-slate-800 dark:text-slate-100 font-mono leading-relaxed resize-y transition-all duration-150"
              />
            </div>

            {/* User Prompt */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">{t('settings.userPrompt') || '用户提示词'}</label>
                <button
                  onClick={resetUserPrompt}
                  className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 transition-all duration-150"
                  title={t('settings.restoreDefault')}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  {t('settings.restoreDefault')}
                </button>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                {t('settings.userPromptHelp') || '自定义用户输入提示，控制 AI 如何处理工作内容。支持变量：{{logs}} {{tasks}} {{template}}'}
              </p>
              <textarea
                value={userPrompt}
                onChange={(e) => setUserPrompt(e.target.value)}
                onBlur={handleUserPromptBlur}
                rows={6}
                className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800/50 bg-white dark:bg-slate-800 dark:text-slate-100 font-mono leading-relaxed resize-y transition-all duration-150"
              />
            </div>
          </section>

          {/* Shortcuts */}
          <section>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-1">{t('settings.shortcuts')}</h2>
            <div className="h-px bg-slate-200 dark:bg-slate-700 mb-5" />
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">
              {t('settings.shortcutsHelp')}
            </p>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">{t('settings.shortcutLog')}</label>
                <ShortcutCapture
                  value={shortcutLog}
                  onChange={(v) => handleShortcutChange('shortcut_quick_log', v, setShortcutLog)}
                  capturingLabel={t('settings.capturingShortcut')}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">{t('settings.shortcutTask')}</label>
                <ShortcutCapture
                  value={shortcutTask}
                  onChange={(v) => handleShortcutChange('shortcut_quick_task', v, setShortcutTask)}
                  capturingLabel={t('settings.capturingShortcut')}
                />
              </div>
            </div>

            <div className="mt-5 p-4 bg-slate-100/50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
              <p className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-3">{t('settings.otherShortcuts')}</p>
              <div className="space-y-2">
                {[
                  [`${modifierLabel}+1 / 2 / 3 / 4`, t('settings.navShortcuts')],
                  [`${modifierLabel}+,`, t('settings.openSettings')],
                  ['Tab', t('settings.quickModeShortcut')],
                  ['Esc', t('settings.closeShortcut')]
                ].map(([key, desc]) => (
                  <div key={key} className="flex items-center justify-between">
                    <code className="text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 px-2.5 py-1.5 rounded-lg text-slate-600 dark:text-slate-400 font-mono shadow-sm">
                      {key}
                    </code>
                    <span className="text-xs text-slate-500 dark:text-slate-400">{desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Appearance */}
          <section>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-1">{t('settings.appearance')}</h2>
            <div className="h-px bg-slate-200 dark:bg-slate-700 mb-5" />
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">{t('settings.language')}</label>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">{t('settings.languageHelp')}</p>
              <select
                value={appLanguage}
                onChange={(e) => handleAppLanguageChange(e.target.value as AppLanguage)}
                className="px-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800/50 bg-white dark:bg-slate-800 dark:text-slate-100 transition-all duration-150 cursor-pointer hover:border-slate-400"
              >
                <option value="system">{t('settings.languageSystem')}</option>
                <option value="zh">{t('settings.languageZh')}</option>
                <option value="en">{t('settings.languageEn')}</option>
              </select>
            </div>
            <div className="flex gap-3">
              {([
                { value: 'light', label: t('settings.themeLight'), Icon: Sun },
                { value: 'dark', label: t('settings.themeDark'), Icon: Moon },
                { value: 'system', label: t('settings.themeSystem'), Icon: Monitor }
              ] as const).map(({ value, label, Icon }) => (
                <button
                  key={value}
                  onClick={() => setTheme(value)}
                  className={`flex items-center gap-2 px-4 py-2.5 text-sm rounded-lg border transition-all duration-150 font-medium ${
                    theme === value
                      ? 'border-blue-500 bg-blue-500 text-white shadow-sm hover:shadow-md'
                      : 'border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 hover:border-blue-300 dark:hover:border-blue-700 hover:text-blue-600 dark:hover:text-blue-400'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </div>
          </section>

          {/* Data Path */}
          <section>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-1">数据存储</h2>
            <div className="h-px bg-slate-200 dark:bg-slate-700 mb-5" />
            <div className="flex items-center gap-3 p-4 bg-slate-100/50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
              <FolderOpen className="w-5 h-5 text-slate-400 shrink-0" />
              <code className="flex-1 text-xs text-slate-600 dark:text-slate-400 font-mono break-all leading-relaxed">
                {dataPath}
              </code>
            </div>
          </section>
        </div>
      </main>

    </div>
  )
}

export default SettingsPage
