
export interface TagColorScheme {
  bg: string
  text: string
}

export function getTagColors(tag: string): TagColorScheme {
  let hash = 0
  for (let i = 0; i < tag.length; i++) {
    const char = tag.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }

  const colors: TagColorScheme[] = [
    { bg: '#DBEAFE', text: '#1D4ED8' },
    { bg: '#DCFCE7', text: '#16A34A' },
    { bg: '#FEE2E2', text: '#DC2626' },
    { bg: '#FEF3C7', text: '#D97706' },
    { bg: '#F3E8FF', text: '#9333EA' },
    { bg: '#E0F2FE', text: '#0284C7' },
    { bg: '#FECACA', text: '#EA580C' },
    { bg: '#ECFCCB', text: '#65A30D' },
    { bg: '#CFFAFE', text: '#0891B2' },
    { bg: '#FDF4FF', text: '#C026D3' },
  ]

  const index = Math.abs(hash) % colors.length
  return colors[index]
}

export function getTagColorString(tag: string): string {
  const colors = getTagColors(tag)
  return colors.text
}

