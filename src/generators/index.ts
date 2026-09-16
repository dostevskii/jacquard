import type { Scene } from '../core/scene'
import type { PatternState } from '../core/state'
import { clampParams } from '../core/params'
import { ensurePaletteLength } from '../core/palettes'
import { mulberry32 } from '../core/prng'
import type { GeneratorDef } from './types'
import { stripes } from './stripes'
import { plaid } from './plaid'
import { zigzag } from './zigzag'
import { motif } from './motif'
import { rings } from './rings'
import { gradientBars } from './gradientBars'
import { isoCubes } from './isoCubes'

// 2부에서 생성기를 추가할 때 import와 이 배열에 한 줄씩 추가한다
export const GENERATORS: GeneratorDef[] = [stripes, plaid, zigzag, motif, rings, gradientBars, isoCubes]

export const DEFAULT_GENERATOR_ID = 'stripes'

export function getGenerator(id: string): GeneratorDef | undefined {
  return GENERATORS.find((g) => g.id === id)
}

/** 상태 하나로 Scene을 만든다. 매개변수는 정의에 맞춰 보정하고 팔레트는 minColors까지 채운다 */
export function generateScene(state: PatternState): Scene {
  const def = getGenerator(state.generator) ?? GENERATORS[0]
  return def.generate({
    params: clampParams(def.params, state.params),
    palette: ensurePaletteLength(state.palette, def.minColors),
    rng: mulberry32(state.seed),
  })
}
