import { useEffect, useState, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { restrictToWindowEdges } from '@dnd-kit/modifiers'
import { Plus, Trash2, GripVertical, Archive, ChevronRight, ChevronLeft, ChevronDown, Calendar, Pencil, Check, X, FileText, CheckCircle2 } from 'lucide-react'
import { useTaskStore } from '../stores/taskStore'
import { useTagStore } from '../stores/tagStore'
import { useToast } from '../components/Toast'
import { useI18n } from '../stores/languageStore'
import { TagBadge } from '../components/TagBadge'
import { TagSelector, TagSelectorPortal } from '../components/TagSelector'

interface Task {
  id: number
  title: string
  description: string
  status: 'todo' | 'in_progress' | 'done' | 'draft'
  position: number
  due_date: string | null
  category: string
  categories: string[]
  collapsed?: boolean
  completed_at?: string | null
}

type ColumnId = 'todo' | 'in_progress' | 'done'
type DroppableId = ColumnId | 'draft'

const COLUMNS: { id: ColumnId; labelKey: 'kanban.todo' | 'kanban.inProgress' | 'kanban.done'; color: string }[] = [
  { id: 'todo', labelKey: 'kanban.todo', color: 'border-mywork-light-border dark:border-mywork-dark-border' },
  { id: 'in_progress', labelKey: 'kanban.inProgress', color: 'border-mywork-primary' },
  { id: 'done', labelKey: 'kanban.done', color: 'border-mywork-success' }
]

const ALL_DROPPABLE_IDS: DroppableId[] = ['todo', 'in_progress', 'done', 'draft']
const SAVE_SHORTCUT_LABEL = navigator.userAgent.includes('Mac') ? '⌘+Enter' : 'Ctrl+Enter'

// --- Droppable Column Wrapper ---
function DroppableColumn ({
  id,
  children
}: {
  id: string
  children: React.ReactNode
}): JSX.Element {
  const { setNodeRef, isOver } = useDroppable({ id })

  return (
    <div
      ref={setNodeRef}
      className={`min-h-[100px] rounded-xl transition-all duration-200 ${
        isOver 
          ? 'bg-blue-50 dark:bg-blue-900/20 ring-2 ring-blue-300 dark:ring-blue-700' 
          : ''
      }`}
    >
      {children}
    </div>
  )
}

// --- Sortable Task Card ---
function getDueDateStatus(due: string | null): 'normal' | 'soon' | 'overdue' | null {
  if (!due) return null
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const dueDate = new Date(due + 'T00:00:00')
  const diff = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  if (diff < 0) return 'overdue'
  if (diff <= 2) return 'soon'
  return 'normal'
}

function formatDue(due: string): string {
  const d = new Date(due + 'T00:00:00')
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function formatCompletedAt(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const CARD_TITLE_MAX_CHARS = 50
const CARD_DESC_MAX_CHARS = 80

// Portal date picker — renders outside dnd-kit transform context so native picker positions correctly
function DatePickerPortal({
  anchorRect,
  defaultValue,
  onChange,
  onClose
}: {
  anchorRect: DOMRect
  defaultValue: string
  onChange: (value: string) => void
  onClose: () => void
}): JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // Auto-open the native picker after mount
    requestAnimationFrame(() => inputRef.current?.showPicker?.())
  }, [])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent): void => {
      if (inputRef.current && !inputRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  // Position below the anchor button
  const top = anchorRect.bottom + 4
  const left = anchorRect.left

  return createPortal(
    <div className="fixed z-[100]" style={{ top, left }}>
      <input
        ref={inputRef}
        type="date"
        defaultValue={defaultValue}
        onChange={(e) => {
          onChange(e.target.value)
          onClose()
        }}
        onBlur={onClose}
        onKeyDown={(e) => e.key === 'Escape' && onClose()}
        className="text-xs border border-mywork-light-border dark:border-mywork-dark-border rounded-input px-2 py-1 outline-none bg-mywork-card dark:bg-zinc-700 dark:text-mywork-dark-text shadow-primary"
      />
    </div>,
    document.body
  )
}

function SortableTaskCard({
  task,
  onDelete,
  onSetDue,
  onUpdate,
  tags,
  onStatusChange,
  onComplete,
  onCancelComplete,
  showCompletedTime,
  collapsed,
  onToggleCollapse,
  isCompleteExpanded
}: {
  task: Task
  onDelete: (id: number) => void
  onSetDue?: (id: number, date: string | null) => void
  onUpdate?: (id: number, updates: { title?: string; description?: string; categories?: string[] }) => void
  tags?: string[]
  onStatusChange?: (id: number, status: string) => void
  onComplete?: (id: number, logContent: string) => void
  onCancelComplete?: (id: number) => void
  showCompletedTime?: boolean
  collapsed?: boolean
  onToggleCollapse?: () => void
  isCompleteExpanded?: boolean
}): JSX.Element {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id })
  const [pickerRect, setPickerRect] = useState<DOMRect | null>(null)
  const [tagSelectorRect, setTagSelectorRect] = useState<DOMRect | null>(null)
  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(task.title)
  const [editDesc, setEditDesc] = useState(task.description)
  const [logContent, setLogContent] = useState('')
  const titleInputRef = useRef<HTMLInputElement>(null)
  const logInputRef = useRef<HTMLTextAreaElement>(null)
  const { t } = useI18n()

  useEffect(() => {
    if (isCompleteExpanded) {
      setLogContent(t('kanban.completeLogDefault', { title: task.title }))
      setTimeout(() => {
        logInputRef.current?.focus()
        logInputRef.current?.select()
      }, 100)
    }
  }, [isCompleteExpanded, task.title, t])

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1
  }

  const dueStatus = getDueDateStatus(task.due_date)
  const dueColor = dueStatus === 'overdue'
    ? 'text-red-500 dark:text-red-400'
    : dueStatus === 'soon'
      ? 'text-amber-500 dark:text-amber-400'
      : 'text-slate-500 dark:text-slate-400'

  const canEdit = task.status !== 'done' && onUpdate

  const startEdit = useCallback(() => {
    if (!canEdit) return
    setEditTitle(task.title)
    setEditDesc(task.description)
    setEditing(true)
    requestAnimationFrame(() => titleInputRef.current?.focus())
  }, [canEdit, task.title, task.description])

  const saveEdit = useCallback(() => {
    const trimmedTitle = editTitle.trim()
    if (!trimmedTitle) return // don't save empty title
    const changes: { title?: string; description?: string } = {}
    if (trimmedTitle !== task.title) changes.title = trimmedTitle
    if (editDesc.trim() !== task.description) changes.description = editDesc.trim()
    if (Object.keys(changes).length > 0) {
      onUpdate?.(task.id, changes)
    }
    setEditing(false)
  }, [editTitle, editDesc, task, onUpdate])

  const cancelEdit = useCallback(() => {
    setEditing(false)
    setEditTitle(task.title)
    setEditDesc(task.description)
  }, [task.title, task.description])

  const handleEditKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      saveEdit()
    } else if (e.key === 'Escape') {
      cancelEdit()
    }
  }, [saveEdit, cancelEdit])

  const openPicker = useCallback((e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setPickerRect(rect)
  }, [])

  const handleDateChange = useCallback((value: string): void => {
    onSetDue?.(task.id, value || null)
  }, [onSetDue, task.id])

  const closePicker = useCallback(() => setPickerRect(null), [])

  const isCollapsed = collapsed && !editing

  const handleCompleteKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      onComplete?.(task.id, logContent)
    }
    if (e.key === 'Escape') {
      onCancelComplete?.(task.id)
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex items-start gap-3 p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm hover:shadow-md transition-all duration-150 card-hover animate-pop-in ${
        isCollapsed ? 'cursor-pointer' : ''
      } ${isCompleteExpanded ? 'ring-2 ring-blue-400 dark:ring-blue-500' : ''} ${
        isDragging ? 'opacity-50 shadow-lg scale-[1.02]' : ''
      }`}
      onClick={isCollapsed ? onToggleCollapse : undefined}
    >
      {!isCollapsed && !isCompleteExpanded && (
        <button
          {...attributes}
          {...listeners}
          className="mt-0.5 p-1 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 cursor-grab active:cursor-grabbing shrink-0 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
        >
          <GripVertical className="w-4 h-4" />
        </button>
      )}
      <div className="flex-1 min-w-0">
        {isCompleteExpanded ? (
          <div className="space-y-3" onKeyDown={handleCompleteKeyDown}>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-500 dark:text-emerald-400 shrink-0" />
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100 break-words">
                {task.title}
              </p>
            </div>
            {tags && tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 items-center">
                {tags.map((tag) => (
                  <TagBadge key={tag} tag={tag} />
                ))}
                <span className="text-xs text-slate-500 dark:text-slate-400 self-center ml-1">
                  {t('kanban.tagsWillCarry')}
                </span>
              </div>
            )}
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {t('kanban.completePrompt')}
            </p>
            <textarea
              ref={logInputRef}
              value={logContent}
              onChange={(e) => setLogContent(e.target.value)}
              rows={3}
              className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 bg-white dark:bg-slate-900 dark:text-slate-100 resize-none"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => onCancelComplete?.(task.id)}
                className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                {t('common.skip')}
              </button>
              <button
                onClick={() => onComplete?.(task.id, logContent)}
                className="px-3 py-1.5 text-xs bg-emerald-500 dark:bg-emerald-600 text-white rounded-lg hover:bg-emerald-600 dark:hover:bg-emerald-500 transition-colors shadow-sm"
              >
                {t('kanban.completeSubmit')}
              </button>
            </div>
          </div>
        ) : editing ? (
          <div className="space-y-2" onKeyDown={handleEditKeyDown}>
            <input
              ref={titleInputRef}
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 bg-white dark:bg-slate-900 dark:text-slate-100 input-focus"
              placeholder={t('kanban.taskTitle')}
            />
            <textarea
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-600 rounded-lg outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 bg-white dark:bg-slate-900 dark:text-slate-100 resize-none input-focus"
              placeholder={t('kanban.descriptionPlaceholder')}
              rows={2}
            />
            <div className="flex items-center gap-1.5">
              <button
                onClick={saveEdit}
                className="p-1.5 text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-md transition-colors"
                title={t('kanban.saveShortcut', { shortcut: SAVE_SHORTCUT_LABEL })}
              >
                <Check className="w-4 h-4" />
              </button>
              <button
                onClick={cancelEdit}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md transition-colors"
                title={t('kanban.cancelShortcut')}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <p
                className={`text-sm text-slate-900 dark:text-slate-100 break-words ${canEdit ? 'cursor-pointer hover:text-blue-600 dark:hover:text-blue-400' : ''} ${isCollapsed ? 'truncate' : ''}`}
                onDoubleClick={startEdit}
                onClick={isCollapsed ? undefined : (e) => e.stopPropagation()}
                title={!isCollapsed && task.title.length > CARD_TITLE_MAX_CHARS ? task.title : undefined}
              >
                {!isCollapsed && task.title.length > CARD_TITLE_MAX_CHARS
                  ? task.title.slice(0, CARD_TITLE_MAX_CHARS) + '...'
                  : task.title}
              </p>
              {isCollapsed && onToggleCollapse && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onToggleCollapse()
                  }}
                  className="p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            {!isCollapsed && task.description && (
              <p
                className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 break-words"
                title={task.description.length > CARD_DESC_MAX_CHARS ? task.description : undefined}
              >
                {task.description.length > CARD_DESC_MAX_CHARS
                  ? task.description.slice(0, CARD_DESC_MAX_CHARS) + '...'
                  : task.description}
              </p>
            )}
            {!isCollapsed && (
              <div className="mt-2 flex flex-wrap gap-1.5 items-center">
                {tags && tags.length > 0 && tags.map((tag) => (
                  <span
                    key={tag}
                    onClick={canEdit ? (e) => {
                      setTagSelectorRect((e.currentTarget as HTMLElement).getBoundingClientRect())
                    } : undefined}
                  >
                    <TagBadge key={tag} tag={tag} />
                  </span>
                ))}
                {canEdit && (!tags || tags.length === 0) && (
                  <button
                    onClick={(e) => {
                      setTagSelectorRect((e.currentTarget as HTMLElement).getBoundingClientRect())
                    }}
                    className="opacity-0 group-hover:opacity-100 text-[11px] px-2 py-0.5 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:border-slate-400 dark:hover:border-slate-500 transition-all duration-150"
                  >
                    + {t('tag.select')}
                  </button>
                )}
              </div>
            )}
          </>
        )}
        {!editing && !isCompleteExpanded && !isCollapsed && (
          <div className="flex items-center gap-3 mt-2">
            {onSetDue && (
              <>
                {task.due_date ? (
                  <button
                    onClick={openPicker}
                    className={`flex items-center gap-1 text-xs ${dueColor}`}
                    title={t('kanban.dueTitle', { date: task.due_date })}
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    {formatDue(task.due_date)}
                  </button>
                ) : (
                  <button
                    onClick={openPicker}
                    className="opacity-0 group-hover:opacity-100 flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition-all duration-150"
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    {t('kanban.due')}
                  </button>
                )}
                {pickerRect && (
                  <DatePickerPortal
                    anchorRect={pickerRect}
                    defaultValue={task.due_date || ''}
                    onChange={handleDateChange}
                    onClose={closePicker}
                  />
                )}
              </>
            )}
            {showCompletedTime && task.completed_at && (
              <span className="text-[11px] text-slate-400 dark:text-slate-500 ml-auto">
                {formatCompletedAt(task.completed_at)}
              </span>
            )}
          </div>
        )}
      </div>
      {!editing && !isCompleteExpanded && !isCollapsed && (
        <div className="flex items-center gap-0.5 shrink-0">
          {canEdit && (
            <button
              onClick={startEdit}
              className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-blue-500 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all duration-150"
              aria-label={t('kanban.editTask')}
            >
              <Pencil className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => onDelete(task.id)}
            className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all duration-150"
            aria-label={t('kanban.deleteTask')}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )}
      {tagSelectorRect && (
        <TagSelectorPortal
          anchorRect={tagSelectorRect}
          selectedTags={tags || []}
          onTagsChange={(newTags) => {
            onUpdate?.(task.id, { categories: newTags })
          }}
          onClose={() => setTagSelectorRect(null)}
        />
      )}
    </div>
  )
}

// --- Overlay Card (while dragging) ---
function TaskCardOverlay({ task }: { task: Task }): JSX.Element {
  return (
    <div className="p-3 bg-mywork-card dark:bg-zinc-800 border border-mywork-light-border dark:border-mywork-dark-border rounded-card shadow-hover rotate-2 scale-105">
      <p className="text-sm text-mywork-light-text dark:text-mywork-dark-text">{task.title}</p>
    </div>
  )
}



// --- Main Kanban Page ---
function KanbanPage(): JSX.Element {
  const tasks = useTaskStore(s => s.tasks)
  const fetchTasks = useTaskStore(s => s.fetchTasks)
  const addTask = useTaskStore(s => s.addTask)
  const updateTask = useTaskStore(s => s.updateTask)
  const deleteTask = useTaskStore(s => s.deleteTask)
  const completeTask = useTaskStore(s => s.completeTask)
  const reorderTasks = useTaskStore(s => s.reorderTasks)
  const tagList = useTagStore(s => s.tags)
  const fetchTags = useTagStore(s => s.fetchTags)
  const toast = useToast()
  const { t } = useI18n()
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [newTaskDesc, setNewTaskDesc] = useState('')
  const [showDescInput, setShowDescInput] = useState(false)
  const [draftInput, setDraftInput] = useState('')
  const [activeTask, setActiveTask] = useState<Task | null>(null)
  const [pendingComplete, setPendingComplete] = useState<Task | null>(null)
  const [localTasks, setLocalTasks] = useState<Task[]>([])
  const [draftOpen, setDraftOpen] = useState(false)
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [collapsedTasks, setCollapsedTasks] = useState<Set<number>>(new Set())
  const [expandedCompleteTaskId, setExpandedCompleteTaskId] = useState<number | null>(null)

  useEffect(() => {
    fetchTasks()
    fetchTags()
  }, [])

  useEffect(() => {
    setLocalTasks(tasks)
  }, [tasks])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  const getColumnTasks = (columnId: DroppableId): Task[] => {
    const filtered = localTasks.filter((t) => t.status === columnId)
    if (columnId === 'done') {
      return filtered.sort((a, b) => {
        const ta = a.completed_at ? new Date(a.completed_at).getTime() : 0
        const tb = b.completed_at ? new Date(b.completed_at).getTime() : 0
        return tb - ta
      })
    }
    return filtered.sort((a, b) => a.position - b.position)
  }

  const findTaskColumn = (taskId: number | string): DroppableId | null => {
    const task = localTasks.find((t) => t.id === taskId)
    return (task?.status as DroppableId) || null
  }

  const handleAddTask = async (): Promise<void> => {
    if (!newTaskTitle.trim()) return
    await addTask(newTaskTitle.trim(), newTaskDesc.trim() || undefined, undefined, selectedTags)
    setNewTaskTitle('')
    setNewTaskDesc('')
    setShowDescInput(false)
    setSelectedTags([])
  }

  const handleAddDraft = async (): Promise<void> => {
    if (!draftInput.trim()) return
    await addTask(draftInput.trim(), undefined, 'draft')
    setDraftInput('')
  }

  const toggleTaskCollapse = (taskId: number): void => {
    setCollapsedTasks((prev) => {
      const next = new Set(prev)
      if (next.has(taskId)) {
        next.delete(taskId)
      } else {
        next.add(taskId)
      }
      return next
    })
  }

  const handleDragStart = (event: DragStartEvent): void => {
    const task = localTasks.find((t) => t.id === event.active.id)
    setActiveTask(task || null)
  }

  const handleDragOver = (event: DragOverEvent): void => {
    const { active, over } = event
    if (!over) return

    const activeId = active.id as number
    const overId = over.id

    // Determine which column the "over" element belongs to
    let overColumn: DroppableId | null = null
    if (ALL_DROPPABLE_IDS.includes(overId as DroppableId)) {
      // Dropped over a column container directly
      overColumn = overId as DroppableId
    } else {
      // Dropped over a task — find that task's column
      overColumn = findTaskColumn(overId as number)
    }

    if (!overColumn) return

    const activeTaskItem = localTasks.find((t) => t.id === activeId)
    if (!activeTaskItem || activeTaskItem.status === overColumn) return

    // Move task to new column optimistically
    setLocalTasks((prev) =>
      prev.map((t) =>
        t.id === activeId ? { ...t, status: overColumn! } : t
      )
    )
  }

  const handleDragEnd = async (event: DragEndEvent): Promise<void> => {
    setActiveTask(null)
    const { active, over } = event
    if (!over) {
      // Cancelled drag — revert
      setLocalTasks(tasks)
      return
    }

    const activeId = active.id as number
    const task = localTasks.find((t) => t.id === activeId)
    if (!task) return

    // Determine target column
    let targetColumn: DroppableId = task.status as DroppableId
    if (ALL_DROPPABLE_IDS.includes(over.id as DroppableId)) {
      targetColumn = over.id as DroppableId
    } else {
      const overTask = localTasks.find((t) => t.id === over.id)
      if (overTask) targetColumn = overTask.status as DroppableId
    }

    // If moved to done, show inline complete interface
    const originalTask = tasks.find((t) => t.id === activeId)
    if (targetColumn === 'done' && originalTask?.status !== 'done') {
      // First update local state to show task in done column with current time
      setLocalTasks(localTasks.map(t => t.id === activeId ? { ...t, status: 'done', completed_at: new Date().toISOString() } : t))
      setExpandedCompleteTaskId(activeId)
      return
    }

    // Reorder within the column
    const columnTasks = localTasks
      .filter((t) => t.status === targetColumn)
      .sort((a, b) => a.position - b.position)

    const oldIndex = columnTasks.findIndex((t) => t.id === activeId)
    const overIndex = columnTasks.findIndex((t) => t.id === over.id)

    if (oldIndex !== -1 && overIndex !== -1 && oldIndex !== overIndex) {
      const reordered = arrayMove(columnTasks, oldIndex, overIndex)
      await reorderTasks(reordered.map((t) => t.id), targetColumn)
    } else {
      const ids = columnTasks.map((t) => t.id)
      await reorderTasks(ids, targetColumn)
    }
  }

  const handleComplete = async (id: number, logContent: string): Promise<void> => {
    await completeTask(id, logContent)
    setExpandedCompleteTaskId(null)
    toast.success(t('kanban.completedToast'))
  }

  const handleCancelComplete = async (id: number): Promise<void> => {
    setExpandedCompleteTaskId(null)
    await fetchTasks()
  }

  const handleSetDue = async (id: number, date: string | null): Promise<void> => {
    await updateTask(id, { due_date: date })
  }

  const handleStatusChange = (id: number, status: string): void => {
    if (status === 'done') {
      const task = localTasks.find((t) => t.id === id)
      if (task) setPendingComplete(task)
    } else {
      updateTask(id, { status: status as Task['status'] })
    }
  }

  const handleUpdate = async (id: number, updates: { title?: string; description?: string; categories?: string[] }): Promise<void> => {
    await updateTask(id, updates)
  }

  const handleDelete = async (id: number): Promise<void> => {
    await deleteTask(id)
  }

  const draftTasks = getColumnTasks('draft')

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      modifiers={[restrictToWindowEdges]}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="h-full flex flex-col">
        {/* 页面工具栏 */}
        <div className="bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-700/50 shrink-0">
          {/* 快速添加任务栏 */}
          <div className="px-6 py-4">
            <div className="flex gap-3 flex-wrap">
              <div className="flex-1 flex flex-col gap-3 min-w-[300px]">
                {/* 主输入框 */}
                <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors duration-150 pointer-events-none">
                    <Plus className="w-5 h-5" />
                  </div>
                  <input
                    type="text"
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleAddTask()}
                    onFocus={() => setShowDescInput(true)}
                    placeholder={t('kanban.newTask')}
                    className="w-full pl-12 pr-4 h-12 border-2 border-slate-200 dark:border-slate-700 rounded-xl text-base outline-none bg-white dark:bg-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 
                    focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10
                    hover:border-slate-300 dark:hover:border-slate-600
                    transition-all duration-150 shadow-sm"
                  />
                </div>

                {/* 次要输入框 */}
                {showDescInput && (
                  <div className="relative animate-fade-in-up">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                      <FileText className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      value={newTaskDesc}
                      onChange={(e) => setNewTaskDesc(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
                      placeholder={t('kanban.newDescription')}
                      className="w-full pl-10 pr-4 h-11 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none bg-slate-50 dark:bg-slate-900 dark:text-slate-300 placeholder-slate-400 dark:placeholder-slate-500
                      focus:border-blue-400 focus:ring-2 focus:ring-blue-400/10
                      hover:border-slate-300 dark:hover:border-slate-600
                      transition-all duration-150"
                    />
                  </div>
                )}
              </div>

              {/* 取消按钮 */}
              {(newTaskTitle.trim() || newTaskDesc.trim() || selectedTags.length > 0) && (
                <button
                  onClick={() => {
                    setNewTaskTitle('');
                    setNewTaskDesc('');
                    setSelectedTags([]);
                    setShowDescInput(false);
                  }}
                  className="flex items-center justify-center gap-2 px-4 h-12 text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-all duration-150 shrink-0 btn-bounce"
                >
                  <X className="w-5 h-5" />
                </button>
              )}

              {/* 添加按钮 */}
              <button
                onClick={handleAddTask}
                className="flex items-center justify-center gap-2 px-6 h-12 bg-blue-500 hover:bg-blue-600 active:bg-blue-700
                text-white text-sm font-semibold rounded-xl shadow-md hover:shadow-lg
                transition-all duration-150 shrink-0 btn-bounce"
              >
                <Plus className="w-5 h-5" />
                {t('common.add')}
              </button>
            </div>
            <div className="mt-3">
              <TagSelector selectedTags={selectedTags} onTagsChange={setSelectedTags} />
            </div>
          </div>
        </div>

        {/* 主体内容 */}
        <div className="flex-1 flex overflow-hidden p-6">
          {/* Main Board Area */}
          <div className="flex-1 min-w-0 flex flex-col h-full overflow-hidden">
            {/* Board */}
            <div className="flex-1 min-h-0 flex gap-4">
              {COLUMNS.map((col) => {
                const columnTasks = getColumnTasks(col.id)

                return (
                  <div key={col.id} className="flex-1 flex flex-col min-h-0 min-w-0">
                    <div className={`flex items-center gap-3 mb-3 pb-2.5 border-b-2 ${col.color}`}>
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t(col.labelKey)}</h3>
                      <span className="text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg font-medium">
                        {columnTasks.length}
                      </span>
                    </div>
                    <SortableContext
                      items={columnTasks.map((t) => t.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <DroppableColumn id={col.id}>
                        <div className="flex-1 min-h-0 h-full overflow-y-auto overflow-x-hidden space-y-3 scrollbar-thin" style={{ scrollbarGutter: 'stable' }}>
                          {columnTasks.map((task) => (
                            <SortableTaskCard
                              key={task.id}
                              task={task}
                              onDelete={handleDelete}
                              onSetDue={handleSetDue}
                            onUpdate={handleUpdate}
                            tags={task.categories || []}
                            onStatusChange={handleStatusChange}
                            onComplete={handleComplete}
                            onCancelComplete={handleCancelComplete}
                            showCompletedTime={col.id === 'done'}
                            collapsed={collapsedTasks.has(task.id)}
                            onToggleCollapse={() => toggleTaskCollapse(task.id)}
                            isCompleteExpanded={expandedCompleteTaskId === task.id}
                            />
                          ))}
                          {columnTasks.length === 0 && (
                            <div className="text-center py-8 text-sm text-slate-400 dark:text-slate-500">
                              {t('kanban.dropHere')}
                            </div>
                          )}
                        </div>
                      </DroppableColumn>
                    </SortableContext>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Draft Box Sidebar */}
          <div
            className={`shrink-0 border-l border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl shadow-sm transition-all duration-300 ease-in-out flex flex-col ${
              draftOpen ? 'w-[280px]' : 'w-14'
            } ml-6`}
          >
            {/* Toggle Button */}
            <button
              onClick={() => {
                const next = !draftOpen
                setDraftOpen(next)
                localStorage.setItem('kanban:draftOpen', String(next))
              }}
              className="flex items-center justify-center h-12 border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all duration-150 shrink-0 rounded-t-xl"
              aria-label={draftOpen ? t('kanban.collapseDrafts') : t('kanban.expandDrafts')}
            >
              {draftOpen ? (
                <ChevronRight className="w-5 h-5" />
              ) : (
                <ChevronLeft className="w-5 h-5" />
              )}
            </button>

            {!draftOpen && (
              <div className="flex flex-col items-center gap-2 pt-4">
                <Archive className="w-5 h-5 text-slate-400 dark:text-slate-500" />
                <span className="text-xs text-slate-400 dark:text-slate-500" style={{ writingMode: 'vertical-rl' }}>
                  {t('kanban.draftsCollapsed', { count: draftTasks.length })}
                </span>
              </div>
            )}

            {draftOpen && (
              <div className="flex flex-col flex-1 overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200 dark:border-slate-700">
                  <Archive className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('kanban.drafts')}</h3>
                  <span className="text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg font-medium">
                    {draftTasks.length}
                  </span>
                </div>

                <p className="text-xs text-slate-500 dark:text-slate-400 px-4 py-3">
                  {t('kanban.draftHelp')}
                </p>

                {/* Draft Input */}
                <div className="px-4 pb-3">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={draftInput}
                      onChange={(e) => setDraftInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddDraft()}
                      placeholder={t('kanban.draftPlaceholder')}
                      className="flex-1 px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none bg-slate-50 dark:bg-slate-800 dark:text-slate-100 placeholder-slate-400 input-focus transition-all duration-150"
                    />
                    <button
                      onClick={handleAddDraft}
                      className="px-3 py-2 bg-blue-500 dark:bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-600 dark:hover:bg-blue-500 transition-colors shadow-sm"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Draft List */}
                <SortableContext
                  items={draftTasks.map((t) => t.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <DroppableColumn id="draft">
                    <div className="flex-1 overflow-y-auto px-4 space-y-3 pb-4 scrollbar-thin">
                      {draftTasks.map((task) => (
                        <SortableTaskCard
                          key={task.id}
                          task={task}
                          onDelete={handleDelete}
                          onUpdate={handleUpdate}
                          tags={task.categories || []}
                          collapsed={collapsedTasks.has(task.id)}
                          onToggleCollapse={() => toggleTaskCollapse(task.id)}
                        />
                      ))}
                      {draftTasks.length === 0 && (
                        <div className="text-center py-6 text-sm text-slate-400 dark:text-slate-500">
                          {t('kanban.noDrafts')}
                        </div>
                      )}
                    </div>
                  </DroppableColumn>
                </SortableContext>
              </div>
            )}
          </div>
        </div>

        <DragOverlay>
          {activeTask ? <TaskCardOverlay task={activeTask} /> : null}
        </DragOverlay>
      </div>
    </DndContext>
  )
}

export default KanbanPage
