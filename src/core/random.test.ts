import { describe, it, expect } from 'vitest'
import type { ParamDef } from './params'
import { mulberry32 } from './prng'
import { parseHex, rgbToHsv } from './color'
import type { PatternState } from './state'
import { randomParamValue, randomizeParams, randomSwatch, randomizePalette, randomizeAll } from './random'

const DEFS: ParamDef[] = [
  { type: 'range', key: 'cell', label: 'Cell', min: 4, max: 64, step: 2, default: 16 },
  { type: 'range', key: 'offset', label: 'Offset', min: 0, max: 1, step: 0.25, default: 0.5 },
  { type: 'select', key: 'mode', label: 'Mode', options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }, { value: 'c', label: 'C' }], default: 'a' },
  { type: 'toggle', key: 'flag', label: 'Flag', default: false },
]
const PALETTE = ['#111111', '#e63b2e', '#f2a91e', '#6aa9dc']

describe('randomParamValue', () => {
  it('range values stay inside min..max and on the step grid', () => {
    const rng = mulberry32(3)
    const seen = new Set<number>()
    for (let i = 0; i < 500; i++) {
      const v = randomParamValue(DEFS[1], rng) as number
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(1)
      expect(Math.abs(v / 0.25 - Math.round(v / 0.25))).toBeLessThan(1e-9)
      seen.add(v)
    }
    expect([...seen].sort()).toEqual([0, 0.25, 0.5, 0.75, 1])
    for (let i = 0; i < 200; i++) {
      const v = randomParamValue(DEFS[0], rng) as number
      expect(v % 2).toBe(0)
      expect(v).toBeGreaterThanOrEqual(4)
      expect(v).toBeLessThanOrEqual(64)
    }
  })
  it('select picks an existing option and toggle yields both values', () => {
    const rng = mulberry32(9)
    const modes = new Set<string>()
    const flags = new Set<boolean>()
    for (let i = 0; i < 200; i++) {
      modes.add(randomParamValue(DEFS[2], rng) as string)
      flags.add(randomParamValue(DEFS[3], rng) as boolean)
    }
    expect([...modes].sort()).toEqual(['a', 'b', 'c'])
    expect(flags.size).toBe(2)
  })
})

describe('randomizeParams', () => {
  const params = { cell: 16, offset: 0.5, mode: 'a', flag: false }
  it('leaves locked keys untouched and changes unlocked ones deterministically', () => {
    const a = randomizeParams(DEFS, params, ['cell', 'mode'], mulberry32(5))
    const b = randomizeParams(DEFS, params, ['cell', 'mode'], mulberry32(5))
    expect(a).toEqual(b)
    expect(a.cell).toBe(16)
    expect(a.mode).toBe('a')
    expect(Object.keys(a).sort()).toEqual(['cell', 'flag', 'mode', 'offset'])
  })
  it('different seeds give different results and the input is not mutated', () => {
    const results = new Set<string>()
    for (let s = 1; s <= 20; s++) results.add(JSON.stringify(randomizeParams(DEFS, params, [], mulberry32(s))))
    expect(results.size).toBeGreaterThan(5)
    expect(params).toEqual({ cell: 16, offset: 0.5, mode: 'a', flag: false })
  })
})

describe('randomSwatch / randomizePalette', () => {
  it('index 0 is a background-style color (very dark or very light), others are foreground-style', () => {
    for (let s = 1; s <= 30; s++) {
      const bg = rgbToHsv(parseHex(randomSwatch(0, mulberry32(s)))!)
      expect(bg.v <= 15 || bg.v >= 91).toBe(true)
      const fg = rgbToHsv(parseHex(randomSwatch(3, mulberry32(s)))!)
      expect(fg.s).toBeGreaterThanOrEqual(54)
      expect(fg.v).toBeGreaterThanOrEqual(34)
    }
  })
  it('randomizePalette keeps length and locked indices', () => {
    const out = randomizePalette(PALETTE, [0, 2], mulberry32(7))
    expect(out).toHaveLength(4)
    expect(out[0]).toBe('#111111')
    expect(out[2]).toBe('#f2a91e')
    expect(out[1]).not.toBe('#e63b2e')
    for (const c of out) expect(c).toMatch(/^#[0-9a-f]{6}$/)
    expect(randomizePalette(PALETTE, [0, 2], mulberry32(7))).toEqual(out)
  })
})

describe('randomizeAll', () => {
  const state: PatternState = { generator: 'g', seed: 42, params: { cell: 16, offset: 0.5, mode: 'a', flag: false }, palette: PALETTE, locks: { seed: true, params: ['offset'], palette: [1] } }
  it('respects every lock and leaves generator and locks unchanged', () => {
    const out = randomizeAll(state, DEFS, mulberry32(11))
    expect(out.seed).toBe(42)
    expect(out.params.offset).toBe(0.5)
    expect(out.palette[1]).toBe('#e63b2e')
    expect(out.generator).toBe('g')
    expect(out.locks).toEqual(state.locks)
    expect(out.palette).toHaveLength(4)
  })
  it('changes the seed when it is not locked', () => {
    const out = randomizeAll({ ...state, locks: { seed: false, params: [], palette: [] } }, DEFS, mulberry32(11))
    expect(out.seed).not.toBe(42)
    expect(Number.isInteger(out.seed)).toBe(true)
    expect(out.seed).toBeGreaterThanOrEqual(0)
    expect(out.seed).toBeLessThanOrEqual(0xffffffff)
  })
})
