import { describe, it, expect } from 'vitest'
import { PRESETS, DEFAULT_PALETTE, MAX_COLORS, ensurePaletteLength, randomPalette } from './palettes'
import { parseHex } from './color'

describe('PRESETS', () => {
  it('has 8 presets of valid lowercase hex, 2..8 colors each', () => {
    expect(PRESETS).toHaveLength(8)
    for (const p of PRESETS) {
      expect(p.name.length).toBeGreaterThan(0)
      expect(p.colors.length).toBeGreaterThanOrEqual(2)
      expect(p.colors.length).toBeLessThanOrEqual(MAX_COLORS)
      for (const c of p.colors) {
        expect(c).toMatch(/^#[0-9a-f]{6}$/)
        expect(parseHex(c)).not.toBeNull()
      }
    }
    expect(DEFAULT_PALETTE).toEqual(PRESETS[0].colors)
  })
})

describe('ensurePaletteLength', () => {
  it('returns the same array when long enough', () => {
    const p = ['#000000', '#ffffff', '#ff0000']
    expect(ensurePaletteLength(p, 3)).toBe(p)
  })
  it('appends filler colors not already present', () => {
    const out = ensurePaletteLength(['#000000', '#ffffff'], 4)
    expect(out).toHaveLength(4)
    expect(out.slice(0, 2)).toEqual(['#000000', '#ffffff'])
    expect(new Set(out).size).toBe(4)
  })
})

describe('randomPalette', () => {
  it('returns count valid colors, deterministic for a fixed random source', () => {
    let i = 0
    const seq = [0.1, 0.7, 0.3, 0.9, 0.2, 0.5, 0.8, 0.4, 0.6, 0.05, 0.95, 0.33]
    const random = () => seq[i++ % seq.length]
    const a = randomPalette(5, random)
    i = 0
    const b = randomPalette(5, random)
    expect(a).toEqual(b)
    expect(a).toHaveLength(5)
    for (const c of a) expect(c).toMatch(/^#[0-9a-f]{6}$/)
  })
})
