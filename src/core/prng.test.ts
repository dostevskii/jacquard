import { describe, it, expect } from 'vitest'
import { mulberry32, randomSeed, MAX_SEED } from './prng'

describe('mulberry32', () => {
  it('produces the same sequence for the same seed', () => {
    const a = mulberry32(12345)
    const b = mulberry32(12345)
    const seqA = Array.from({ length: 20 }, () => a.next())
    const seqB = Array.from({ length: 20 }, () => b.next())
    expect(seqA).toEqual(seqB)
  })

  it('produces different sequences for different seeds', () => {
    const a = mulberry32(1)
    const b = mulberry32(2)
    const seqA = Array.from({ length: 5 }, () => a.next())
    const seqB = Array.from({ length: 5 }, () => b.next())
    expect(seqA).not.toEqual(seqB)
  })

  it('stays within [0, 1) and averages near 0.5', () => {
    const rng = mulberry32(7)
    let sum = 0
    for (let i = 0; i < 10000; i++) {
      const v = rng.next()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
      sum += v
    }
    const mean = sum / 10000
    expect(mean).toBeGreaterThan(0.45)
    expect(mean).toBeLessThan(0.55)
  })

  it('int() is inclusive on both ends and hits every value', () => {
    const rng = mulberry32(99)
    const seen = new Set<number>()
    for (let i = 0; i < 1000; i++) {
      const v = rng.int(3, 6)
      expect(Number.isInteger(v)).toBe(true)
      expect(v).toBeGreaterThanOrEqual(3)
      expect(v).toBeLessThanOrEqual(6)
      seen.add(v)
    }
    expect([...seen].sort()).toEqual([3, 4, 5, 6])
  })

  it('pick() returns an element and shuffle() keeps the multiset', () => {
    const rng = mulberry32(5)
    const items = ['a', 'b', 'c', 'd']
    expect(items).toContain(rng.pick(items))
    const shuffled = rng.shuffle(items)
    expect(shuffled).not.toBe(items)
    expect([...shuffled].sort()).toEqual([...items].sort())
  })
})

describe('randomSeed', () => {
  it('returns an integer in range', () => {
    for (let i = 0; i < 100; i++) {
      const s = randomSeed()
      expect(Number.isInteger(s)).toBe(true)
      expect(s).toBeGreaterThanOrEqual(0)
      expect(s).toBeLessThanOrEqual(MAX_SEED)
    }
  })
})
