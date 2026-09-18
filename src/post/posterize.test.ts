import { describe, it, expect } from 'vitest'
import { posterize } from './posterize'
import { makeImage, setPx, CTX } from './testUtils'

function gradient(): ReturnType<typeof makeImage> {
  const img = makeImage(256, 1)
  for (let x = 0; x < 256; x++) setPx(img, x, 0, [x, 255 - x, x])
  return img
}

describe('posterize', () => {
  it('limits each channel to `levels` distinct values, keeping 0 and 255', () => {
    for (const levels of [2, 3, 4, 8, 16]) {
      const img = gradient()
      posterize.apply(img, { enabled: true, levels }, CTX)
      const values = new Set<number>()
      for (let x = 0; x < 256; x++) values.add(img.data[x * 4])
      expect(values.size).toBe(levels)
      expect(values.has(0)).toBe(true)
      expect(values.has(255)).toBe(true)
    }
  })
  it('is monotonic', () => {
    const img = gradient()
    posterize.apply(img, { enabled: true, levels: 5 }, CTX)
    for (let x = 1; x < 256; x++) expect(img.data[x * 4]).toBeGreaterThanOrEqual(img.data[(x - 1) * 4])
  })
})
