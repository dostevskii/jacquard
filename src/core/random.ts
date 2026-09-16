import type { ParamDef, ParamValue, Params } from './params'
import { snapValue } from './params'
import type { Rng } from './prng'
import { MAX_SEED } from './prng'
import { randomPalette } from './palettes'
import type { PatternState } from './state'

/** 정의 범위 안에서 무작위 값 하나. range는 step 격자 위, select는 옵션 중 하나, toggle은 참/거짓 */
export function randomParamValue(def: ParamDef, rng: Rng): ParamValue {
  if (def.type === 'range') {
    const steps = Math.round((def.max - def.min) / def.step)
    return snapValue(def, def.min + rng.int(0, steps) * def.step)
  }
  if (def.type === 'select') return rng.pick(def.options).value
  return rng.next() < 0.5
}

/** 잠기지 않은 키만 무작위로 교체한다. rng는 defs 순서대로 소비한다 */
export function randomizeParams(defs: ParamDef[], params: Params, locked: readonly string[], rng: Rng): Params {
  const out: Params = { ...params }
  for (const def of defs) {
    if (!locked.includes(def.key)) out[def.key] = randomParamValue(def, rng)
  }
  return out
}

/** 스와치 하나. 0번은 배경형(아주 밝거나 어두움), 나머지는 전경형 */
export function randomSwatch(index: number, rng: Rng): string {
  const pair = randomPalette(2, () => rng.next())
  return index === 0 ? pair[0] : pair[1]
}

/** 길이는 그대로, 잠긴 인덱스는 유지하고 나머지를 새 팔레트로 교체 */
export function randomizePalette(palette: string[], locked: readonly number[], rng: Rng): string[] {
  const fresh = randomPalette(palette.length, () => rng.next())
  return palette.map((c, i) => (locked.includes(i) ? c : fresh[i]))
}

/** 전역 Randomize: 잠기지 않은 시드 → 매개변수 → 팔레트 순으로 교체. 생성기·잠금은 그대로 */
export function randomizeAll(state: PatternState, defs: ParamDef[], rng: Rng): PatternState {
  const seed = state.locks.seed ? state.seed : rng.int(0, MAX_SEED)
  const params = randomizeParams(defs, state.params, state.locks.params, rng)
  const palette = randomizePalette(state.palette, state.locks.palette, rng)
  return { ...state, seed, params, palette }
}
