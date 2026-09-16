import type { GeneratorDef } from './types'
import type { Shape } from '../core/scene'
import { num, str } from '../core/params'
import { fg, pickFg, rect } from './util'

interface Ring {
  from: number
  to: number
  color: string
}

export const rings: GeneratorDef = {
  id: 'rings',
  name: 'Rings',
  family: 'grid',
  minColors: 3,
  params: [
    { type: 'range', key: 'cell', label: 'Cell size', min: 4, max: 40, step: 1, default: 20 },
    { type: 'range', key: 'cols', label: 'Columns', min: 6, max: 40, step: 1, default: 16 },
    { type: 'range', key: 'rows', label: 'Rows', min: 6, max: 40, step: 1, default: 12 },
    { type: 'range', key: 'grout', label: 'Grout', min: 0, max: 4, step: 0.5, default: 2 },
    { type: 'range', key: 'maxRing', label: 'Max ring width', min: 1, max: 4, step: 1, default: 2 },
    {
      type: 'select', key: 'center', label: 'Center', default: 'checker',
      options: [
        { value: 'solid', label: 'Solid' },
        { value: 'checker', label: 'Checker' },
        { value: 'stripes', label: 'Stripes' },
      ],
    },
  ],
  generate({ params, palette, rng }) {
    const cell = num(params, 'cell')
    const cols = num(params, 'cols')
    const rows = num(params, 'rows')
    const grout = Math.min(num(params, 'grout'), cell - 1)
    const maxRing = num(params, 'maxRing')
    const center = str(params, 'center')

    // 바깥에서 안쪽으로 링 두께 시퀀스. 깊이 2 이상 들어간 뒤에는 35% 확률로 멈추고 나머지를 중심부로 남긴다
    const maxDepth = Math.floor(Math.min(cols, rows) / 2)
    const ringList: Ring[] = []
    let depth = 0
    let prev: number | undefined
    while (depth < maxDepth) {
      const t = rng.int(1, maxRing)
      const ci = pickFg(palette, rng, prev)
      prev = ci
      ringList.push({ from: depth, to: depth + t, color: fg(palette, ci) })
      depth += t
      if (depth >= 2 && rng.next() < 0.35) break
    }
    const last = prev ?? 0
    const c1 = fg(palette, last + 1)
    const c2 = fg(palette, last + 2)

    const shapes: Shape[] = []
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const d = Math.min(i, j, cols - 1 - i, rows - 1 - j)
        const ring = ringList.find((r) => d >= r.from && d < r.to)
        let color: string
        if (ring) color = ring.color
        else if (center === 'solid') color = c1
        else if (center === 'checker') color = (i + j) % 2 === 0 ? c1 : c2
        else color = j % 2 === 0 ? c1 : c2
        shapes.push(rect(i * cell + grout / 2, j * cell + grout / 2, cell - grout, cell - grout, color))
      }
    }
    // 타일 경계가 곧 바깥 링이므로 tileWrap 불필요
    return { width: cols * cell, height: rows * cell, background: palette[0], shapes }
  },
}
