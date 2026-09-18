import type { EffectDef } from './types'
import { enabledParam } from './types'
import { num } from '../core/params'

export const pixelate: EffectDef = {
  id: 'pixelate',
  name: 'Pixelate',
  params: [enabledParam(), { type: 'range', key: 'block', label: 'Block size', min: 2, max: 64, step: 1, default: 8 }],
  apply(img, params, ctx) {
    const b = Math.max(1, Math.round(num(params, 'block') * ctx.pxPerUnit))
    const { width: w, height: h, data } = img
    for (let by = 0; by < h; by += b) {
      const y1 = Math.min(h, by + b)
      for (let bx = 0; bx < w; bx += b) {
        const x1 = Math.min(w, bx + b)
        let r = 0, g = 0, bl = 0, n = 0
        for (let y = by; y < y1; y++) for (let x = bx; x < x1; x++) {
          const i = (y * w + x) * 4
          r += data[i]; g += data[i + 1]; bl += data[i + 2]; n++
        }
        const R = r / n, G = g / n, B = bl / n
        for (let y = by; y < y1; y++) for (let x = bx; x < x1; x++) {
          const i = (y * w + x) * 4
          data[i] = R; data[i + 1] = G; data[i + 2] = B
        }
      }
    }
  },
}
