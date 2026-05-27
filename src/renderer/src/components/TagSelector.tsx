import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Plus, Search, Check, X, Tag } from 'lucide-react'
import { TagBadge } from './TagBadge'
import { useI18n } from '../stores/languageStore'

interface TagSelectorProps {
  selectedTags: string[]
  onTagsChange: (tags: string[]) => void
  className?: string
  onDropdownChange?: (isOpen: boolean) => void
}

// Dropdown 组件移出主组件，避免每次重新渲染时丢失焦点
function TagDropdown({
  tags,
  selectedTags,
  searchQuery,
  setSearchQuery,
  showNewTag,
  setShowNewTag,
  newTagName,
  setNewTagName,
  dropdownPosition,
  handleTagSelect,
  handleAddNewTag,
  t,
  searchInputRef,
  newTagInputRef,
  dropdownRef,
}: {
  tags: string[]
  selectedTags: string[]
  searchQuery: string
  setSearchQuery: (v: string) => void
  showNewTag: boolean
  setShowNewTag: (v: boolean) => void
  newTagName: string
  setNewTagName: (v: string) => void
  dropdownPosition: { top: number; left: number }
  handleTagSelect: (tag: string) => void
  handleAddNewTag: () => void
  t: (key: string) => string
  searchInputRef: React.RefObject<HTMLInputElement>
  newTagInputRef: React.RefObject<HTMLInputElement>
  dropdownRef: React.RefObject<HTMLDivElement>
}) {
  const filteredTags = tags.filter((tag) =>
    tag.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleNewTagKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter') handleAddNewTag()
    if (e.key === 'Escape') {
      setShowNewTag(false)
      setNewTagName('')
    }
  }

  const handleSearchKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      const matchedTag = tags.find((tag) =>
        tag.toLowerCase() === searchQuery.toLowerCase()
      )
      if (matchedTag) {
        handleTagSelect(matchedTag)
        setSearchQuery('')
      } else {
        setNewTagName(searchQuery)
        setShowNewTag(true)
      }
    }
  }

  return (
    <div 
      ref={dropdownRef}
      className="fixed z-[100] w-60 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg"
      style={{ 
        top: dropdownPosition.top, 
        left: dropdownPosition.left,
        animation: 'slide-down 0.15s ease-out'
      }}
    >
      <div className="p-2 border-b border-slate-100 dark:border-slate-700">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder={t('tag.searchOrCreate')}
            className="w-full pl-8 pr-2 py-1.5 text-xs border border-slate-200 dark:border-slate-700 rounded outline-none focus:border-slate-400 bg-white dark:bg-slate-800 dark:text-slate-100"
          />
        </div>
      </div>

      <div className="max-h-48 overflow-y-auto">
        {filteredTags.length > 0 ? (
          filteredTags.map((tag) => (
            <button
              key={tag}
              onClick={() => handleTagSelect(tag)}
              className={`w-full px-3 py-2 text-left text-xs hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex items-center gap-2 ${
                selectedTags.includes(tag) ? 'bg-slate-100 dark:bg-slate-700' : ''
              }`}
            >
              <TagBadge tag={tag} />
              {selectedTags.includes(tag) && (
                <Check className="w-3.5 h-3.5 text-green-500 ml-auto" />
              )}
            </button>
          ))
        ) : (
          <div className="px-3 py-2 text-xs text-slate-400">
            {t('tag.noMatch')}
          </div>
        )}
      </div>

      {showNewTag ? (
        <div className="p-2 border-t border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-1">
            <input
              ref={newTagInputRef}
              type="text"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              onKeyDown={handleNewTagKeyDown}
              placeholder={t('tag.placeholder')}
              className="flex-1 px-2 py-1.5 text-xs border border-slate-200 dark:border-slate-700 rounded outline-none focus:border-slate-400 bg-white dark:bg-slate-800 dark:text-slate-100"
            />
            <button
              onClick={handleAddNewTag}
              disabled={!newTagName.trim()}
              className="p-1.5 text-green-500 hover:text-green-600 disabled:opacity-40"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => {
                setShowNewTag(false)
                setNewTagName('')
              }}
              className="p-1.5 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ) : (
        <div className="p-2 border-t border-slate-100 dark:border-slate-700">
          <button
            onClick={() => {
              setNewTagName(searchQuery)
              setShowNewTag(true)
            }}
            className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            {t('tag.add')} "{searchQuery || '...'}"
          </button>
        </div>
      )}
    </div>
  )
}

export function TagSelector({ selectedTags, onTagsChange, className = '', onDropdownChange }: TagSelectorProps): JSX.Element {
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    onDropdownChange?.(isOpen)
  }, [isOpen, onDropdownChange])
  const [tags, setTags] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [showNewTag, setShowNewTag] = useState(false)
  const [newTagName, setNewTagName] = useState('')
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 })
  const triggerRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const newTagInputRef = useRef<HTMLInputElement>(null)
  const { t } = useI18n()

  const loadTags = useCallback(async (): Promise<void> => {
    try {
      const allTags = await window.api.tag.all()
      setTags(allTags)
    } catch {
      // tags are non-critical
    }
  }, [])

  useEffect(() => {
    loadTags()
  }, [loadTags])

  // 移除频繁调用 focus 的 useEffect，改用 useRef 和事件处理
  const didInitialFocusRef = useRef(false)
  
  useEffect(() => {
    if (isOpen && searchInputRef.current && !didInitialFocusRef.current) {
      searchInputRef.current.focus()
      didInitialFocusRef.current = true
    }
    return () => {
      if (!isOpen) {
        didInitialFocusRef.current = false
      }
    }
  }, [isOpen])

  const didNewTagFocusRef = useRef(false)
  useEffect(() => {
    if (showNewTag && newTagInputRef.current && !didNewTagFocusRef.current) {
      newTagInputRef.current.focus()
      didNewTagFocusRef.current = true
    }
    return () => {
      if (!showNewTag) {
        didNewTagFocusRef.current = false
      }
    }
  }, [showNewTag])

  useEffect(() => {
    if (isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      const dropdownHeight = 300
      const spaceBelow = window.innerHeight - rect.bottom
      const spaceAbove = rect.top
      
      let top = rect.bottom + 4
      
      if (spaceBelow < dropdownHeight && spaceAbove > spaceBelow) {
        top = rect.top - dropdownHeight
      }
      
      const left = Math.min(rect.left, window.innerWidth - 240)
      
      setDropdownPosition({
        top: Math.max(0, top),
        left: Math.max(0, left)
      })
    }
  }, [isOpen])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent): void => {
      const isTriggerClick = triggerRef.current?.contains(e.target as Node)
      const isDropdownClick = dropdownRef.current?.contains(e.target as Node)
      
      if (!isTriggerClick && !isDropdownClick) {
        setIsOpen(false)
        setShowNewTag(false)
        setSearchQuery('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleTagSelect = useCallback((tag: string): void => {
    const next = selectedTags.includes(tag)
      ? selectedTags.filter((t) => t !== tag)
      : [...selectedTags, tag]
    onTagsChange(next)
  }, [selectedTags, onTagsChange])

  const handleRemoveTag = (tag: string): void => {
    onTagsChange(selectedTags.filter((t) => t !== tag))
  }

  const handleAddNewTag = useCallback(async (): Promise<void> => {
    const name = newTagName.trim()
    if (!name) return

    if (tags.includes(name)) {
      if (!selectedTags.includes(name)) {
        onTagsChange([...selectedTags, name])
      }
      setNewTagName('')
      setShowNewTag(false)
      return
    }

    // 先创建标签，再设置颜色
    await window.api.tag.create(name)
    await window.api.tag.setColor(name, '#3b82f6')
    setTags((prev) => Array.from(new Set([...prev, name])).sort())
    onTagsChange([...selectedTags, name])
    setNewTagName('')
    setShowNewTag(false)
  }, [newTagName, tags, selectedTags, onTagsChange])

  // 使用 useMemo 避免不必要的重新渲染
  const memoizedDropdown = useMemo(() => {
    return (
      <TagDropdown
        tags={tags}
        selectedTags={selectedTags}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        showNewTag={showNewTag}
        setShowNewTag={setShowNewTag}
        newTagName={newTagName}
        setNewTagName={setNewTagName}
        dropdownPosition={dropdownPosition}
        handleTagSelect={handleTagSelect}
        handleAddNewTag={handleAddNewTag}
        t={t}
        searchInputRef={searchInputRef}
        newTagInputRef={newTagInputRef}
        dropdownRef={dropdownRef}
      />
    )
  }, [tags, selectedTags, searchQuery, showNewTag, newTagName, dropdownPosition, handleTagSelect, handleAddNewTag, t])

  return (
    <div className={`relative ${className}`} ref={triggerRef}>
      {selectedTags.length > 0 ? (
        <div className="flex items-center gap-1.5 flex-wrap">
          {selectedTags.map((tag) => (
            <TagBadge
              key={tag}
              tag={tag}
              selected
              removable
              onRemove={() => handleRemoveTag(tag)}
              onClick={() => setIsOpen(!isOpen)}
            />
          ))}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border border-dashed border-slate-300 dark:border-slate-600 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:border-blue-400 dark:hover:border-blue-500 transition-colors"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-dashed border-slate-300 dark:border-slate-600 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:border-blue-400 dark:hover:border-blue-500 transition-colors"
        >
          <Tag className="w-3.5 h-3.5" />
          {t('tag.select')}
          <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
        </button>
      )}

      {isOpen && createPortal(memoizedDropdown, document.body)}
    </div>
  )
}

// TagPortalDropdown 组件
function TagPortalDropdown({
  anchorRect,
  tags,
  selectedTags,
  searchQuery,
  setSearchQuery,
  showNewTag,
  setShowNewTag,
  newTagName,
  setNewTagName,
  handleTagSelect,
  handleAddNewTag,
  t,
  onClose,
  searchInputRef,
  newTagInputRef,
  dropdownRef,
}: {
  anchorRect: DOMRect
  tags: string[]
  selectedTags: string[]
  searchQuery: string
  setSearchQuery: (v: string) => void
  showNewTag: boolean
  setShowNewTag: (v: boolean) => void
  newTagName: string
  setNewTagName: (v: string) => void
  handleTagSelect: (tag: string) => void
  handleAddNewTag: () => void
  t: (key: string) => string
  onClose: () => void
  searchInputRef: React.RefObject<HTMLInputElement>
  newTagInputRef: React.RefObject<HTMLInputElement>
  dropdownRef: React.RefObject<HTMLDivElement>
}) {
  const filteredTags = tags.filter((tag) =>
    tag.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const top = Math.min(anchorRect.bottom + 4, window.innerHeight - 300)
  const left = Math.min(anchorRect.left, window.innerWidth - 240)

  return (
    <div
      ref={dropdownRef}
      className="fixed z-[100] w-60 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg animate-slide-down"
      style={{ top, left }}
    >
      <div className="p-2 border-b border-slate-100 dark:border-slate-700">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && searchQuery.trim()) {
                const matchedTag = tags.find((tag) => tag.toLowerCase() === searchQuery.toLowerCase())
                if (matchedTag) {
                  handleTagSelect(matchedTag)
                  setSearchQuery('')
                } else {
                  setNewTagName(searchQuery)
                  setShowNewTag(true)
                }
              }
              if (e.key === 'Escape') onClose()
            }}
            placeholder={t('tag.searchOrCreate')}
            className="w-full pl-8 pr-2 py-1.5 text-xs border border-slate-200 dark:border-slate-700 rounded outline-none focus:border-slate-400 bg-white dark:bg-slate-800 dark:text-slate-100"
          />
        </div>
      </div>
      <div className="max-h-48 overflow-y-auto">
        {filteredTags.length > 0 ? (
          filteredTags.map((tag) => (
            <button
              key={tag}
              onClick={() => handleTagSelect(tag)}
              className={`w-full px-3 py-2 text-left text-xs hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex items-center gap-2 ${
                selectedTags.includes(tag) ? 'bg-slate-100 dark:bg-slate-700' : ''
              }`}
            >
              <TagBadge tag={tag} />
              {selectedTags.includes(tag) && (
                <Check className="w-3.5 h-3.5 text-green-500 ml-auto" />
              )}
            </button>
          ))
        ) : (
          <div className="px-3 py-2 text-xs text-slate-400">{t('tag.noMatch')}</div>
        )}
      </div>
      {showNewTag ? (
        <div className="p-2 border-t border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-1">
            <input
              ref={newTagInputRef}
              type="text"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddNewTag()
                if (e.key === 'Escape') { setShowNewTag(false); setNewTagName('') }
              }}
              placeholder={t('tag.placeholder')}
              className="flex-1 px-2 py-1.5 text-xs border border-slate-200 dark:border-slate-700 rounded outline-none focus:border-slate-400 bg-white dark:bg-slate-800 dark:text-slate-100"
            />
            <button onClick={handleAddNewTag} disabled={!newTagName.trim()} className="p-1.5 text-green-500 hover:text-green-600 disabled:opacity-40">
              <Check className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => { setShowNewTag(false); setNewTagName('') }} className="p-1.5 text-slate-400 hover:text-slate-600">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ) : (
        <div className="p-2 border-t border-slate-100 dark:border-slate-700">
          <button
            onClick={() => { setNewTagName(searchQuery); setShowNewTag(true) }}
            className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            {t('tag.add')} "{searchQuery || '...'}"
          </button>
        </div>
      )}
    </div>
  )
}

export function TagSelectorPortal({
  anchorRect,
  selectedTags,
  onTagsChange,
  onClose
}: {
  anchorRect: DOMRect
  selectedTags: string[]
  onTagsChange: (tags: string[]) => void
  onClose: () => void
}): JSX.Element {
  const [tags, setTags] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [showNewTag, setShowNewTag] = useState(false)
  const [newTagName, setNewTagName] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const newTagInputRef = useRef<HTMLInputElement>(null)
  const { t } = useI18n()

  useEffect(() => {
    const loadTags = async (): Promise<void> => {
      try {
        const allTags = await window.api.tag.all()
        setTags(allTags)
      } catch {
        // non-critical
      }
    }
    loadTags()
  }, [])

  // 只在第一次打开时聚焦
  const didInitialFocusRef = useRef(false)
  useEffect(() => {
    if (searchInputRef.current && !didInitialFocusRef.current) {
      searchInputRef.current.focus()
      didInitialFocusRef.current = true
    }
  }, [])

  const didNewTagFocusRef = useRef(false)
  useEffect(() => {
    if (showNewTag && newTagInputRef.current && !didNewTagFocusRef.current) {
      newTagInputRef.current.focus()
      didNewTagFocusRef.current = true
    }
    return () => {
      if (!showNewTag) {
        didNewTagFocusRef.current = false
      }
    }
  }, [showNewTag])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent): void => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  const handleTagSelect = useCallback((tag: string): void => {
    const next = selectedTags.includes(tag)
      ? selectedTags.filter((t) => t !== tag)
      : [...selectedTags, tag]
    onTagsChange(next)
  }, [selectedTags, onTagsChange])

  const handleAddNewTag = useCallback(async (): Promise<void> => {
    const name = newTagName.trim()
    if (!name) return
    if (!tags.includes(name)) {
      // 先创建标签，再设置颜色
      await window.api.tag.create(name)
      await window.api.tag.setColor(name, '#3b82f6')
      setTags((prev) => Array.from(new Set([...prev, name])).sort())
    }
    if (!selectedTags.includes(name)) {
      onTagsChange([...selectedTags, name])
    }
    setNewTagName('')
    setShowNewTag(false)
  }, [newTagName, tags, selectedTags, onTagsChange])

  // 使用 useMemo 避免不必要的重新渲染
  const memoizedDropdown = useMemo(() => {
    return (
      <TagPortalDropdown
        anchorRect={anchorRect}
        tags={tags}
        selectedTags={selectedTags}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        showNewTag={showNewTag}
        setShowNewTag={setShowNewTag}
        newTagName={newTagName}
        setNewTagName={setNewTagName}
        handleTagSelect={handleTagSelect}
        handleAddNewTag={handleAddNewTag}
        t={t}
        onClose={onClose}
        searchInputRef={searchInputRef}
        newTagInputRef={newTagInputRef}
        dropdownRef={dropdownRef}
      />
    )
  }, [anchorRect, tags, selectedTags, searchQuery, showNewTag, newTagName, handleTagSelect, handleAddNewTag, t, onClose])

  return createPortal(memoizedDropdown, document.body)
}
