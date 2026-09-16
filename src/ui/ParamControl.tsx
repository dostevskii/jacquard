import { useState } from 'react'
import type { ParamDef, ParamValue } from '../core/params'
import { snapValue } from '../core/params'

interface Props {
  def: ParamDef
  value: ParamValue
  onChange(v: ParamValue): void
}

interface NumberFieldProps {
  value: number
  snap(v: number): number
  onCommit(v: number): void
}

/**
 * 타이핑하는 동안은 값을 확정하지 않고, blur나 Enter에서만 스냅해 확정한다.
 * 훅이 조건부로 호출되지 않도록 ParamControl 안이 아니라 별도 컴포넌트로 둔다.
 */
function NumberField({ value, snap, onCommit }: NumberFieldProps) {
  // 입력 중에만 draft를 들고 있고, 확정되면 null로 되돌려 바깥 값(슬라이더)을 그대로 따라간다
  const [draft, setDraft] = useState<string | null>(null)
  const text = draft ?? String(value)

  const commit = () => {
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
      value={text}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit()
      }}
    />
  )
}

export function ParamControl({ def, value, onChange }: Props) {
  if (def.type === 'range') {
    const v = typeof value === 'number' ? value : def.default
    return (
      <label className="control">
        <span className="control-label">{def.label}</span>
        <input
          type="range"
          min={def.min}
          max={def.max}
          step={def.step}
          value={v}
          onChange={(e) => onChange(snapValue(def, Number(e.target.value)))}
        />
        <NumberField value={v} snap={(n) => snapValue(def, n)} onCommit={onChange} />
      </label>
    )
  }
  if (def.type === 'select') {
    const v = typeof value === 'string' ? value : def.default
    if (def.options.length <= 4) {
      return (
        <div className="control">
          <span className="control-label">{def.label}</span>
          <div className="segmented">
            {def.options.map((o) => (
              <button key={o.value} type="button" className={o.value === v ? 'on' : ''} onClick={() => onChange(o.value)}>
                {o.label}
              </button>
            ))}
          </div>
        </div>
      )
    }
    return (
      <label className="control">
        <span className="control-label">{def.label}</span>
        <select value={v} onChange={(e) => onChange(e.target.value)}>
          {def.options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </label>
    )
  }
  const v = typeof value === 'boolean' ? value : def.default
  return (
    <label className="control toggle">
      <span className="control-label">{def.label}</span>
      <input type="checkbox" checked={v} onChange={(e) => onChange(e.target.checked)} />
    </label>
  )
}
