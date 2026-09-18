import { describe, it, expect } from 'vitest'
import type { EffectDef } from './types'
import { enabledParam } from './types'
import { EFFECTS, applyEffects, defaultEffects, hasEnabledEffects, effectInfos } from './index'
import { makeImage, CTX } from './testUtils'

const calls: string[] = []
const fake = (id: string): EffectDef => ({
  id,
  name: id,
  params: [enabledParam(), { type: 'range', key: 'amount', label: 'Amount', min: 0, max: 10, step: 1, default: 3 }],
  apply(img) {
    calls.push(id)
    img.data[0] = img.data[0] + 10
  },
})
const DEFS = [fake('a'), fake('b'), fake('c')]

describe('post registry', () => {
  it('defaultEffects has every id with its defaults', () => {
    expect(defaultEffects(DEFS)).toEqual({ a: { enabled: false, amount: 3 }, b: { enabled: false, amount: 3 }, c: { enabled: false, amount: 3 } })
    expect(effectInfos(DEFS).map((e) => e.id)).toEqual(['a', 'b', 'c'])
    for (const e of EFFECTS) expect(e.params[0]).toEqual(enabledParam())
    expect(EFFECTS.map((e) => e.id)).toEqual(['pixelate', 'blur', 'posterize', 'dither', 'halftone', 'grain'])
  })
  it('hasEnabledEffects only when some effect is enabled', () => {
    const e = defaultEffects(DEFS)
    expect(hasEnabledEffects(e, DEFS)).toBe(false)
    e.b = { ...e.b, enabled: true }
    expect(hasEnabledEffects(e, DEFS)).toBe(true)
    expect(hasEnabledEffects({}, DEFS)).toBe(false)
  })
  it('applyEffects runs enabled effects in registry order and leaves the image alone otherwise', () => {
    const img = makeImage(2, 2, [100, 100, 100])
    calls.length = 0
    applyEffects(img, defaultEffects(DEFS), CTX, DEFS)
    expect(calls).toEqual([])
    expect(img.data[0]).toBe(100)
    const e = defaultEffects(DEFS)
    e.c = { ...e.c, enabled: true }
    e.a = { ...e.a, enabled: true }
    applyEffects(img, e, CTX, DEFS)
    expect(calls).toEqual(['a', 'c'])
    expect(img.data[0]).toBe(120)
    expect(img.data[3]).toBe(255)
  })
  it('ignores ids that are not registered', () => {
    const img = makeImage(1, 1)
    calls.length = 0
    applyEffects(img, { zzz: { enabled: true } }, CTX, DEFS)
    expect(calls).toEqual([])
  })
})
