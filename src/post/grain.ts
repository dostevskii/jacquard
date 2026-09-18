import type { EffectDef } from './types'
import { enabledParam } from './types'
import { bool, num } from '../core/params'

/** 정수 해시 → [-1, 1]. 같은 (cx, cy, seed)면 항상 같은 값 */
export function grainNoise(cx: number, cy: number, seed: number): number {
  let h = (Math.imul(cx, 0x9e3779b1) ^ Math.imul(cy, 0x85ebca77) ^ Math.imul(seed, 0xc2b2ae3d)) >>> 0
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d)
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39)
  h ^= h >>> 15
  return ((h >>> 0) / 4294967296) * 2 - 1
}

export const grain: EffectDef = {
  id: 'grain',
  name: 'Grain',
  params: [
    enabledParam(),
    { type: 'range', key: 'amount', label: 'Amount', min: 0, max: 100, step: 1, default: 30 },
    { type: 'range', key: 'size', label: 'Grain size', min: 1, max: 8, step: 1, default: 1 },
    { type: 'toggle', key: 'color', label: 'Color grain', default: false },
  ],
  apply(img, params, ctx) {
    const maxDelta = num(params, 'amount') * 1.28
    if (maxDelta <= 0) return
    const s = Math.max(1, Math.round(num(params, 'size') * ctx.pxPerUnit))
    const color = bool(params, 'color')
    const { width: w, height: h, data } = img
    for (let y = 0; y < h; y++) {
      const cy = Math.floor(y / s)
      for (let x = 0; x < w; x++) {
        const cx = Math.floor(x / s)
        const i = (y * w + x) * 4
        if (color) {
          for (let c = 0; c < 3; c++) data[i + c] = data[i + c] + grainNoise(cx, cy, ctx.seed + 1 + c) * maxDelta
        } else {
          const d = grainNoise(cx, cy, ctx.seed) * maxDelta
          data[i] = data[i] + d
          data[i + 1] = data[i + 1] + d
          data[i + 2] = data[i + 2] + d
        }
      }
    }
  },
}
