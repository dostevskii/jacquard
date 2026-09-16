import { useState } from 'react'
import type { Hsv } from '../core/color'
import { hsvToRgb, parseHex, rgbToHsv, toHex } from '../core/color'
import { MAX_COLORS, MIN_COLORS, PRESETS, ensurePaletteLength, randomPalette } from '../core/palettes'
import { ColorEditor } from './ColorEditor'

interface Props {
  palette: string[]
  minColors: number
  onChange(palette: string[]): void
}

const hsvOf = (hex: string): Hsv => rgbToHsv(parseHex(hex) ?? { r: 0, g: 0, b: 0 })

export function PalettePanel({ palette, minColors, onChange }: Props) {
  const [selected, setSelected] = useState(0)
  const sel = Math.min(selected, palette.length - 1)
  const current = palette[sel]
  // 편집기가 마지막으로 만든 hsv와 그때의 스와치 인덱스·hex를 함께 들고 있는다
  const [edited, setEdited] = useState<{ index: number; hex: string; hsv: Hsv }>(() => ({
    index: sel,
    hex: current,
    hsv: hsvOf(current),
  }))
  // 같은 스와치를 편집기가 만든 값이면 hex만으로는 복원되지 않는 색상(s나 v가 0)까지 유지하고,
  // 외부 변경(프리셋, 셔플, 스와치 이동, URL 복원)이나 다른 스와치면 hex에서 다시 계산한다
  const hsv = edited.index === sel && edited.hex === current ? edited.hsv : hsvOf(current)

  const minLen = Math.max(minColors, MIN_COLORS)

  const edit = (next: Hsv) => {
    const hex = toHex(hsvToRgb(next))
    setEdited({ index: sel, hex, hsv: next })
    const p = palette.slice()
    p[sel] = hex
    onChange(p)
  }
  const move = (dir: -1 | 1) => {
    const j = sel + dir
    if (j < 0 || j >= palette.length) return
    const p = palette.slice()
    const tmp = p[sel]
    p[sel] = p[j]
    p[j] = tmp
    onChange(p)
    setSelected(j)
    // 고른 색이 j로 따라가므로 편집 캐시의 인덱스도 옮겨 hex로 복원되지 않는 색상 정보를 지킨다
    setEdited((e) => ({ ...e, index: j }))
  }
  const add = () => {
    if (palette.length >= MAX_COLORS) return
    onChange([...palette, randomPalette(2)[1]])
    setSelected(palette.length)
  }
  const remove = () => {
    if (palette.length <= minLen) return
    onChange(palette.filter((_, i) => i !== sel))
    setSelected(Math.max(0, sel - 1))
  }
  const applyPreset = (name: string) => {
    const preset = PRESETS.find((p) => p.name === name)
    if (!preset) return
    // ensurePaletteLength는 길이가 충분하면 받은 배열을 그대로 돌려주므로 프리셋 배열 별칭을 막는다
    onChange(ensurePaletteLength(preset.colors.slice(), minColors))
    setSelected(0)
  }
  const shuffle = () => onChange(randomPalette(palette.length))

  return (
    <section className="panel-section">
      <h2>Palette</h2>
      <div className="swatches">
        {palette.map((c, i) => (
          <button
            key={i}
            type="button"
            className={`swatch${i === sel ? ' on' : ''}`}
            style={{ background: c }}
            title={c}
            onClick={() => setSelected(i)}
          >
            {i === 0 ? <span className="swatch-tag">BG</span> : null}
          </button>
        ))}
      </div>
      <div className="palette-tools">
        <button type="button" className="btn" onClick={() => move(-1)} disabled={sel === 0} title="Move left">◀</button>
        <button type="button" className="btn" onClick={() => move(1)} disabled={sel === palette.length - 1} title="Move right">▶</button>
        <button type="button" className="btn" onClick={add} disabled={palette.length >= MAX_COLORS} title="Add color">+</button>
        <button type="button" className="btn" onClick={remove} disabled={palette.length <= minLen} title="Remove color">−</button>
        <div className="spacer" />
        <select className="select" value="" onChange={(e) => applyPreset(e.target.value)} aria-label="Preset palette">
          <option value="" disabled>Preset…</option>
          {PRESETS.map((p) => (
            <option key={p.name} value={p.name}>{p.name}</option>
          ))}
        </select>
        <button type="button" className="btn" onClick={shuffle}>Shuffle</button>
      </div>
      <ColorEditor hsv={hsv} onChange={edit} />
    </section>
  )
}
