import type { ParamDef, ParamValue } from '../core/params'

interface Props {
  def: ParamDef
  value: ParamValue
  onChange(v: ParamValue): void
}

export function ParamControl({ def, value, onChange }: Props) {
  if (def.type === 'range') {
    const v = typeof value === 'number' ? value : def.default
    const commit = (raw: string) => {
      const n = Number(raw)
      if (Number.isFinite(n)) onChange(Math.min(def.max, Math.max(def.min, n)))
    }
    return (
      <label className="control">
        <span className="control-label">{def.label}</span>
        <input type="range" min={def.min} max={def.max} step={def.step} value={v} onChange={(e) => commit(e.target.value)} />
        <input className="num" type="number" min={def.min} max={def.max} step={def.step} value={v} onChange={(e) => commit(e.target.value)} />
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
