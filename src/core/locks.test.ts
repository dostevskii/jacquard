import { describe, it, expect } from 'vitest'
import type { LockState } from './locks'
import {
  emptyLocks, lockParam, toggleParamLock, clearParamLocks, toggleSeedLock,
  lockSwatch, toggleSwatchLock, lockAllSwatches, swatchLocksAfterSwap, swatchLocksAfterRemove,
  clampSwatchLocks, normalizeLocks,
} from './locks'

const base = (): LockState => ({ seed: false, params: ['cell'], palette: [0, 2] })

describe('locks helpers are pure', () => {
  it('never mutate the input and return fresh objects', () => {
    const l = base()
    const snapshot = JSON.stringify(l)
    const outs = [
      lockParam(l, 'rows'), toggleParamLock(l, 'cell'), clearParamLocks(l), toggleSeedLock(l),
      lockSwatch(l, 1), toggleSwatchLock(l, 0), lockAllSwatches(l, 3), swatchLocksAfterSwap(l, 0, 1),
      swatchLocksAfterRemove(l, 0), clampSwatchLocks(l, 1),
    ]
    expect(JSON.stringify(l)).toBe(snapshot)
    for (const o of outs) expect(o).not.toBe(l)
    expect(emptyLocks()).not.toBe(emptyLocks())
  })
})

describe('param locks', () => {
  it('lockParam adds once, toggle flips, clear empties', () => {
    const l = base()
    expect(lockParam(l, 'rows').params).toEqual(['cell', 'rows'])
    expect(lockParam(l, 'cell').params).toEqual(['cell'])
    expect(toggleParamLock(l, 'cell').params).toEqual([])
    expect(toggleParamLock(l, 'rows').params).toEqual(['cell', 'rows'])
    expect(clearParamLocks(l)).toEqual({ seed: false, params: [], palette: [0, 2] })
  })
  it('toggleSeedLock flips only seed', () => {
    expect(toggleSeedLock(base())).toEqual({ seed: true, params: ['cell'], palette: [0, 2] })
  })
})

describe('swatch locks', () => {
  it('lock/toggle keep the list sorted and unique', () => {
    expect(lockSwatch(base(), 1).palette).toEqual([0, 1, 2])
    expect(lockSwatch(base(), 2).palette).toEqual([0, 2])
    expect(toggleSwatchLock(base(), 2).palette).toEqual([0])
    expect(toggleSwatchLock(base(), 1).palette).toEqual([0, 1, 2])
    expect(lockAllSwatches(base(), 4).palette).toEqual([0, 1, 2, 3])
  })
  it('swap moves locks with the swatches', () => {
    expect(swatchLocksAfterSwap(base(), 0, 1).palette).toEqual([1, 2])
    expect(swatchLocksAfterSwap(base(), 2, 3).palette).toEqual([0, 3])
    expect(swatchLocksAfterSwap(base(), 1, 3).palette).toEqual([0, 2])
  })
  it('remove drops the index and shifts later ones down', () => {
    expect(swatchLocksAfterRemove(base(), 0).palette).toEqual([1])
    expect(swatchLocksAfterRemove(base(), 1).palette).toEqual([0, 1])
    expect(swatchLocksAfterRemove(base(), 2).palette).toEqual([0])
  })
  it('clamp removes indices beyond the palette', () => {
    expect(clampSwatchLocks(base(), 2).palette).toEqual([0])
    expect(clampSwatchLocks(base(), 3).palette).toEqual([0, 2])
  })
})

describe('normalizeLocks', () => {
  it('returns empty locks for junk', () => {
    expect(normalizeLocks(undefined, ['cell'], 3)).toEqual(emptyLocks())
    expect(normalizeLocks('x', ['cell'], 3)).toEqual(emptyLocks())
    expect(normalizeLocks([1], ['cell'], 3)).toEqual(emptyLocks())
  })
  it('keeps only known keys and in-range indices, dedups and sorts', () => {
    const out = normalizeLocks({ seed: true, params: ['cell', 'zzz', 5, 'cell'], palette: [2, 0, 2, -1, 9, 1.5, 'a'] }, ['cell', 'rows'], 3)
    expect(out).toEqual({ seed: true, params: ['cell'], palette: [0, 2] })
    expect(normalizeLocks({ seed: 'yes' }, [], 0)).toEqual(emptyLocks())
  })
})
