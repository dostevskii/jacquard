import { describe, it, expect } from 'vitest'
import { grain, grainNoise } from './grain'
import { makeImage, px, CTX } from './testUtils'

const run = (amount: number, size = 1, color = false, seed = 7, pxPerUnit = 1) => {
  const img = makeImage(32, 32, [128, 128, 128])
  grain.apply(img, { enabled: true, amount, size, color }, { ...CTX, seed, pxPerUnit })
  return img
}

describe('grainNoise', () => {
  it('is deterministic, in [-1, 1] and roughly centered', () => {
    let sum = 0
    for (let i = 0; i < 4000; i++) {
      const v = grainNoise(i % 64, Math.floor(i / 64), 11)
      expect(v).toBeGreaterThanOrEqual(-1)
      expect(v).toBeLessThanOrEqual(1)
      sum += v
    }
    expect(Math.abs(sum / 4000)).toBeLessThan(0.05)
    expect(grainNoise(3, 4, 5)).toBe(grainNoise(3, 4, 5))
    expect(grainNoise(3, 4, 5)).not.toBe(grainNoise(3, 4, 6))
  })
})

describe('grain', () => {
  it('is deterministic per seed and differs across seeds', () => {
    expect(run(50).data).toEqual(run(50).data)
    expect(run(50, 1, false, 7).data).not.toEqual(run(50, 1, false, 8).data)
  })
  it('never exceeds amount × 1.28 and averages near zero', () => {
    const img = run(100)
    let sum = 0
    for (let i = 0; i < 32 * 32; i++) {
      const d = img.data[i * 4] - 128
      expect(Math.abs(d)).toBeLessThanOrEqual(128)
      sum += d
    }
    // 시드가 고정이라 확률 검사가 아니다. 평균의 표준편차 ≈ 2.3이므로 12.8은 넉넉한 상한
    expect(Math.abs(sum / 1024)).toBeLessThan(128 * 0.1)
    const mild = run(10)
    for (let i = 0; i < 32 * 32; i++) expect(Math.abs(mild.data[i * 4] - 128)).toBeLessThanOrEqual(13)
  })
  it('amount 0 leaves the image unchanged and alpha stays 255', () => {
    const img = run(0)
    for (let i = 0; i < 32 * 32; i++) {
      expect(img.data[i * 4]).toBe(128)
      expect(img.data[i * 4 + 3]).toBe(255)
    }
  })
  it('size 4 makes 4×4 blocks share one value', () => {
    const img = run(60, 4)
    for (let by = 0; by < 8; by++) for (let bx = 0; bx < 8; bx++) {
      const v = px(img, bx * 4, by * 4)[0]
      for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) expect(px(img, bx * 4 + x, by * 4 + y)[0]).toBe(v)
    }
  })
  it('mono grain moves all channels together, color grain does not', () => {
    const mono = run(60)
    for (let i = 0; i < 32 * 32; i++) {
      expect(mono.data[i * 4]).toBe(mono.data[i * 4 + 1])
      expect(mono.data[i * 4]).toBe(mono.data[i * 4 + 2])
    }
    const col = run(60, 1, true)
    let differs = 0
    for (let i = 0; i < 32 * 32; i++) if (col.data[i * 4] !== col.data[i * 4 + 1]) differs++
    expect(differs).toBeGreaterThan(500)
  })
  it('scales grain size with pxPerUnit', () => {
    const img = run(60, 2, false, 7, 2)
    const v = px(img, 0, 0)[0]
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) expect(px(img, x, y)[0]).toBe(v)
  })
})
