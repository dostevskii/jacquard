import { describe, it, expect } from 'vitest'
import type { ParamDef } from './params'
import { defaultParams, clampParams, snapValue, num, str, bool } from './params'

const DEFS: ParamDef[] = [
  { type: 'range', key: 'cell', label: 'Cell', min: 4, max: 64, step: 2, default: 16 },
  { type: 'range', key: 'offset', label: 'Offset', min: 0, max: 1, step: 0.25, default: 0.5 },
  { type: 'select', key: 'mode', label: 'Mode', options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }], default: 'a' },
  { type: 'toggle', key: 'flag', label: 'Flag', default: true },
]

describe('defaultParams', () => {
  it('collects defaults', () => {
    expect(defaultParams(DEFS)).toEqual({ cell: 16, offset: 0.5, mode: 'a', flag: true })
  })
})

describe('clampParams', () => {
  it('fills missing keys with defaults', () => {
    expect(clampParams(DEFS, {})).toEqual(defaultParams(DEFS))
  })
  it('clamps and snaps ranges', () => {
    const out = clampParams(DEFS, { cell: 1000, offset: 0.3 })
    expect(out.cell).toBe(64)
    expect(out.offset).toBe(0.25)
    expect(clampParams(DEFS, { cell: -5 }).cell).toBe(4)
    expect(clampParams(DEFS, { cell: 7 }).cell).toBe(8)
  })
  it('rejects wrong types and unknown options', () => {
    const out = clampParams(DEFS, { cell: 'big', mode: 'zzz', flag: 'yes', extra: 1 })
    expect(out).toEqual(defaultParams(DEFS))
    expect('extra' in out).toBe(false)
  })
  it('accepts valid select and toggle', () => {
    const out = clampParams(DEFS, { mode: 'b', flag: false })
    expect(out.mode).toBe('b')
    expect(out.flag).toBe(false)
  })
  it('avoids floating point garbage after snapping', () => {
    const defs: ParamDef[] = [{ type: 'range', key: 'd', label: 'D', min: 0.1, max: 0.6, step: 0.05, default: 0.3 }]
    expect(clampParams(defs, { d: 0.35 }).d).toBe(0.35)
    expect(clampParams(defs, { d: 0.3 }).d).toBe(0.3)
  })
})

describe('snapValue', () => {
  it('snapValue snaps to step and clamps', () => {
    const def = DEFS[0] as Extract<ParamDef, { type: 'range' }>
    expect(snapValue(def, 5)).toBe(6)
    expect(snapValue(def, 999)).toBe(64)
  })
})

describe('readers', () => {
  it('cast values', () => {
    const p = defaultParams(DEFS)
    expect(num(p, 'cell')).toBe(16)
    expect(str(p, 'mode')).toBe('a')
    expect(bool(p, 'flag')).toBe(true)
  })
})
