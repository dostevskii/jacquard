import { describe, it, expect } from 'vitest'
import { mulberry32 } from '../core/prng'
import { fg, pickFg } from './util'

const P = ['#000000', '#111111', '#222222', '#333333', '#444444'] // 4 foreground colors

describe('fg', () => {
  it('cycles foreground colors and is safe for negative indices', () => {
    expect(fg(P, 0)).toBe('#111111')
    expect(fg(P, 4)).toBe('#111111')
    expect(fg(P, -1)).toBe('#444444')
    expect(fg(['#000000'], 3)).toBe('#000000')
  })
})

describe('pickFg', () => {
  it('never returns avoidIndex and is roughly uniform over the rest', () => {
    const rng = mulberry32(42)
    const counts = [0, 0, 0, 0]
    for (let k = 0; k < 6000; k++) counts[pickFg(P, rng, 1)]++
    expect(counts[1]).toBe(0)
    for (const i of [0, 2, 3]) {
      expect(counts[i]).toBeGreaterThan(6000 * 0.28)
      expect(counts[i]).toBeLessThan(6000 * 0.39)
    }
  })
  it('draws from all foreground indices when nothing is avoided', () => {
    const rng = mulberry32(7)
    const seen = new Set<number>()
    for (let k = 0; k < 500; k++) seen.add(pickFg(P, rng))
    expect([...seen].sort()).toEqual([0, 1, 2, 3])
  })
  it('returns 0 for a palette with a single foreground color', () => {
    expect(pickFg(['#000000', '#ffffff'], mulberry32(1), 0)).toBe(0)
  })
})
