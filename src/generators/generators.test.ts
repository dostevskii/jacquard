import { describe, it, expect } from 'vitest'
import type { ParamValue } from '../core/params'
import { defaultParams } from '../core/params'
import { EPS, shapeBounds } from '../core/scene'
import { PRESETS, ensurePaletteLength } from '../core/palettes'
import { GENERATORS, getGenerator, generateScene, DEFAULT_GENERATOR_ID } from './index'
import { PALETTE8, run, colorsOf } from './testUtils'

interface Case {
  id: string
  /** rng를 실제로 사용하게 만드는 매개변수(없으면 결정성 테스트에서 시드 비교를 건너뜀) */
  rngParams?: Record<string, ParamValue>
  /** 팔레트 밖 색(혼합색)이 허용되는 생성기 */
  mixedColors?: boolean
}

// 2부에서 생성기를 추가할 때마다 여기에 한 행씩 추가한다
const CASES: Case[] = [
  { id: 'stripes', rngParams: { colorMode: 'random' } },
  { id: 'plaid', rngParams: { blend: 'weave' }, mixedColors: true },
  { id: 'zigzag', rngParams: { colorMode: 'random' } },
  { id: 'motif', rngParams: { density: 0.5 } },
  { id: 'rings', rngParams: { maxRing: 4 } },
  { id: 'gradientBars', rngParams: { colorMode: 'random' } },
  { id: 'isoCubes', rngParams: { shuffle: true } },
  { id: 'triangles', rngParams: { rule: 'random' } },
]

describe('registry', () => {
  it('has unique ids and a valid default', () => {
    const ids = GENERATORS.map((g) => g.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(getGenerator(DEFAULT_GENERATOR_ID)).toBeDefined()
    expect(getGenerator('nope')).toBeUndefined()
  })
  it('every registered generator has a test case', () => {
    for (const g of GENERATORS) expect(CASES.some((c) => c.id === g.id)).toBe(true)
  })
  it('generateScene pads a short palette and clamps params', () => {
    const scene = generateScene({ generator: DEFAULT_GENERATOR_ID, seed: 3, params: { cell: 9999 }, palette: ['#000000', '#ffffff'] })
    expect(scene.shapes.length).toBeGreaterThan(0)
  })
})

describe.each(CASES)('generator $id', ({ id, rngParams, mixedColors }) => {
  it('is registered', () => {
    expect(getGenerator(id)).toBeDefined()
  })
  it('is deterministic for the same input', () => {
    expect(run(id, rngParams)).toEqual(run(id, rngParams))
  })
  it('changes with the seed when rng is used', () => {
    if (!rngParams) return
    expect(run(id, rngParams, PALETTE8, 1)).not.toEqual(run(id, rngParams, PALETTE8, 2))
  })
  it('has a positive tile size and at least one shape', () => {
    const s = run(id)
    expect(s.width).toBeGreaterThan(0)
    expect(s.height).toBeGreaterThan(0)
    expect(s.shapes.length).toBeGreaterThan(0)
  })
  it('keeps every shape inside the tile', () => {
    for (const params of [undefined, rngParams]) {
      const s = run(id, params)
      for (const sh of s.shapes) {
        const b = shapeBounds(sh)
        expect(b.x0).toBeGreaterThanOrEqual(-EPS)
        expect(b.y0).toBeGreaterThanOrEqual(-EPS)
        expect(b.x1).toBeLessThanOrEqual(s.width + EPS)
        expect(b.y1).toBeLessThanOrEqual(s.height + EPS)
      }
    }
  })
  it('uses only palette colors (background = palette[0])', () => {
    const s = run(id)
    expect(s.background).toBe(PALETTE8[0])
    if (mixedColors) return
    for (const c of colorsOf(s)) expect(PALETTE8).toContain(c)
  })
  it('has defaults within range', () => {
    for (const d of getGenerator(id)!.params) {
      if (d.type === 'range') {
        expect(d.default).toBeGreaterThanOrEqual(d.min)
        expect(d.default).toBeLessThanOrEqual(d.max)
        expect(d.step).toBeGreaterThan(0)
      }
      if (d.type === 'select') expect(d.options.some((o) => o.value === d.default)).toBe(true)
    }
  })
  it('works with the minimum palette, 8 colors, and every preset', () => {
    const g = getGenerator(id)!
    expect(() => run(id, {}, PALETTE8.slice(0, g.minColors))).not.toThrow()
    expect(() => run(id, {}, PALETTE8)).not.toThrow()
    for (const p of PRESETS) expect(() => run(id, {}, ensurePaletteLength(p.colors, g.minColors))).not.toThrow()
  })
  it('grid tiles are whole multiples of cell', () => {
    const g = getGenerator(id)!
    if (g.family !== 'grid') return
    const s = run(id)
    const cell = defaultParams(g.params).cell as number
    expect(Math.abs(s.width / cell - Math.round(s.width / cell))).toBeLessThan(EPS)
    expect(Math.abs(s.height / cell - Math.round(s.height / cell))).toBeLessThan(EPS)
  })
})
