import type { GeneratorDef } from './types'
import type { Shape } from '../core/scene'
import { tileWrap } from '../core/scene'
import { num, str, bool } from '../core/params'
import type { Rng } from '../core/prng'
import { fg, rect } from './util'

/** size × size 대칭 모티프. 사분면(oct는 팔분면)만 rng로 채우고 나머지는 거울 복사 */
function buildMotif(size: number, density: number, symmetry: string, smooth: number, rng: Rng): boolean[][] {
  const grid: boolean[][] = Array.from({ length: size }, () => Array<boolean>(size).fill(false))
  const half = (size + 1) / 2 // 중심 행·열 포함
  for (let y = 0; y < half; y++) {
    for (let x = 0; x < half; x++) {
      if (symmetry === 'oct' && x > y) continue
      grid[y][x] = rng.next() < density
    }
  }
  if (symmetry === 'oct') {
    for (let y = 0; y < half; y++) for (let x = y + 1; x < half; x++) grid[y][x] = grid[x][y]
  }
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const sx = x < half ? x : size - 1 - x
      const sy = y < half ? y : size - 1 - y
      grid[y][x] = grid[sy][sx]
    }
  }
  for (let pass = 0; pass < smooth; pass++) {
    const next = grid.map((row) => row.slice())
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (grid[y][x]) continue
        let n = 0
        if (y > 0 && grid[y - 1][x]) n++
        if (y < size - 1 && grid[y + 1][x]) n++
        if (x > 0 && grid[y][x - 1]) n++
        if (x < size - 1 && grid[y][x + 1]) n++
        if (n >= 3) next[y][x] = true
      }
    }
    for (let y = 0; y < size; y++) grid[y] = next[y]
  }
  return grid
}

export const motif: GeneratorDef = {
  id: 'motif',
  name: 'Motif',
  family: 'grid',
  minColors: 3,
  params: [
    { type: 'range', key: 'cell', label: 'Cell size', min: 4, max: 32, step: 1, default: 10 },
    { type: 'range', key: 'size', label: 'Motif size', min: 7, max: 31, step: 2, default: 15 },
    { type: 'range', key: 'density', label: 'Density', min: 0.1, max: 0.6, step: 0.05, default: 0.25 },
    {
      type: 'select', key: 'symmetry', label: 'Symmetry', default: 'quad',
      options: [
        { value: 'quad', label: '4-way' },
        { value: 'oct', label: '8-way' },
      ],
    },
    { type: 'range', key: 'smooth', label: 'Smoothing', min: 0, max: 2, step: 1, default: 1 },
    { type: 'range', key: 'spacing', label: 'Spacing', min: 0, max: 6, step: 1, default: 2 },
    { type: 'range', key: 'bandRows', label: 'Band rows', min: 0, max: 4, step: 1, default: 2 },
    { type: 'toggle', key: 'stagger', label: 'Stagger rows', default: false },
  ],
  generate({ params, palette, rng }) {
    const cell = num(params, 'cell')
    const size = num(params, 'size')
    const density = num(params, 'density')
    const symmetry = str(params, 'symmetry')
    const smooth = num(params, 'smooth')
    const spacing = num(params, 'spacing')
    const bandRows = num(params, 'bandRows')
    const stagger = bool(params, 'stagger')

    const grid = buildMotif(size, density, symmetry, smooth, rng)
    // 띠 체커가 (i + j) % 2이므로 타일 폭 셀 수를 짝수로 맞춰야 세로 이음새에서 같은 색이 붙지 않는다
    const across = size + spacing + ((size + spacing) % 2)
    const unitW = across * cell
    const rowH = (across + bandRows) * cell
    const rowsInTile = stagger ? 2 : 1
    const width = unitW
    const height = rowH * rowsInTile
    const motifColor = palette[1]
    const bandA = fg(palette, 1)
    const bandB = fg(palette, 2)

    const shapes: Shape[] = []
    for (let r = 0; r < rowsInTile; r++) {
      const oy = r * rowH
      const ox = stagger && r === 1 ? Math.floor(across / 2) * cell : 0
      // 남는 여백을 셀 단위로 나눠 모티프를 가운데 둔다(홀수 여백이어도 격자에서 벗어나지 않는다)
      const mx = ox + Math.floor((across - size) / 2) * cell
      const my = oy + Math.floor((across - size) / 2) * cell
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          if (grid[y][x]) shapes.push(rect(mx + x * cell, my + y * cell, cell, cell, motifColor))
        }
      }
      if (bandRows > 0) {
        const by = oy + across * cell
        for (let j = 0; j < bandRows; j++) {
          for (let i = 0; i < across; i++) {
            shapes.push(rect(i * cell, by + j * cell, cell, cell, (i + j) % 2 === 0 ? bandA : bandB))
          }
        }
      }
    }
    // stagger가 켜지면 둘째 행 모티프가 오른쪽 경계를 넘으므로 감는다
    return { width, height, background: palette[0], shapes: tileWrap(shapes, width, height) }
  },
}
