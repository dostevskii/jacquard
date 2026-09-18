import { describe, it, expect } from 'vitest'
import { dither, bayerMatrix } from './dither'
import { makeImage, px, CTX } from './testUtils'

describe('bayerMatrix', () => {
  it('builds the standard matrices', () => {
    expect(bayerMatrix(2)).toEqual([[0, 2], [3, 1]])
    const m4 = bayerMatrix(4)
    expect(m4.flat().sort((a, b) => a - b)).toEqual(Array.from({ length: 16 }, (_, i) => i))
    expect(m4[0]).toEqual([0, 8, 2, 10])
    expect(bayerMatrix(8).flat().sort((a, b) => a - b)).toEqual(Array.from({ length: 64 }, (_, i) => i))
  })
})

describe('dither', () => {
  it('outputs only the level set', () => {
    const img = makeImage(16, 16)
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) img.data[(y * 16 + x) * 4] = x * 16
    dither.apply(img, { enabled: true, levels: 3, matrix: '4' }, CTX)
    for (let i = 0; i < 256; i++) expect([0, 128, 255]).toContain(img.data[i * 4])
  })
  it('turns 50 % grey into about half black, half white at two levels', () => {
    const img = makeImage(16, 16, [128, 128, 128])
    dither.apply(img, { enabled: true, levels: 2, matrix: '4' }, CTX)
    let white = 0
    for (let i = 0; i < 256; i++) if (img.data[i * 4] === 255) white++
    expect(Math.abs(white - 128)).toBeLessThanOrEqual(16)
  })
  it('repeats with the matrix period', () => {
    const img = makeImage(16, 8, [100, 100, 100])
    dither.apply(img, { enabled: true, levels: 2, matrix: '4' }, CTX)
    for (let y = 0; y < 8; y++) for (let x = 0; x < 16; x++) expect(px(img, x, y)).toEqual(px(img, x % 4, y % 4))
  })
})
