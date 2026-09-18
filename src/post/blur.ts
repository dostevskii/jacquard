import type { EffectDef, RasterImage } from './types'
import { enabledParam } from './types'
import { num } from '../core/params'

export const MAX_BLUR_PX = 64

const mod = (i: number, n: number) => ((i % n) + n) % n

/**
 * 한 줄(행 또는 열)의 RGB 세 채널에 경계를 감는 박스 블러를 적용한다.
 * base: 첫 픽셀의 R 인덱스, step: 다음 픽셀까지의 인덱스 간격(행 4, 열 width*4), n: 줄 길이
 */
function blurLine(data: Uint8ClampedArray, tmp: Float32Array, base: number, step: number, n: number, r: number): void {
  const win = 2 * r + 1
  for (let c = 0; c < 3; c++) {
    let sum = 0
    for (let k = -r; k <= r; k++) sum += data[base + mod(k, n) * step + c]
    for (let i = 0; i < n; i++) {
      tmp[i] = sum / win
      sum += data[base + mod(i + r + 1, n) * step + c] - data[base + mod(i - r, n) * step + c]
    }
    for (let i = 0; i < n; i++) data[base + i * step + c] = tmp[i]
  }
}

/** 박스 블러 1회(가로 → 세로), 경계 감기 */
function boxBlur(img: RasterImage, r: number): void {
  const { width: w, height: h, data } = img
  const tmp = new Float32Array(Math.max(w, h))
  for (let y = 0; y < h; y++) blurLine(data, tmp, y * w * 4, 4, w, r)
  for (let x = 0; x < w; x++) blurLine(data, tmp, x * 4, w * 4, h, r)
}

export const blur: EffectDef = {
  id: 'blur',
  name: 'Blur',
  params: [
    enabledParam(),
    { type: 'range', key: 'radius', label: 'Radius', min: 0.5, max: 32, step: 0.5, default: 4 },
  ],
  apply(img, params, ctx) {
    const r = Math.min(MAX_BLUR_PX, Math.round(num(params, 'radius') * ctx.pxPerUnit))
    if (r < 1) return
    // 박스 블러 3회 ≈ 가우시안
    for (let pass = 0; pass < 3; pass++) boxBlur(img, r)
  },
}
