import type { EffectDef } from './types'
import { enabledParam } from './types'
import { num, str } from '../core/params'
import { parseHex } from '../core/color'

type Rgb3 = [number, number, number]
const luma = (r: number, g: number, b: number) => (0.299 * r + 0.587 * g + 0.114 * b) / 255

/** 팔레트에서 가장 어두운 색(잉크)과 가장 밝은 색(종이) */
export function inkAndPaper(palette: string[]): { ink: Rgb3; paper: Rgb3 } {
  let ink: Rgb3 = [0, 0, 0]
  let paper: Rgb3 = [255, 255, 255]
  let lo = Infinity
  let hi = -Infinity
  for (const hex of palette) {
    const c = parseHex(hex)
    if (!c) continue
    const l = luma(c.r, c.g, c.b)
    if (l < lo) { lo = l; ink = [c.r, c.g, c.b] }
    if (l > hi) { hi = l; paper = [c.r, c.g, c.b] }
  }
  return { ink, paper }
}

export const halftone: EffectDef = {
  id: 'halftone',
  name: 'Halftone',
  params: [
    enabledParam(),
    { type: 'range', key: 'cell', label: 'Cell size', min: 2, max: 32, step: 1, default: 8 },
    { type: 'select', key: 'mode', label: 'Dots', default: 'ink', options: [{ value: 'ink', label: 'Ink' }, { value: 'color', label: 'Color' }] },
  ],
  apply(img, params, ctx) {
    const c = Math.max(2, Math.round(num(params, 'cell') * ctx.pxPerUnit))
    const colorMode = str(params, 'mode') === 'color'
    const { ink, paper } = inkAndPaper(ctx.palette)
    const { width: w, height: h, data } = img
    const src = new Uint8ClampedArray(data)
    for (let by = 0; by < h; by += c) {
      const y1 = Math.min(h, by + c)
      for (let bx = 0; bx < w; bx += c) {
        const x1 = Math.min(w, bx + c)
        let r = 0, g = 0, b = 0, n = 0
        for (let y = by; y < y1; y++) for (let x = bx; x < x1; x++) {
          const i = (y * w + x) * 4
          r += src[i]; g += src[i + 1]; b += src[i + 2]; n++
        }
        const R = r / n, G = g / n, B = b / n
        const a = 1 - luma(R, G, B)                 // 잉크 면적 비율
        const radius = 0.7071 * c * Math.sqrt(a)    // a = 1이면 셀 모서리까지 덮는다
        const cx = (bx + x1) / 2, cy = (by + y1) / 2
        const dot: Rgb3 = colorMode ? [R, G, B] : ink
        for (let y = by; y < y1; y++) for (let x = bx; x < x1; x++) {
          const dx = x + 0.5 - cx, dy = y + 0.5 - cy
          const i = (y * w + x) * 4
          // radius 0(흰색)이면 홀수 셀의 중심 픽셀도 종이로 남긴다
          const on = radius > 0 && dx * dx + dy * dy <= radius * radius
          const col = on ? dot : paper
          data[i] = col[0]; data[i + 1] = col[1]; data[i + 2] = col[2]
        }
      }
    }
  },
}
