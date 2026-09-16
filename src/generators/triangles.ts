import type { GeneratorDef } from './types'
import type { Paint, Shape } from '../core/scene'
import { tileWrap } from '../core/scene'
import type { Rng } from '../core/prng'
import { num, str } from '../core/params'
import { fg, pickFg, poly } from './util'

const SQ3 = Math.sqrt(3)

function colorFor(rule: string, palette: string[], rng: Rng, r: number, k: number, up: boolean): string {
  if (rule === 'checker') return fg(palette, up ? 0 : 1)
  if (rule === 'stripes') return fg(palette, r)
  if (rule === 'random') return fg(palette, pickFg(palette, rng))
  // rhombus: 같은 k의 ▲▼ 쌍이 같은 색, 행 쌍마다 한 칸씩 밀려 대각선 느낌
  return fg(palette, k + Math.floor(r / 2))
}

function transposePaint(p: Paint): Paint {
  if (p.type === 'solid') return p
  return { ...p, x1: p.y1, y1: p.x1, x2: p.y2, y2: p.x2 }
}

/** (x, y) → (y, x). 가로 타일을 세로 타일로 바꾼다 */
function transposeShape(s: Shape): Shape {
  if (s.kind === 'rect') return { ...s, x: s.y, y: s.x, w: s.h, h: s.w, fill: transposePaint(s.fill) }
  const pts = s.points.slice()
  for (let i = 0; i < pts.length; i += 2) {
    const t = pts[i]
    pts[i] = pts[i + 1]
    pts[i + 1] = t
  }
  return { ...s, points: pts, fill: transposePaint(s.fill) }
}

export const triangles: GeneratorDef = {
  id: 'triangles',
  name: 'Triangles',
  family: 'tessellation',
  minColors: 3,
  params: [
    { type: 'range', key: 'size', label: 'Triangle size', min: 10, max: 120, step: 1, default: 40 },
    { type: 'range', key: 'cols', label: 'Columns per tile', min: 2, max: 16, step: 1, default: 4 },
    { type: 'range', key: 'rows', label: 'Rows per tile', min: 2, max: 16, step: 2, default: 2 },
    {
      type: 'select', key: 'rule', label: 'Coloring', default: 'checker',
      options: [
        { value: 'checker', label: 'Checker' },
        { value: 'stripes', label: 'Stripes' },
        { value: 'random', label: 'Random' },
        { value: 'rhombus', label: 'Rhombus' },
      ],
    },
    {
      type: 'select', key: 'orientation', label: 'Orientation', default: 'horizontal',
      options: [
        { value: 'horizontal', label: 'Horizontal' },
        { value: 'vertical', label: 'Vertical' },
      ],
    },
  ],
  generate({ params, palette, rng }) {
    const s = num(params, 'size')
    const cols = num(params, 'cols')
    const rows = num(params, 'rows')
    const rule = str(params, 'rule')
    const orientation = str(params, 'orientation')

    const h = (SQ3 / 2) * s
    const shapes: Shape[] = []
    for (let r = 0; r < rows; r++) {
      const y0 = r * h
      const y1 = y0 + h
      const off = r % 2 === 1 ? s / 2 : 0
      for (let k = 0; k < cols; k++) {
        const x = k * s + off
        shapes.push(poly([x, y1, x + s, y1, x + s / 2, y0], colorFor(rule, palette, rng, r, k, true)))              // ▲
        shapes.push(poly([x + s / 2, y0, x + 1.5 * s, y0, x + s, y1], colorFor(rule, palette, rng, r, k, false)))  // ▼
      }
    }
    const width = cols * s
    const height = rows * h
    // 행마다 반 칸씩 밀리고 ▼가 오른쪽으로 삐져나가므로 반대편으로 감아 이음매를 없앤다
    const wrapped = tileWrap(shapes, width, height)
    if (orientation === 'vertical') {
      return { width: height, height: width, background: palette[0], shapes: wrapped.map(transposeShape) }
    }
    return { width, height, background: palette[0], shapes: wrapped }
  },
}
