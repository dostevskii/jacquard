import type { EffectDef } from './types'
import { enabledParam } from './types'
import { num, str } from '../core/params'

/** Bayer 임계 행렬: M1 = [[0]], M2n = [[4M, 4M+2], [4M+3, 4M+1]] */
export function bayerMatrix(size: 2 | 4 | 8): number[][] {
  let m: number[][] = [[0]]
  while (m.length < size) {
    const n = m.length
    const next: number[][] = Array.from({ length: 2 * n }, () => Array<number>(2 * n).fill(0))
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const v = 4 * m[y][x]
      next[y][x] = v
      next[y][x + n] = v + 2
      next[y + n][x] = v + 3
      next[y + n][x + n] = v + 1
    }
    m = next
  }
  return m
}

export const dither: EffectDef = {
  id: 'dither',
  name: 'Dither',
  params: [
    enabledParam(),
    { type: 'range', key: 'levels', label: 'Levels', min: 2, max: 8, step: 1, default: 2 },
    {
      type: 'select', key: 'matrix', label: 'Matrix', default: '4',
      options: [{ value: '2', label: '2 × 2' }, { value: '4', label: '4 × 4' }, { value: '8', label: '8 × 8' }],
    },
  ],
  apply(img, params, ctx) {
    const L = num(params, 'levels')
    const size = Number(str(params, 'matrix')) as 2 | 4 | 8
    const m = bayerMatrix(size)
    const cells = size * size
    // 행렬 한 칸 = 타일 1 unit. pixelate·grain과 같은 방식으로 px로 환산한다
    const cell = Math.max(1, Math.round(ctx.pxPerUnit))
    const { width: w, height: h, data } = img
    for (let y = 0; y < h; y++) {
      const row = m[Math.floor(y / cell) % size]
      for (let x = 0; x < w; x++) {
        const t = (row[Math.floor(x / cell) % size] + 0.5) / cells - 0.5
        const i = (y * w + x) * 4
        for (let c = 0; c < 3; c++) {
          const q = (data[i + c] / 255) * (L - 1)
          const k = Math.min(L - 1, Math.max(0, Math.round(q + t)))
          data[i + c] = Math.round((k / (L - 1)) * 255)
        }
      }
    }
  },
}
