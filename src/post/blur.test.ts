import { describe, it, expect } from 'vitest'
import type { RasterImage } from './types'
import { blur, MAX_BLUR_PX } from './blur'
import { makeImage, px, setPx, cloneImage, CTX } from './testUtils'

/** 검증용 느린 참조 구현: 경계를 감는 박스 블러 1회(가로 후 세로) */
function referenceBox(img: RasterImage, r: number): RasterImage {
  const out = cloneImage(img)
  const { width: w, height: h } = img
  const win = 2 * r + 1
  const tmp = cloneImage(img)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) for (let c = 0; c < 3; c++) {
    let s = 0
    for (let k = -r; k <= r; k++) s += img.data[(y * w + (((x + k) % w) + w) % w) * 4 + c]
    tmp.data[(y * w + x) * 4 + c] = s / win
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) for (let c = 0; c < 3; c++) {
    let s = 0
    for (let k = -r; k <= r; k++) s += tmp.data[((((y + k) % h) + h) % h * w + x) * 4 + c]
    out.data[(y * w + x) * 4 + c] = s / win
  }
  return out
}

const run = (img: RasterImage, radius: number, pxPerUnit = 1) => blur.apply(img, { enabled: true, radius }, { ...CTX, pxPerUnit })

describe('blur', () => {
  it('leaves a uniform image unchanged', () => {
    const img = makeImage(8, 6, [10, 200, 30])
    run(img, 3)
    for (let y = 0; y < 6; y++) for (let x = 0; x < 8; x++) expect(px(img, x, y)).toEqual([10, 200, 30, 255])
  })
  it('does nothing when the radius rounds below one pixel', () => {
    const img = makeImage(4, 4)
    setPx(img, 1, 1, [255, 255, 255])
    const before = cloneImage(img)
    run(img, 0.5, 0.5)
    expect(img.data).toEqual(before.data)
  })
  it('matches a naive wrap-around box blur applied three times (±1)', () => {
    const img = makeImage(12, 9)
    setPx(img, 0, 0, [255, 0, 0])
    setPx(img, 11, 4, [0, 255, 0])
    setPx(img, 5, 8, [0, 0, 255])
    let ref = cloneImage(img)
    for (let i = 0; i < 3; i++) ref = referenceBox(ref, 2)
    run(img, 2)
    for (let i = 0; i < img.data.length; i++) expect(Math.abs(img.data[i] - ref.data[i])).toBeLessThanOrEqual(1)
  })
  it('bleeds across the tile edge so repeats stay seamless', () => {
    const img = makeImage(16, 16)
    setPx(img, 0, 8, [255, 255, 255])
    run(img, 1)
    expect(px(img, 15, 8)[0]).toBeGreaterThan(0)
    expect(px(img, 8, 8)[0]).toBe(0)
  })
  it('preserves the mean and keeps alpha at 255', () => {
    const img = makeImage(10, 10)
    for (let x = 0; x < 10; x++) setPx(img, x, 3, [200, 100, 50])
    const mean = (im: RasterImage, c: number) => { let s = 0; for (let i = 0; i < 100; i++) s += im.data[i * 4 + c]; return s / 100 }
    const m0 = mean(img, 0)
    run(img, 2)
    expect(Math.abs(mean(img, 0) - m0)).toBeLessThan(1.5)
    for (let i = 0; i < 100; i++) expect(img.data[i * 4 + 3]).toBe(255)
  })
  it('caps the pixel radius', () => {
    expect(MAX_BLUR_PX).toBe(64)
    const img = makeImage(4, 4)
    expect(() => run(img, 32, 100)).not.toThrow()
  })
})
