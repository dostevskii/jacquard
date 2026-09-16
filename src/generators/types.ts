import type { Rng } from '../core/prng'
import type { Scene } from '../core/scene'
import type { ParamDef, Params } from '../core/params'

export interface GenContext {
  params: Params
  /** palette[0]은 배경, palette[1..]은 전경 */
  palette: string[]
  rng: Rng
}

export interface GeneratorDef {
  id: string
  name: string
  family: 'grid' | 'gradient' | 'tessellation'
  /** 배경 포함 최소 팔레트 길이 */
  minColors: number
  params: ParamDef[]
  generate(ctx: GenContext): Scene
}
