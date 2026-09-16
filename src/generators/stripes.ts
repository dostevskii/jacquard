import type { GeneratorDef } from './types'
import type { Shape } from '../core/scene'
import { tileWrap } from '../core/scene'
import { num, str } from '../core/params'
import { fg, pickFg, rect } from './util'

export const stripes: GeneratorDef = {
  id: 'stripes',
  name: 'Stripes',
  family: 'grid',
  minColors: 3,
  params: [
    { type: 'range', key: 'cell', label: 'Cell size', min: 4, max: 64, step: 2, default: 16 },
    { type: 'range', key: 'bandHeight', label: 'Band height', min: 1, max: 8, step: 1, default: 3 },
    { type: 'range', key: 'segmentLength', label: 'Segment length', min: 2, max: 16, step: 1, default: 6 },
    { type: 'range', key: 'columns', label: 'Segments per row', min: 1, max: 8, step: 1, default: 3 },
    { type: 'range', key: 'rows', label: 'Rows', min: 2, max: 12, step: 2, default: 6 },
    { type: 'range', key: 'offset', label: 'Row offset', min: 0, max: 1, step: 0.25, default: 0.5 },
    { type: 'range', key: 'separator', label: 'Separator', min: 0, max: 3, step: 1, default: 1 },
    {
      type: 'select', key: 'colorMode', label: 'Colors', default: 'sequence',
      options: [
        { value: 'sequence', label: 'Sequence' },
        { value: 'alternate', label: 'Alternate' },
        { value: 'random', label: 'Random' },
      ],
    },
  ],
  generate({ params, palette, rng }) {
    const cell = num(params, 'cell')
    const bandH = num(params, 'bandHeight') * cell
    const segL = num(params, 'segmentLength') * cell
    const cols = num(params, 'columns')
    const rows = num(params, 'rows')
    const offset = num(params, 'offset')
    const sep = num(params, 'separator') * cell
    const mode = str(params, 'colorMode')

    const width = cols * segL
    const height = rows * (bandH + sep)
    const shapes: Shape[] = []
    let k = 0
    for (let r = 0; r < rows; r++) {
      const y = r * (bandH + sep)
      const shift = r % 2 === 1 ? offset * segL : 0
      for (let c = 0; c < cols; c++) {
        let color: string
        if (mode === 'random') color = fg(palette, pickFg(palette, rng))
        else if (mode === 'alternate') color = fg(palette, (c % 2) + 2 * (r % 2))
        else color = fg(palette, k++)
        shapes.push(rect(c * segL + shift, y, segL, bandH, color))
      }
    }
    return { width, height, background: palette[0], shapes: tileWrap(shapes, width, height) }
  },
}
