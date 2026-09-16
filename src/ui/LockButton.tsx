interface IconProps {
  locked: boolean
  size?: number
}

export function LockIcon({ locked, size = 14 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <rect x="3" y="7" width="10" height="7" rx="1.5" fill="currentColor" />
      {locked ? (
        <path d="M5 7V5a3 3 0 0 1 6 0v2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      ) : (
        <path d="M5 7V5a3 3 0 0 1 6 0" fill="none" stroke="currentColor" strokeWidth="1.6" />
      )}
    </svg>
  )
}

interface Props {
  locked: boolean
  onToggle(): void
  label?: string
  className?: string
}

export function LockButton({ locked, onToggle, label = 'this value', className = '' }: Props) {
  const title = locked
    ? `Locked — Randomize leaves ${label} alone. Click to unlock.`
    : `Unlocked — Randomize may change ${label}. Click to lock.`
  return (
    <button
      type="button"
      className={`icon-btn lock${locked ? ' on' : ''}${className ? ` ${className}` : ''}`}
      title={title}
      aria-label={title}
      aria-pressed={locked}
      onClick={onToggle}
    >
      <LockIcon locked={locked} />
    </button>
  )
}
