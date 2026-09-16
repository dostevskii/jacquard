import type { Scene } from '../core/scene'
import type { TilePx } from './canvas'
import { tilePixelSize } from './canvas'

export type ExportFormat = 'png' | 'jpg'
export type ExportMode = 'tile' | 'canvas'

export interface ExportSettings {
  format: ExportFormat
  mode: ExportMode
  /** tile 모드: px per unit. canvas 모드: 채우기에 쓰는 타일 배율 */
  scale: number
  width: number
  height: number
}

export const MAX_DIM = 8192

export const SIZE_PRESETS: { label: string; w: number; h: number }[] = [
  { label: '1080 × 1080', w: 1080, h: 1080 },
  { label: '1920 × 1080', w: 1920, h: 1080 },
  { label: '1080 × 1920', w: 1080, h: 1920 },
  { label: 'A4 300dpi (2480 × 3508)', w: 2480, h: 3508 },
  { label: 'A3 300dpi (3508 × 4961)', w: 3508, h: 4961 },
]

export function outputSize(scene: Scene, s: ExportSettings): TilePx {
  if (s.mode === 'tile') return tilePixelSize(scene, s.scale)
  return { w: Math.round(s.width), h: Math.round(s.height) }
}

export function exceedsLimit(size: TilePx): boolean {
  return size.w > MAX_DIM || size.h > MAX_DIM || size.w < 1 || size.h < 1
}

export function exportFilename(generator: string, seed: number, format: ExportFormat): string {
  return `jacquard-${generator}-${seed}.${format}`
}

export function mimeOf(format: ExportFormat): string {
  return format === 'png' ? 'image/png' : 'image/jpeg'
}
