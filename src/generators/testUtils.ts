import type { Params } from '../core/params'
import { defaultParams } from '../core/params'
import type { Scene } from '../core/scene'
import { mulberry32 } from '../core/prng'
import { getGenerator } from './index'

export const PALETTE8 = ['#111111', '#e63b2e', '#f2a91e', '#6aa9dc', '#1f7a4d', '#e8459a', '#f2f2f2', '#7a1a1a']

/** 생성기를 기본값 + overrides로 실행한다 */
export function run(id: string, overrides: Params = {}, palette: string[] = PALETTE8, seed = 1): Scene {
  const g = getGenerator(id)
  if (!g) throw new Error(`unknown generator ${id}`)
  return g.generate({ params: { ...defaultParams(g.params), ...overrides }, palette, rng: mulberry32(seed) })
}

/** Scene에 쓰인 모든 색(solid 색과 linear 정지점 색) */
export function colorsOf(scene: Scene): string[] {
  const out: string[] = []
  for (const s of scene.shapes) {
    if (s.fill.type === 'solid') out.push(s.fill.color)
    else for (const st of s.fill.stops) out.push(st.color)
  }
  return out
}
