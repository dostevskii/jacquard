import type { EffectInfo, EffectsState } from '../core/state'
import { bool, defaultParams } from '../core/params'
import type { EffectContext, EffectDef, RasterImage } from './types'
import { blur } from './blur'
import { grain } from './grain'

// Task 2~4에서 import를 추가하며 이 순서로 채운다: pixelate, blur, posterize, dither, halftone, grain
export const EFFECTS: EffectDef[] = [blur, grain]

export function defaultEffects(defs: EffectDef[] = EFFECTS): EffectsState {
  const out: EffectsState = {}
  for (const e of defs) out[e.id] = defaultParams(e.params)
  return out
}

export function effectInfos(defs: EffectDef[] = EFFECTS): EffectInfo[] {
  return defs.map((e) => ({ id: e.id, params: e.params }))
}

export function hasEnabledEffects(effects: EffectsState, defs: EffectDef[] = EFFECTS): boolean {
  return defs.some((e) => effects[e.id] !== undefined && bool(effects[e.id], 'enabled'))
}

/** 켜진 효과를 등록 순서대로 제자리 적용한다 */
export function applyEffects(img: RasterImage, effects: EffectsState, ctx: EffectContext, defs: EffectDef[] = EFFECTS): void {
  for (const e of defs) {
    const p = effects[e.id]
    if (p && bool(p, 'enabled')) e.apply(img, p, ctx)
  }
}
