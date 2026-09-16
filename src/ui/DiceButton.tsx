interface IconProps {
  size?: number
}

export function DiceIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <rect x="1.5" y="1.5" width="13" height="13" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="4.5" cy="4.5" r="1.25" fill="currentColor" />
      <circle cx="11.5" cy="4.5" r="1.25" fill="currentColor" />
      <circle cx="8" cy="8" r="1.25" fill="currentColor" />
      <circle cx="4.5" cy="11.5" r="1.25" fill="currentColor" />
      <circle cx="11.5" cy="11.5" r="1.25" fill="currentColor" />
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
