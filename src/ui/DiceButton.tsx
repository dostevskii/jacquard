interface IconProps {
  size?: number
}

export function DiceIcon({ size = 14 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <rect x="1.5" y="1.5" width="13" height="13" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="5" cy="5" r="1.3" fill="currentColor" />
      <circle cx="11" cy="5" r="1.3" fill="currentColor" />
      <circle cx="8" cy="8" r="1.3" fill="currentColor" />
      <circle cx="5" cy="11" r="1.3" fill="currentColor" />
      <circle cx="11" cy="11" r="1.3" fill="currentColor" />
    </svg>
  )
}

interface Props {
  onClick(): void
  title?: string
}

export function DiceButton({ onClick, title = 'Randomize this value' }: Props) {
  return (
    <button type="button" className="icon-btn dice" title={title} aria-label={title} onClick={onClick}>
      <DiceIcon />
    </button>
  )
}
