import type { EffectInfo, EffectsState } from '../core/state'
import { bool, defaultParams } from '../core/params'
import type { EffectContext, EffectDef, RasterImage } from './types'
import { pixelate } from './pixelate'
import { blur } from './blur'
import { posterize } from './posterize'
import { dither } from './dither'
import { halftone } from './halftone'
import { grain } from './grain'

// 적용 순서는 고정이다: 해상도를 줄이는 효과 → 색 단순화 → 망점 → 마지막에 결(grain)
export const EFFECTS: EffectDef[] = [pixelate, blur, posterize, dither, halftone, grain]

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
