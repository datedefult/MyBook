import { X } from 'lucide-react'
import { getTagColors } from '../utils/tagColorUtils'

interface TagBadgeProps {
  tag: string
  color?: string
  selected?: boolean
  removable?: boolean
  onClick?: () => void
  onRemove?: () => void
  className?: string
}

export function TagBadge({
  tag,
  selected = false,
  removable = false,
  onClick,
  onRemove,
  className = ''
}: TagBadgeProps): JSX.Element {
  const colors = getTagColors(tag)

  return (
    <span
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick() } : undefined}
      style={{
        backgroundColor: colors.bg,
        color: colors.text
      }}
      className={`inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-md font-medium whitespace-nowrap transition-all duration-150 ${
        onClick ? 'cursor-pointer hover:opacity-80 hover:shadow-sm' : ''
      } ${selected ? 'ring-1 ring-current opacity-90' : ''} ${className}`}
    >
      {tag.length > 7 ? tag.slice(0, 7) + '...' : tag}
      {removable && onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          className="ml-0.5 hover:opacity-60 transition-opacity rounded hover:bg-black/10"
          aria-label={`Remove ${tag}`}
        >
          <X className="w-2.5 h-2.5" />
        </button>
      )}
    </span>
  )
}
