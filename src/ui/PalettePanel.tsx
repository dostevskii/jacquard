import { useState } from 'react'
import type { Hsv } from '../core/color'
import { hsvToRgb, parseHex, rgbToHsv, toHex } from '../core/color'
import { MAX_COLORS, MIN_COLORS, PRESETS, ensurePaletteLength } from '../core/palettes'
import type { LockState } from '../core/locks'
import { lockAllSwatches, lockSwatch, swatchLocksAfterRemove, swatchLocksAfterSwap, toggleSwatchLock } from '../core/locks'
import { randomSwatch, randomizePalette } from '../core/random'
import { mulberry32, randomSeed } from '../core/prng'
import { ColorEditor } from './ColorEditor'
import { LockIcon } from './LockButton'
import { DiceButton } from './DiceButton'

interface Props {
  palette: string[]
  locks: LockState
  minColors: number
  onChange(palette: string[], locks: LockState): void
}

const hsvOf = (hex: string): Hsv => rgbToHsv(parseHex(hex) ?? { r: 0, g: 0, b: 0 })

export function PalettePanel({ palette, locks, minColors, onChange }: Props) {
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

  const fresh = () => mulberry32(randomSeed())

  // 색 편집기로 바꾼 색은 사용자가 고른 것이므로 그 스와치를 잠근다
  const edit = (next: Hsv) => {
    const hex = toHex(hsvToRgb(next))
    setEdited({ index: sel, hex, hsv: next })
    const p = palette.slice()
    p[sel] = hex
    onChange(p, lockSwatch(locks, sel))
  }
  const move = (dir: -1 | 1) => {
    const j = sel + dir
    if (j < 0 || j >= palette.length) return
    const p = palette.slice()
    const tmp = p[sel]
    p[sel] = p[j]
    p[j] = tmp
    onChange(p, swatchLocksAfterSwap(locks, sel, j))
    setSelected(j)
    // 고른 색이 j로 따라가므로 편집 캐시의 인덱스도 옮겨 hex로 복원되지 않는 색상 정보를 지킨다
    setEdited((e) => ({ ...e, index: j }))
  }
  const add = () => {
    if (palette.length >= MAX_COLORS) return
    onChange([...palette, randomSwatch(palette.length, fresh())], locks)
    setSelected(palette.length)
  }
  const remove = () => {
    if (palette.length <= minLen) return
    onChange(palette.filter((_, i) => i !== sel), swatchLocksAfterRemove(locks, sel))
    setSelected(Math.max(0, sel - 1))
  }
  // 프리셋 선택은 색을 고른 명시적 행위이므로 팔레트 전체를 잠근다
  const applyPreset = (name: string) => {
    const preset = PRESETS.find((p) => p.name === name)
    if (!preset) return
    // ensurePaletteLength는 길이가 충분하면 받은 배열을 그대로 돌려주므로 프리셋 배열 별칭을 막는다
    const next = ensurePaletteLength(preset.colors.slice(), minColors)
    onChange(next, lockAllSwatches(locks, next.length))
    setSelected(0)
  }
  // 개별·전체 랜덤은 잠금을 바꾸지 않는다
  const randomizeSelected = () => {
    const p = palette.slice()
    p[sel] = randomSwatch(sel, fresh())
    onChange(p, locks)
  }
  const randomizeColors = () => onChange(randomizePalette(palette, locks.palette, fresh()), locks)
  const toggleLock = (i: number) => onChange(palette, toggleSwatchLock(locks, i))

  return (
    <section className="panel-section">
      <h2>Palette</h2>
      <div className="swatches">
        {palette.map((c, i) => {
          const locked = locks.palette.includes(i)
          return (
            <div key={i} className={`swatch${i === sel ? ' on' : ''}${locked ? ' locked' : ''}`} style={{ background: c }} title={c}>
              <button type="button" className="swatch-pick" aria-label={`Select color ${i + 1}`} onClick={() => setSelected(i)} />
              {i === 0 ? <span className="swatch-tag">BG</span> : null}
              <button
                type="button"
                className={`swatch-lock${locked ? ' on' : ''}`}
                title={locked ? 'Locked — Randomize keeps this color. Click to unlock.' : 'Unlocked — Randomize may change this color. Click to lock.'}
                aria-pressed={locked}
                aria-label={`${locked ? 'Unlock' : 'Lock'} color ${i + 1}`}
                onClick={() => toggleLock(i)}
              >
                <LockIcon locked={locked} size={9} />
              </button>
            </div>
          )
        })}
      </div>
      <div className="palette-tools">
        <button type="button" className="btn" onClick={() => move(-1)} disabled={sel === 0} title="Move left">◀</button>
        <button type="button" className="btn" onClick={() => move(1)} disabled={sel === palette.length - 1} title="Move right">▶</button>
        <button type="button" className="btn" onClick={add} disabled={palette.length >= MAX_COLORS} title="Add color">+</button>
        <button type="button" className="btn" onClick={remove} disabled={palette.length <= minLen} title="Remove color">−</button>
        <DiceButton onClick={randomizeSelected} title="Randomize the selected color" />
      </div>
      <div className="palette-tools">
        <select className="select" value="" onChange={(e) => applyPreset(e.target.value)} aria-label="Preset palette">
          <option value="" disabled>Preset…</option>
          {PRESETS.map((p) => (
            <option key={p.name} value={p.name}>{p.name}</option>
          ))}
        </select>
        <button type="button" className="btn" onClick={randomizeColors} title="Randomize every color that is not locked">Randomize colors</button>
      </div>
      <ColorEditor hsv={hsv} onChange={edit} />
    </section>
  )
}
