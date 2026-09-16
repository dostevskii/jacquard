import { useState } from 'react'
import type { Hsl, Hsv, Rgb } from '../core/color'
import { hslToRgb, hsvToRgb, parseHex, rgbToHsl, rgbToHsv, toHex } from '../core/color'
import { keepHue } from './colorMath'

interface Props {
  hsv: Hsv
  onChange(hsv: Hsv): void
}

interface NumberFieldProps {
  label: string
  value: number
  min: number
  max: number
  onCommit(n: number): void
}

function NumberField({ label, value, min, max, onCommit }: NumberFieldProps) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        value={Math.round(value)}
        onChange={(e) => {
          // 필드를 비운 순간 Number('') === 0이 커밋되지 않게 한다
          if (e.target.value === '') return
          const n = Number(e.target.value)
          if (Number.isFinite(n) && n >= min && n <= max) onCommit(n)
        }}
      />
    </label>
  )
}

export function ColorInputs({ hsv, onChange }: Props) {
  const rgb = hsvToRgb(hsv)
  const hex = toHex(rgb)
  const hsl = rgbToHsl(rgb)
  // 입력 중에만 draft를 들고 있고, 확정되면 null로 되돌려 바깥 색(색상환·슬라이더)을 그대로 따라간다
  const [hexDraft, setHexDraft] = useState<string | null>(null)
  const hexText = hexDraft ?? hex
  const hexValid = hexDraft === null || parseHex(hexDraft) !== null

  const fromRgb = (patch: Partial<Rgb>) => onChange(keepHue(rgbToHsv({ ...rgb, ...patch }), hsv))
  const fromHsl = (patch: Partial<Hsl>) => onChange(keepHue(rgbToHsv(hslToRgb({ ...hsl, ...patch })), hsv))
  const commitHex = () => {
    const p = parseHex(hexText)
    setHexDraft(null)
    if (p) onChange(keepHue(rgbToHsv(p), hsv))
  }

  return (
    <div className="color-inputs">
      <label className={`field hex${hexValid ? '' : ' invalid'}`}>
        <span>HEX</span>
        <input
          type="text"
          value={hexText}
          spellCheck={false}
          onChange={(e) => setHexDraft(e.target.value)}
          onBlur={commitHex}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitHex()
          }}
        />
      </label>
      <div className="field-row">
        <span className="field-group">RGB</span>
        <NumberField label="R" value={rgb.r} min={0} max={255} onCommit={(n) => fromRgb({ r: n })} />
        <NumberField label="G" value={rgb.g} min={0} max={255} onCommit={(n) => fromRgb({ g: n })} />
        <NumberField label="B" value={rgb.b} min={0} max={255} onCommit={(n) => fromRgb({ b: n })} />
      </div>
      <div className="field-row">
        <span className="field-group">HSL</span>
        <NumberField label="H" value={hsl.h} min={0} max={360} onCommit={(n) => fromHsl({ h: n })} />
        <NumberField label="S" value={hsl.s} min={0} max={100} onCommit={(n) => fromHsl({ s: n })} />
        <NumberField label="L" value={hsl.l} min={0} max={100} onCommit={(n) => fromHsl({ l: n })} />
      </div>
      <div className="field-row">
        <span className="field-group">HSB</span>
        <NumberField label="H" value={hsv.h} min={0} max={360} onCommit={(n) => onChange({ ...hsv, h: n })} />
        <NumberField label="S" value={hsv.s} min={0} max={100} onCommit={(n) => onChange({ ...hsv, s: n })} />
        <NumberField label="B" value={hsv.v} min={0} max={100} onCommit={(n) => onChange({ ...hsv, v: n })} />
      </div>
    </div>
  )
}
