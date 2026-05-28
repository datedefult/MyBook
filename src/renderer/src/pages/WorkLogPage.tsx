import { useEffect, useRef, useState, useMemo, useCallback, Component, ErrorInfo, ReactNode } from 'react';
import { Search, X, Download, Sparkles, Calendar, Plus, Loader2, Calendar as CalendarIcon, ChevronDown, ChevronRight, ChevronLeft, Expand, FoldVertical, FileText, Filter } from 'lucide-react';
import { useToast } from '../components/Toast';
import { useWorkLogStore } from '../stores/worklogStore';
import { useTaskStore } from '../stores/taskStore';
import { useTagStore } from '../stores/tagStore';
import { formatDate, formatDateLocal, formatWeekday, groupLogsByDate, isSameDay, isTodayDateKey } from '../lib/dateUtils';
import { useI18n } from '../stores/languageStore';
import { TagBadge } from '../components/TagBadge';
import { TagSelector } from '../components/TagSelector';
import { CalendarFilter } from '../components/CalendarFilter';

const STORAGE_KEY = 'worklog-draft';

// 错误边界组件
interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class WorkLogErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('WorkLogPage Error:', error, errorInfo);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="h-full flex items-center justify-center bg-red-50 dark:bg-red-900/20 p-8">
          <div className="max-w-2xl w-full">
            <h2 className="text-xl font-semibold text-red-600 mb-4">⚠️ 页面加载出错</h2>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-red-200 dark:border-red-800">
              <p className="text-sm text-red-700 dark:text-red-300 mb-2 font-medium">错误信息：</p>
              <pre className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 p-3 rounded overflow-auto max-h-64 whitespace-pre-wrap break-all">
                {this.state.error?.message || '未知错误'}
              </pre>
              <pre className="text-xs text-red-500 dark:text-red-500 mt-2 bg-red-50 dark:bg-red-900/30 p-3 rounded overflow-auto max-h-48">
                {this.state.error?.stack || ''}
              </pre>
            </div>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
            >
              重试
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function WorkLogPageContent(): JSX.Element {
  const logs = useWorkLogStore(s => s.logs)
  const fetchLogs = useWorkLogStore(s => s.fetchLogs)
  const loadMore = useWorkLogStore(s => s.loadMore)
  const hasMore = useWorkLogStore(s => s.hasMore)
  const addLog = useWorkLogStore(s => s.addLog)
  const deleteLog = useWorkLogStore(s => s.deleteLog)
  const undoDelete = useWorkLogStore(s => s.undoDelete)
  const lastDeleted = useWorkLogStore(s => s.lastDeleted)
  const searchLogs = useWorkLogStore(s => s.searchLogs)
  const clearSearch = useWorkLogStore(s => s.clearSearch)
  const searchKeyword = useWorkLogStore(s => s.searchKeyword)
  const loading = useWorkLogStore(s => s.loading)
  const clearLastDeleted = useWorkLogStore(s => s.clearLastDeleted)
  const tasks = useTaskStore(s => s.tasks)
  const fetchTasks = useTaskStore(s => s.fetchTasks)
  const tags = useTagStore(s => s.tags)
  const fetchTags = useTagStore(s => s.fetchTags)
  const [input, setInput] = useState('');
  const [note, setNote] = useState('');
  const [showNote, setShowNote] = useState(false);
  const [search, setSearch] = useState('');
  const [shaking, setShaking] = useState(false);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [autoReplace, setAutoReplace] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [collapsedDates, setCollapsedDates] = useState<Set<string>>(new Set());
  const [expandedLogTags, setExpandedLogTags] = useState<Set<number>>(new Set());
  const [undoCountdown, setUndoCountdown] = useState(10);
  const [tagsExpanded, setTagsExpanded] = useState(false);
  const [dateRangeStart, setDateRangeStart] = useState<Date | null>(null);
  const [dateRangeEnd, setDateRangeEnd] = useState<Date | null>(null);
  const [showCustomDateRange, setShowCustomDateRange] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const undoTimerRef = useRef<ReturnType<typeof setInterval>>();
  const toast = useToast();
  const { resolvedLanguage, t } = useI18n();

  // 计算默认折叠状态（默认展开所有日志）
  const defaultCollapsedDates = useMemo((): Set<string> => {
    // 默认展开所有日志，避免折叠抖动
    return new Set();
  }, []);  // 空依赖，始终返回空Set

  // 过滤日志（必须在useEffect之前定义）
  const filteredLogs = useMemo(() => {
    if (!logs || logs.length === 0) return [];
    
    let result = [...logs];

    // 日期过滤
    if (selectedDate) {
      result = result.filter(log => {
        try {
          return isSameDay(new Date(log.created_at), selectedDate);
        } catch {
          return false;
        }
      });
    }

    // 时间段过滤
    if (dateRangeStart || dateRangeEnd) {
      result = result.filter(log => {
        try {
          const logDate = new Date(log.created_at);
          if (isNaN(logDate.getTime())) return false;
          
          if (dateRangeStart && dateRangeEnd) {
            const start = new Date(dateRangeStart);
            const end = new Date(dateRangeEnd);
            return logDate >= start && logDate <= end;
          } else if (dateRangeStart) {
            return logDate >= new Date(dateRangeStart);
          } else if (dateRangeEnd) {
            return logDate <= new Date(dateRangeEnd);
          }
          return true;
        } catch {
          return false;
        }
      });
    }

    // 标签过滤
    if (filterTag) {
      result = result.filter(log =>
        (log.categories || []).includes(filterTag)
      );
    }

    return result;
  }, [logs, selectedDate, filterTag, dateRangeStart, dateRangeEnd]);

  const grouped = useMemo(() => groupLogsByDate(filteredLogs), [filteredLogs]);

  // 撤销提示倒计时
  useEffect(() => {
    if (lastDeleted) {
      setUndoCountdown(10);
      undoTimerRef.current = setInterval(() => {
        setUndoCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(undoTimerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (undoTimerRef.current) {
        clearInterval(undoTimerRef.current);
      }
    };
  }, [lastDeleted]);

  // 获取统计数据
  const today = useMemo(() => new Date().toDateString(), []);
  const todayLogs = useMemo(() => 
    logs.filter(log => new Date(log.created_at).toDateString() === today), 
    [logs, today]
  );
  const todayCompletedTasks = useMemo(() => 
    tasks.filter(task => 
      task.status === 'done' && task.completed_at && new Date(task.completed_at).toDateString() === today
    ), 
    [tasks, today]
  );

  // 计算有日志的日期
  const hasLogDates = useMemo(() => {
    const dates = new Set<string>();
    logs.forEach(log => {
      dates.add(new Date(log.created_at).toDateString());
    });
    return dates;
  }, [logs]);

  // 获取所有标签及统计数量
  const tagOptions = useMemo(() => {
    const tagCounts = new Map<string, number>();
    logs.forEach(log => {
      (log.categories || []).forEach(tag => {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      });
    });
    return Array.from(tagCounts.entries()).map(([tag, count]) => ({
      value: tag,
      label: tag,
      count,
    })).sort((a, b) => b.count - a.count);
  }, [logs]);

  // 加载草稿和设置
  useEffect(() => {
    fetchLogs();
    fetchTasks();
    fetchTags();
    loadDraft();
    loadSettings();
    clearLastDeleted();
    inputRef.current?.focus();
  }, []);

  // 点击外部区域关闭导出菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setShowExportMenu(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // 保存草稿（防抖 500ms）
  useEffect(() => {
    const timer = setTimeout(() => {
      saveDraft();
    }, 500);
    return () => clearTimeout(timer);
  }, [input, note, selectedTags, showNote]);

  const loadDraft = (): void => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const { input: savedInput, note: savedNote, selectedTags: savedTags, showNote: savedShowNote } = JSON.parse(saved);
        setInput(savedInput || '');
        setNote(savedNote || '');
        setSelectedTags(savedTags || []);
        setShowNote(savedShowNote || false);
      }
    } catch {
      // ignore
    }
  };

  const saveDraft = useCallback((): void => {
    try {
      if (input.trim() || note.trim() || selectedTags.length > 0) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ input, note, selectedTags, showNote }));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // ignore
    }
  }, [input, note, selectedTags, showNote]);

  const clearDraft = (): void => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  };

  const loadSettings = async (): Promise<void> => {
    try {
      const autoReplaceValue = await window.api.settings.get('ai_auto_replace');
      setAutoReplace(autoReplaceValue === 'true');
    } catch {
      // ignore
    }
  };

  const parseCategory = (text: string): { content: string; category: string } => {
    const match = text.match(/#(\S+)\s*/);
    if (match) {
      return { content: text.replace(match[0], '').trim(), category: match[1] };
    }
    return { content: text, category: '' };
  };

  const handleSubmit = async (): Promise<void> => {
    const trimmed = input.trim();
    if (!trimmed) {
      setShaking(true);
      setError(t('worklog.emptyError'));
      setTimeout(() => {
        setShaking(false);
        setError('');
      }, 1500);
      return;
    }

    try {
      const { content, category: parsedCategory } = parseCategory(trimmed);
      const categories = selectedTags.length > 0 ? selectedTags : (parsedCategory ? [parsedCategory] : []);
      await addLog(content, categories, note.trim() || undefined);
      setInput('');
      setNote('');
      setShowNote(false);
      setSelectedTags([]);
      clearDraft();
      fetchTags();
      toast.success(t('worklog.added'));
    } catch {
      setError(t('worklog.saveError'));
    }
    inputRef.current?.focus();
  };

  const autoResize = (): void => {
    const textarea = inputRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      const maxHeight = 120
      const scrollHeight = textarea.scrollHeight
      if (scrollHeight <= maxHeight) {
        textarea.style.height = scrollHeight + 'px'
        textarea.style.overflowY = 'hidden'
      } else {
        textarea.style.height = maxHeight + 'px'
        textarea.style.overflowY = 'auto'
      }
    }
  }

  useEffect(() => {
    autoResize()
  }, [input]);

  const handleOptimize = async (): Promise<void> => {
    if (!input.trim() || isOptimizing) return;

    setIsOptimizing(true);
    try {
      const original = input;
      const optimized = await window.api.ai.optimizeLog(input);
      
      if (autoReplace) {
        setInput(optimized);
        toast.success('已优化并自动替换');
      } else {
        toast.showOptimization(original, optimized, () => setInput(optimized));
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '优化失败');
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSearchChange = (value: string): void => {
    setSearch(value);
    clearTimeout(searchTimerRef.current);
    if (!value.trim()) {
      clearSearch();
      return;
    }
    searchTimerRef.current = setTimeout(() => {
      searchLogs(value.trim());
    }, 300);
  };

  const handleClearSearch = (): void => {
    setSearch('');
    clearSearch();
  };

  const handleDelete = async (id: number): Promise<void> => {
    await deleteLog(id);
    setDeletingId(null);
    toast.success(t('worklog.deleted'));
  };

  const handleCopy = (content: string): void => {
    navigator.clipboard.writeText(content).then(() => {
      toast.success('已复制到剪贴板');
    });
  };

  const formatTime = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  };

  const toggleTagFilter = (tag: string) => {
    setFilterTag(prev => prev === tag ? null : tag);
  };

  const clearAllFilters = () => {
    setSelectedDate(null);
    setFilterTag(null);
    setDateRangeStart(null);
    setDateRangeEnd(null);
    setShowCustomDateRange(false);
  };

  const toggleDateCollapse = (dateKey: string) => {
    const newCollapsed = new Set(collapsedDates);
    if (newCollapsed.has(dateKey)) {
      newCollapsed.delete(dateKey);
    } else {
      newCollapsed.add(dateKey);
    }
    setCollapsedDates(newCollapsed);
  };

  const toggleLogTagsExpand = (logId: number) => {
    const newExpanded = new Set(expandedLogTags);
    if (newExpanded.has(logId)) {
      newExpanded.delete(logId);
    } else {
      newExpanded.add(logId);
    }
    setExpandedLogTags(newExpanded);
  };

  const expandAll = () => {
    setCollapsedDates(new Set());
  };

  const collapseAll = () => {
    const dateKeys = Array.from(grouped.keys());
    setCollapsedDates(new Set(dateKeys));
  };

  return (
    <div className="h-full flex flex-col">
      {/* 全局快速添加日志卡片 */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-700/50 px-6 py-4 shrink-0">
        <div className="relative">
          {/* 输入框主区域 */}
          <div className={`bg-white dark:bg-slate-900 rounded-xl shadow-md border border-slate-200 dark:border-slate-700 p-4 transition-all duration-150 ${shaking ? 'animate-shake' : ''}`}>
            <div className="flex flex-col gap-3">
              <div className="flex items-start gap-3">
                <div className="flex-1 flex flex-col gap-2 min-w-0">
                {/* 主输入框 */}
                <div className="relative group">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="今天干了什么？（#标签 会自动分类）"
                    className="w-full px-4 py-3 text-base text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 
                    overflow-y-hidden bg-white dark:bg-slate-800 
                    border-2 border-slate-200 dark:border-slate-700 rounded-xl outline-none
                    focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10
                    hover:border-slate-300 dark:hover:border-slate-600
                    transition-all duration-150"
                    rows={1}
                    style={{ minHeight: '48px', maxHeight: '120px' }}
                  />
                </div>

                {/* 备注展开区域 */}
                {showNote && (
                  <div className="relative animate-fade-in-up">
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="添加备注（可选）..."
                      className="w-full px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500
                      resize-none bg-slate-50 dark:bg-slate-900 
                      border border-slate-200 dark:border-slate-700 rounded-lg outline-none
                      focus:border-blue-400 focus:ring-2 focus:ring-blue-400/10
                      hover:border-slate-300 dark:hover:border-slate-600
                      transition-all duration-150"
                      rows={2}
                    />
                  </div>
                )}
              </div>
              </div>

              {/* 标签选择器 */}
              <TagSelector selectedTags={selectedTags} onTagsChange={setSelectedTags} />

              {/* 操作按钮 */}
              <div className="flex items-center gap-2 shrink-0">
                {/* 备注按钮 */}
                <button
                  onClick={() => setShowNote(!showNote)}
                  className={`h-9 px-3 rounded-lg text-sm font-medium transition-all duration-150 ${
                    showNote 
                      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 shadow-sm' 
                      : 'text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  + 备注
                </button>

                {/* AI 优化按钮 */}
                {input.trim() && (
                  <button
                    onClick={handleOptimize}
                    disabled={isOptimizing}
                    className="h-9 px-3 text-sm font-medium text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 shadow-sm hover:shadow"
                  >
                    {isOptimizing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4" />
                    )}
                    AI
                  </button>
                )}

                {/* 取消按钮 */}
                {(input.trim() || selectedTags.length > 0 || showNote) && (
                  <button
                    onClick={() => {
                      setInput('');
                      setNote('');
                      setSelectedTags([]);
                      setShowNote(false);
                      clearDraft();
                    }}
                    className="h-9 px-3 text-sm font-medium text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-all duration-150"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}

                {/* 发布按钮 */}
                <button
                  onClick={handleSubmit}
                  disabled={!input.trim()}
                  className="flex items-center justify-center gap-2 px-6 h-9 bg-blue-500 hover:bg-blue-600 active:bg-blue-700
                  disabled:bg-slate-300 disabled:cursor-not-allowed
                  text-white text-sm font-semibold rounded-lg shadow-md hover:shadow-lg
                  transition-all duration-150 shrink-0 btn-bounce"
                >
                  <Plus className="w-5 h-5" />
                  发布
                </button>
              </div>
            </div>
          </div>
          {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
        </div>
      </div>

      {/* 主体内容 */}
      <div className="flex-1 flex overflow-hidden p-6">
        <div className="w-full flex overflow-hidden worklog-main-container">
          {/* 左侧筛选栏 */}
          <aside
            className={`shrink-0 border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl shadow-sm transition-all duration-300 ease-in-out flex flex-col ${
              filterOpen ? 'w-[280px]' : 'w-14'
            }`}
          >
            {/* Toggle Button */}
            <button
              onClick={() => {
                const next = !filterOpen;
                setFilterOpen(next);
                localStorage.setItem('worklog:filterOpen', String(next));
              }}
              className="flex items-center justify-center h-12 border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all duration-150 shrink-0 rounded-t-xl"
              aria-label={filterOpen ? '收缩筛选' : '展开筛选'}
            >
              {filterOpen ? (
                <ChevronLeft className="w-5 h-5" />
              ) : (
                <ChevronRight className="w-5 h-5" />
              )}
            </button>

            {!filterOpen && (
              <div className="flex flex-col items-center gap-2 pt-4">
                <Filter className="w-5 h-5 text-slate-400 dark:text-slate-500" />
                <span className="text-xs text-slate-400 dark:text-slate-500" style={{ writingMode: 'vertical-rl' }}>
                  筛选
                </span>
                {(selectedDate || filterTag || dateRangeStart || dateRangeEnd) && (
                  <div className="mt-2 w-2 h-2 rounded-full bg-blue-500" />
                )}
              </div>
            )}

            {filterOpen && (
              <div className="flex flex-col flex-1 overflow-hidden">
                {/* 可滚动内容区域 */}
                <div className="flex-1 overflow-y-auto scrollbar-thin">
                  {/* 时间段模块 */}
                  <div className="px-4 py-4 border-b border-slate-200 dark:border-slate-700">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        时间筛选
                      </h3>
                      <button
                        onClick={() => setShowCustomDateRange(!showCustomDateRange)}
                        className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                      >
                        {showCustomDateRange ? '收起' : '自定义'}
                      </button>
                    </div>
                    <CalendarFilter
                      selectedDate={selectedDate}
                      onDateSelect={(date) => {
                        if (date) {
                          setSelectedDate(date);
                          setDateRangeStart(null);
                          setDateRangeEnd(null);
                        } else {
                          setSelectedDate(null);
                        }
                      }}
                      hasLogDates={new Set()}
                      dateRangeStart={dateRangeStart}
                      dateRangeEnd={dateRangeEnd}
                      onDateRangeSelect={(start, end) => {
                        setDateRangeStart(start);
                        setDateRangeEnd(end);
                      }}
                    />
                    {/* 自定义时间段筛选 */}
                    {showCustomDateRange && (
                      <div className="mt-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="date"
                            value={dateRangeStart ? `${dateRangeStart.getFullYear()}-${String(dateRangeStart.getMonth() + 1).padStart(2, '0')}-${String(dateRangeStart.getDate()).padStart(2, '0')}` : ''}
                            onChange={(e) => {
                              const date = e.target.value ? new Date(e.target.value) : null;
                              setDateRangeStart(date);
                              setSelectedDate(null);
                            }}
                            className="flex-1 px-2.5 py-1.5 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 input-focus"
                          />
                          <span className="text-xs text-slate-400">至</span>
                          <input
                            type="date"
                            value={dateRangeEnd ? `${dateRangeEnd.getFullYear()}-${String(dateRangeEnd.getMonth() + 1).padStart(2, '0')}-${String(dateRangeEnd.getDate()).padStart(2, '0')}` : ''}
                            onChange={(e) => {
                              const date = e.target.value ? new Date(e.target.value + 'T23:59:59') : null;
                              setDateRangeEnd(date);
                              setSelectedDate(null);
                            }}
                            className="flex-1 px-2.5 py-1.5 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 input-focus"
                          />
                        </div>
                        {(dateRangeStart || dateRangeEnd) && (
                          <button
                            onClick={() => {
                              setDateRangeStart(null);
                              setDateRangeEnd(null);
                            }}
                            className="w-full text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                          >
                            清除时间段
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* 快速筛选 */}
                  <div className="px-4 py-4 border-b border-slate-200 dark:border-slate-700">
                    <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-3 uppercase tracking-wider">
                      快速筛选
                    </h3>
                    <div className="space-y-1">
                      <button
                        onClick={() => { clearAllFilters(); }}
                        className={`w-full text-left px-3 py-2 text-sm rounded-lg transition-all duration-150 ${
                          !selectedDate && !filterTag && !dateRangeStart && !dateRangeEnd
                            ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium border-l-2 border-blue-500'
                            : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                        }`}
                      >
                        全部记录
                      </button>
                      <button
                        onClick={() => {
                          clearAllFilters();
                          setSelectedDate(new Date());
                        }}
                        className={`w-full text-left px-3 py-2 text-sm rounded-lg transition-all duration-150 ${
                          selectedDate && isSameDay(selectedDate, new Date())
                            ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium border-l-2 border-blue-500'
                            : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                        }`}
                      >
                        今日记录
                      </button>
                      <button
                        onClick={() => {
                          clearAllFilters();
                          const now = new Date();
                          const weekAgo = new Date();
                          weekAgo.setDate(now.getDate() - 7);
                          setDateRangeStart(weekAgo);
                          setDateRangeEnd(now);
                        }}
                        className={`w-full text-left px-3 py-2 text-sm rounded-lg transition-all duration-150 ${
                          (() => {
                            const now = new Date();
                            const weekAgo = new Date();
                            weekAgo.setDate(now.getDate() - 7);
                            return dateRangeStart && dateRangeEnd &&
                              isSameDay(dateRangeStart, weekAgo) &&
                              isSameDay(dateRangeEnd, now);
                          })()
                            ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium border-l-2 border-blue-500'
                            : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                        }`}
                      >
                        近一周记录
                      </button>
                    </div>
                  </div>

                  {/* 标签筛选模块 */}
                  {tagOptions.length > 0 && (
                    <div className="px-4 py-4">
                      <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-3 uppercase tracking-wider">
                        标签筛选
                      </h3>
                      <div className="space-y-1">
                        {tagOptions.slice(0, tagsExpanded ? tagOptions.length : 3).map((tag) => (
                          <button
                            key={tag.value}
                            onClick={() => toggleTagFilter(tag.value)}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-all duration-150 ${
                              filterTag === tag.value
                                ? 'bg-slate-100 dark:bg-slate-800 border-l-2 border-slate-400 dark:border-slate-600'
                                : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <TagBadge tag={tag.label} />
                            </div>
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                              {tag.count}
                            </span>
                          </button>
                        ))}
                        {tagOptions.length > 3 && (
                          <button
                            onClick={() => setTagsExpanded(!tagsExpanded)}
                            className="w-full text-left px-3 py-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                          >
                            {tagsExpanded ? '收起' : `更多 (${tagOptions.length - 3})`}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </aside>

          {/* 右侧主内容区 */}
          <main className="flex-1 flex flex-col h-full overflow-hidden ml-6">
            {/* 页面工具栏 */}
            <div className="flex items-center justify-between mb-4 shrink-0 gap-4 flex-wrap z-20 relative">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {/* 搜索框 */}
                <div className="relative flex-shrink-0" style={{ minWidth: '200px', maxWidth: '400px', width: '100%' }}>
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    placeholder="搜索日志内容、标签..."
                    className="pl-9 pr-8 h-9 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all w-full min-w-[200px] max-w-[400px]"
                  />
                  {search && (
                    <button
                      onClick={handleClearSearch}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* 清除筛选按钮 */}
                {(selectedDate || filterTag || dateRangeStart || dateRangeEnd) && (
                  <>
                    <button
                      onClick={clearAllFilters}
                      className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                    >
                      清除筛选
                    </button>
                    {/* 显示当前筛选条件 */}
                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      {selectedDate && (
                        <span className="px-2.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-md">
                          {formatDateLocal(selectedDate, resolvedLanguage)}
                        </span>
                      )}
                      {dateRangeStart && dateRangeEnd && (
                        <span className="px-2.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-md">
                          {isSameDay(dateRangeStart, dateRangeEnd) 
                            ? formatDateLocal(dateRangeStart, resolvedLanguage)
                            : `${formatDateLocal(dateRangeStart, resolvedLanguage)} 至 ${formatDateLocal(dateRangeEnd, resolvedLanguage)}`
                          }
                        </span>
                      )}
                      {filterTag && (
                        <TagBadge tag={filterTag} />
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* 展开/折叠全部按钮 */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={expandAll}
                  className="flex items-center gap-1.5 px-3 h-9 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 rounded-lg transition-all duration-150"
                >
                  <Expand className="w-4 h-4" />
                  展开全部
                </button>
                <button
                  onClick={collapseAll}
                  className="flex items-center gap-1.5 px-3 h-9 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 rounded-lg transition-all duration-150"
                >
                  <FoldVertical className="w-4 h-4" />
                  折叠全部
                </button>
                
                {/* 导出按钮 */}
                <div className="relative" ref={exportMenuRef}>
                  <button 
                    onClick={() => setShowExportMenu(!showExportMenu)}
                    className={`flex items-center gap-2 px-3 h-9 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-400 transition-all duration-150 ${showExportMenu ? 'bg-slate-100 dark:bg-slate-800/50' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
                  >
                    <Download className="w-4 h-4" />
                    <span className="text-sm">{t('common.export')}</span>
                  </button>
                  <div className={`absolute right-0 top-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg transition-all duration-150 z-30 ${showExportMenu ? 'opacity-100 visible' : 'opacity-0 invisible'}`}>
                    <button
                      onClick={async () => {
                        setShowExportMenu(false);
                        const hasFilters = selectedDate || filterTag || dateRangeStart || dateRangeEnd || searchKeyword;
                        const logIds = hasFilters ? filteredLogs.map(log => log.id) : undefined;
                        if (hasFilters) {
                          toast.success(`将导出筛选后的 ${filteredLogs.length} 条日志`);
                        }
                        const path = await window.api.export.logs('csv', logIds);
                        if (path) toast.success(hasFilters ? `${t('worklog.exportedCsv')}（${filteredLogs.length} 条）` : t('worklog.exportedCsv'));
                      }}
                      className="block w-full px-4 py-2.5 text-sm text-left text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-t-xl whitespace-nowrap transition-colors"
                    >
                      {t('worklog.exportCsv')}
                    </button>
                    <button
                      onClick={async () => {
                        setShowExportMenu(false);
                        const hasFilters = selectedDate || filterTag || dateRangeStart || dateRangeEnd || searchKeyword;
                        const logIds = hasFilters ? filteredLogs.map(log => log.id) : undefined;
                        if (hasFilters) {
                          toast.success(`将导出筛选后的 ${filteredLogs.length} 条日志`);
                        }
                        const path = await window.api.export.logs('markdown', logIds);
                        if (path) toast.success(hasFilters ? `${t('worklog.exportedMarkdown')}（${filteredLogs.length} 条）` : t('worklog.exportedMarkdown'));
                      }}
                      className="block w-full px-4 py-2.5 text-sm text-left text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-b-xl whitespace-nowrap transition-colors"
                    >
                      {t('worklog.exportMarkdown')}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* 搜索信息 */}
            {searchKeyword && (
              <div className="mb-4 text-sm text-slate-500 dark:text-slate-400 shrink-0">
                {t('worklog.searchInfo', { keyword: searchKeyword, count: logs.length })}
                <button onClick={handleClearSearch} className="ml-2 text-blue-600 dark:text-blue-400 hover:underline transition-colors">
                  {t('common.clear')}
                </button>
              </div>
            )}

            {/* 独立滚动区域 */}
            <div className="flex-1 overflow-y-auto scrollbar-thin" style={{ scrollbarGutter: 'stable' }}>
              {/* 空状态 */}
              {filteredLogs.length === 0 ? (
                <div className="text-center py-20 animate-fade-in">
                  <Calendar className="w-16 h-16 mx-auto text-slate-300 dark:text-slate-600 mb-6" />
                  {searchKeyword ? (
                    <>
                      <p className="text-slate-600 dark:text-slate-300 text-lg mb-2">{t('worklog.noResults')}</p>
                      <p className="text-sm text-slate-400">{t('worklog.tryOtherKeywords')}</p>
                    </>
                  ) : selectedDate || filterTag || dateRangeStart || dateRangeEnd ? (
                    <>
                      <p className="text-slate-600 dark:text-slate-300 text-lg mb-2">当前筛选条件下没有记录</p>
                      <p className="text-sm text-slate-400">尝试调整筛选条件</p>
                    </>
                  ) : (
                    <>
                      <p className="text-slate-600 dark:text-slate-300 text-xl mb-4">今天还没有工作记录</p>
                      <p className="text-sm text-slate-400 mb-6">开始你的第一条日志吧 ✨</p>
                      {/* 示例输入 */}
                      <div className="max-w-md mx-auto text-left">
                        <div className="bg-white dark:bg-slate-900 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-700">
                          <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">试试输入：</p>
                          <p className="text-slate-900 dark:text-slate-100">修复支付页面问题 #前端</p>
                        </div>
                        <div className="mt-3 text-center text-xs text-slate-400">
                          <p>Enter 保存 · #标签 自动分类</p>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                /* 日志列表 - 按日期分组 */
                <div className="space-y-0">
                  {Array.from(grouped.entries()).map(([dateKey, dateLogs]) => {
                    const isCollapsed = collapsedDates.has(dateKey);
                    const isToday = isTodayDateKey(dateKey);
                    return (
                      <div key={dateKey}>
                        {/* 分组标题 */}
                        <div className="sticky top-0 z-10 py-2 bg-white dark:bg-slate-900">
                          <button
                            onClick={() => toggleDateCollapse(dateKey)}
                            className="w-full flex items-center gap-2 text-left hover:bg-slate-100/50 dark:hover:bg-slate-800/50 rounded-lg px-2 py-1 -ml-2 transition-colors"
                          >
                          {isCollapsed ? (
                            <ChevronRight className="w-4 h-4 text-slate-400" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-slate-400" />
                          )}
                          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                            {formatDate(dateKey + 'T00:00:00', resolvedLanguage)}
                          </h3>
                          <span className="text-slate-500 dark:text-slate-400 text-sm">
                            {formatWeekday(dateKey + 'T00:00:00', resolvedLanguage)}
                          </span>
                          {isToday && (
                            <span className="text-blue-600 dark:text-blue-400 text-sm font-medium">
                              今日
                            </span>
                          )}
                          <span className="text-slate-400 dark:text-slate-500 text-sm">
                            · {dateLogs.length} 条
                          </span>
                          </button>
                        </div>

                        {/* 日志内容 */}
                        {!isCollapsed && (
                          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden mb-4">
                            {dateLogs.map((log, index) => {
                              const tags = log.categories || [];
                              const isExpanded = expandedLogTags.has(log.id);
                              const visibleTags = isExpanded ? tags : tags.slice(0, 2);
                              const hiddenTagsCount = tags.length - 2;
                              
                              return (
                                <div
                                  key={log.id}
                                  className={`group p-4 transition-all duration-150 ${
                                    index < dateLogs.length - 1 
                                      ? 'border-b border-slate-100 dark:border-slate-800' 
                                      : ''
                                  } hover:bg-slate-50 dark:hover:bg-slate-800/30`}
                                >
                                  <div className="flex items-start gap-4">
                                    {/* 时间 */}
                                    <div className="shrink-0 w-14 pt-0.5 text-right">
                                      <span className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                                        {formatTime(log.created_at)}
                                      </span>
                                    </div>
                                    
                                    {/* 内容区 */}
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1 min-w-0">
                                          <div className="contents">
                                            <span className="text-slate-900 dark:text-slate-100 text-base leading-relaxed break-words inline">
                                              {log.content}
                                            </span>
                                            {/* 标签 */}
                                            {tags.length > 0 && (
                                              <span className="inline-flex flex-wrap items-center gap-1.5 ml-2">
                                                {visibleTags.map((tag) => (
                                                  <button
                                                    key={tag}
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      toggleTagFilter(tag);
                                                    }}
                                                  >
                                                    <TagBadge tag={tag} />
                                                  </button>
                                                ))}
                                                {!isExpanded && hiddenTagsCount > 0 && (
                                                  <button
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      toggleLogTagsExpand(log.id);
                                                    }}
                                                    className="text-xs text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 px-2 py-0.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                                                  >
                                                    +{hiddenTagsCount}
                                                  </button>
                                                )}
                                                {isExpanded && (
                                                  <button
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      toggleLogTagsExpand(log.id);
                                                    }}
                                                    className="text-xs text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 px-2 py-0.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                                                  >
                                                    ←
                                                  </button>
                                                )}
                                              </span>
                                            )}
                                          </div>
                                          
                                          {/* 备注 */}
                                          {log.note && (
                                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5">
                                              {log.note}
                                            </p>
                                          )}
                                        </div>
                                        
                                        {/* 操作按钮 */}
                                        <div className="shrink-0 flex items-center gap-1 ml-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleCopy(log.content);
                                            }}
                                            className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                                            title="复制"
                                          >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                            </svg>
                                          </button>
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleDelete(log.id);
                                            }}
                                            className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                            title="删除"
                                          >
                                            <X className="w-4 h-4" />
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* 加载更多 */}
                  {hasMore && !searchKeyword && !selectedDate && !filterTag && !dateRangeStart && !dateRangeEnd && (
                    <div className="text-center py-8">
                      <button
                        onClick={loadMore}
                        disabled={loading}
                        className="text-sm text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 disabled:opacity-50 transition-colors"
                      >
                        {loading ? t('common.loading') : t('worklog.loadMore')}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </main>
        </div>
      </div>

      {/* 撤销删除提示 */}
      {lastDeleted && undoCountdown > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 px-5 py-3.5 bg-slate-900 dark:bg-slate-800 text-white rounded-xl shadow-xl text-sm animate-slide-up z-50">
          <span>{t('worklog.deletedOne')}</span>
          <button
            onClick={async () => {
              await undoDelete();
              toast.success(t('worklog.restored'));
              fetchTags();
              clearInterval(undoTimerRef.current);
              setUndoCountdown(0);
            }}
            className="flex items-center gap-1 font-medium text-blue-400 hover:text-blue-300 transition-colors"
          >
            撤销
          </button>
          <span className="text-slate-400 text-xs">({undoCountdown}s)</span>
        </div>
      )}
    </div>
  );
}

export default function WorkLogPage() {
  return (
    <WorkLogErrorBoundary>
      <WorkLogPageContent />
    </WorkLogErrorBoundary>
  );
}
