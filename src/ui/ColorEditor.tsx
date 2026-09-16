import type { Hsv } from '../core/color'
import { ColorWheel } from './ColorWheel'
import { ColorInputs } from './ColorInputs'

interface Props {
  hsv: Hsv
  onChange(hsv: Hsv): void
}

export function ColorEditor({ hsv, onChange }: Props) {
  return (
    <div className="color-editor">
      <ColorWheel hsv={hsv} onChange={onChange} />
      <label className="field brightness">
        <span>Brightness</span>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={Math.round(hsv.v)}
          onChange={(e) => onChange({ ...hsv, v: Number(e.target.value) })}
        />
      </label>
      <ColorInputs hsv={hsv} onChange={onChange} />
    </div>
  )
}
