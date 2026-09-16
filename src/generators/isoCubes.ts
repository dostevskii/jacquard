import type { GeneratorDef } from './types'
import type { Shape } from '../core/scene'
import { tileWrap } from '../core/scene'
import { num, bool } from '../core/params'
import { fg, poly } from './util'

const SQ3 = Math.sqrt(3)

/** 다각형을 무게중심 기준으로 k배 축소한다 (gap 표현) */
function shrink(points: number[], k: number): number[] {
  if (k >= 1) return points
  const n = points.length / 2
  let cx = 0
  let cy = 0
  for (let i = 0; i < n; i++) {
    cx += points[2 * i]
    cy += points[2 * i + 1]
  }
  cx /= n
  cy /= n
  return points.map((v, i) => (i % 2 === 0 ? cx + (v - cx) * k : cy + (v - cy) * k))
}

export const isoCubes: GeneratorDef = {
  id: 'isoCubes',
  name: 'Iso Cubes',
  family: 'tessellation',
  minColors: 4,
  params: [
    { type: 'range', key: 'size', label: 'Cube size', min: 10, max: 120, step: 1, default: 40 },
    { type: 'range', key: 'cols', label: 'Columns per tile', min: 1, max: 8, step: 1, default: 2 },
    { type: 'range', key: 'rows', label: 'Row pairs per tile', min: 1, max: 8, step: 1, default: 2 },
    { type: 'range', key: 'gap', label: 'Gap', min: 0, max: 8, step: 1, default: 0 },
    { type: 'toggle', key: 'shuffle', label: 'Shuffle face colors', default: false },
  ],
  generate({ params, palette, rng }) {
    const s = num(params, 'size')
    const cols = num(params, 'cols')
    const rows = num(params, 'rows')
    const gap = num(params, 'gap')
    const shuffle = bool(params, 'shuffle')

    const width = cols * SQ3 * s
    const height = rows * 3 * s
    const base = [fg(palette, 0), fg(palette, 1), fg(palette, 2)]
    const k = Math.max(0.2, 1 - gap / s)
    const hw = (SQ3 / 2) * s // 육각형 반폭

    const shapes: Shape[] = []
    for (let r = 0; r < rows * 2; r++) {
      const cy = r * 1.5 * s
      const xOff = r % 2 === 1 ? hw : 0
      for (let c = 0; c < cols; c++) {
        const cx = c * SQ3 * s + xOff
        const colors = shuffle ? rng.shuffle(base) : base
        // 육각형 정점: T(위) UR LR B(아래) LL UL, 중심 C
        const T = [cx, cy - s]
        const UR = [cx + hw, cy - s / 2]
        const LR = [cx + hw, cy + s / 2]
        const B = [cx, cy + s]
        const LL = [cx - hw, cy + s / 2]
        const UL = [cx - hw, cy - s / 2]
        const C = [cx, cy]
        shapes.push(poly(shrink([...T, ...UR, ...C, ...UL], k), colors[0]))   // 윗면
        shapes.push(poly(shrink([...UL, ...C, ...B, ...LL], k), colors[1]))   // 왼면
        shapes.push(poly(shrink([...C, ...UR, ...LR, ...B], k), colors[2]))   // 오른면
      }
    }
    // 큐브는 타일 가장자리를 넘어가므로 반대편으로 감아 이음매를 없앤다
    return { width, height, background: palette[0], shapes: tileWrap(shapes, width, height) }
  },
}
