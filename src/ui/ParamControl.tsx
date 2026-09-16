import { useState } from 'react'
import type { ReactNode } from 'react'
import type { ParamDef, ParamValue } from '../core/params'
import { snapValue } from '../core/params'
import { LockButton } from './LockButton'
import { DiceButton } from './DiceButton'

interface Props {
  def: ParamDef
  value: ParamValue
  locked: boolean
  onChange(v: ParamValue): void
  onToggleLock(): void
  onRandomize(): void
}

interface HeadProps {
  label: string
  locked: boolean
  onToggleLock(): void
  onRandomize(): void
  children?: ReactNode
}

/** 라벨 줄: [라벨] [spacer] [children] [주사위] [자물쇠] */
function ControlHead({ label, locked, onToggleLock, onRandomize, children }: HeadProps) {
  return (
    <div className="control-head">
      <span className="control-label">{label}</span>
      <span className="spacer" />
      {children}
      <DiceButton onClick={onRandomize} title={`Randomize ${label}`} />
      <LockButton locked={locked} onToggle={onToggleLock} label={label} />
    </div>
  )
}

interface NumberFieldProps {
  value: number
  label: string
  snap(v: number): number
  onCommit(v: number): void
}

/**
 * 타이핑하는 동안은 값을 확정하지 않고, blur나 Enter에서만 스냅해 확정한다.
 * 훅이 조건부로 호출되지 않도록 ParamControl 안이 아니라 별도 컴포넌트로 둔다.
 */
function NumberField({ value, label, snap, onCommit }: NumberFieldProps) {
  // 입력 중에만 draft를 들고 있고, 확정되면 null로 되돌려 바깥 값(슬라이더)을 그대로 따라간다
  const [draft, setDraft] = useState<string | null>(null)
  const text = draft ?? String(value)

  const commit = () => {
    // 편집하지 않은 채 blur/Enter만 한 경우에는 값을 다시 확정하지 않는다(의도치 않은 자동 잠금 방지)
    if (draft === null) return
    setDraft(null)
    const n = Number(text)
    if (text.trim() === '' || !Number.isFinite(n)) return
    onCommit(snap(n))
  }

  const invalid = text.trim() !== '' && !Number.isFinite(Number(text))

  return (
    <input
      className={invalid ? 'num invalid' : 'num'}
      type="text"
      inputMode="decimal"
      aria-label={label}
      value={text}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit()
      }}
    />
  )
}

export function ParamControl({ def, value, locked, onChange, onToggleLock, onRandomize }: Props) {
  const cls = `control${locked ? ' locked' : ''}`
  const head = { label: def.label, locked, onToggleLock, onRandomize }
  if (def.type === 'range') {
    const v = typeof value === 'number' ? value : def.default
    return (
      <div className={cls}>
        <ControlHead {...head} />
        <input
          type="range"
          min={def.min}
          max={def.max}
          step={def.step}
          value={v}
          aria-label={def.label}
          onChange={(e) => onChange(snapValue(def, Number(e.target.value)))}
        />
        <NumberField value={v} label={def.label} snap={(n) => snapValue(def, n)} onCommit={onChange} />
      </div>
    )
  }
  if (def.type === 'select') {
    const v = typeof value === 'string' ? value : def.default
    return (
      <div className={cls}>
        <ControlHead {...head} />
        {def.options.length <= 4 ? (
          <div className="segmented">
            {def.options.map((o) => (
              <button key={o.value} type="button" className={o.value === v ? 'on' : ''} onClick={() => onChange(o.value)}>
                {o.label}
              </button>
            ))}
          </div>
        ) : (
          <select value={v} aria-label={def.label} onChange={(e) => onChange(e.target.value)}>
            {def.options.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        )}
      </div>
    )
  }
  const v = typeof value === 'boolean' ? value : def.default
  return (
    <div className={`${cls} toggle`}>
      <ControlHead {...head}>
        <input type="checkbox" checked={v} aria-label={def.label} onChange={(e) => onChange(e.target.checked)} />
      </ControlHead>
    </div>
  )
}
