import { describe, it, expect } from 'vitest'
import type { ParamDef } from './params'
import type { PatternState, ResolveGenerator } from './state'
import { encodeState, decodeState, normalizePalette, DEFAULT_SEED } from './state'

const A_DEFS: ParamDef[] = [
  { type: 'range', key: 'cell', label: 'Cell', min: 4, max: 64, step: 2, default: 16 },
  { type: 'select', key: 'mode', label: 'Mode', options: [{ value: 'x', label: 'X' }, { value: 'y', label: 'Y' }], default: 'x' },
]
const B_DEFS: ParamDef[] = [{ type: 'toggle', key: 'flag', label: 'Flag', default: false }]

const resolve: ResolveGenerator = (id) =>
  id === 'a' ? { params: A_DEFS, minColors: 3 } : id === 'b' ? { params: B_DEFS, minColors: 2 } : undefined

const defaults = { generator: 'a', palette: ['#000000', '#ffffff', '#ff0000', '#00ff00'] }

describe('encode/decode', () => {
  it('round-trips a valid state', () => {
    const state: PatternState = { generator: 'b', seed: 4242, params: { flag: true }, palette: ['#111111', '#e63b2e'] }
    const hash = encodeState(state)
    expect(hash).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(decodeState('#' + hash, resolve, defaults)).toEqual(state)
    expect(decodeState(hash, resolve, defaults)).toEqual(state)
  })
  it('returns defaults for empty or garbage hash', () => {
    const base = decodeState('', resolve, defaults)
    expect(base).toEqual({ generator: 'a', seed: DEFAULT_SEED, params: { cell: 16, mode: 'x' }, palette: defaults.palette })
    expect(decodeState('#not-base64!!', resolve, defaults)).toEqual(base)
    expect(decodeState('#' + btoa('[1,2,3]'), resolve, defaults)).toEqual(base)
    expect(decodeState('#' + btoa('42'), resolve, defaults)).toEqual(base)
  })
  it('falls back to the default generator for unknown ids', () => {
    const hash = encodeState({ generator: 'zzz', seed: 5, params: {}, palette: ['#000000', '#ffffff'] })
    const out = decodeState(hash, resolve, defaults)
    expect(out.generator).toBe('a')
    expect(out.seed).toBe(5)
    expect(out.params).toEqual({ cell: 16, mode: 'x' })
  })
  it('clamps params and seed', () => {
    const hash = encodeState({ generator: 'a', seed: -3, params: { cell: 999, mode: 'nope' }, palette: ['#000000', '#ffffff', '#ff0000'] })
    const out = decodeState(hash, resolve, defaults)
    expect(out.seed).toBe(DEFAULT_SEED)
    expect(out.params).toEqual({ cell: 64, mode: 'x' })
  })
  it('normalizes the palette', () => {
    const hash = encodeState({ generator: 'a', seed: 1, params: {}, palette: ['#ABC', 'junk', '#ffffff'] })
    const out = decodeState(hash, resolve, defaults)
    expect(out.palette.slice(0, 2)).toEqual(['#aabbcc', '#ffffff'])
    expect(out.palette.length).toBeGreaterThanOrEqual(3)
  })
})

describe('normalizePalette', () => {
  it('drops invalid entries, lowercases, caps at 8, pads to minColors', () => {
    expect(normalizePalette(['#FFF', 'x', '#000000'], 2, ['#111111', '#222222'])).toEqual(['#ffffff', '#000000'])
    expect(normalizePalette('nope', 2, ['#111111', '#222222'])).toEqual(['#111111', '#222222'])
    expect(normalizePalette(['#000000'], 2, ['#111111', '#222222'])).toEqual(['#111111', '#222222'])
    const nine = Array.from({ length: 9 }, (_, i) => `#0000${i}${i}`)
    expect(normalizePalette(nine, 2, ['#111111', '#222222'])).toHaveLength(8)
    expect(normalizePalette(['#000000', '#ffffff'], 4, ['#111111', '#222222'])).toHaveLength(4)
  })
})
