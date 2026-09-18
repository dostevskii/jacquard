import type { ParamDef, Params } from '../core/params'

/** RGBA 픽셀 버퍼. ImageData가 이 형태를 만족한다 */
export interface RasterImage {
  width: number
  height: number
  data: Uint8ClampedArray
}

export interface EffectContext {
  /** 타일 unit → px 배율 (tilePx.w / scene.width) */
  pxPerUnit: number
  seed: number
  palette: string[]
}

export interface EffectDef {
  id: string
  name: string
  /** 첫 항목은 항상 enabledParam() */
  params: ParamDef[]
  /** 제자리(in-place) 수정. 알파는 255 유지 */
  apply(img: RasterImage, params: Params, ctx: EffectContext): void
}

export function enabledParam(): ParamDef {
  return { type: 'toggle', key: 'enabled', label: 'Enabled', default: false }
}
