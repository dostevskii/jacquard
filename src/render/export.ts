import type { Scene } from '../core/scene'
import type { TilePx } from './canvas'
import { renderFill, renderTile, tilePixelSize } from './canvas'

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

/** 설정대로 오프스크린 캔버스에 렌더한다. 크기 상한을 넘으면 DOM을 만들기 전에 throw */
export function renderForExport(scene: Scene, settings: ExportSettings): HTMLCanvasElement {
  const size = outputSize(scene, settings)
  if (exceedsLimit(size)) throw new Error(`Output size ${size.w} × ${size.h} exceeds the ${MAX_DIM}px limit`)
  const canvas = document.createElement('canvas')
  canvas.width = size.w
  canvas.height = size.h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2D canvas context is unavailable')
  if (settings.mode === 'tile') renderTile(scene, size, ctx)
  // renderFill이 false면 빈 캔버스가 그대로 인코딩되므로, 대화상자 오류 줄에 드러나도록 throw한다
  else if (!renderFill(scene, tilePixelSize(scene, settings.scale), ctx, size.w, size.h))
    throw new Error('Tile rendering failed')
  return canvas
}

export function canvasToBlob(canvas: HTMLCanvasElement, format: ExportFormat): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Encoding failed'))), mimeOf(format), 0.92)
  })
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function exportImage(scene: Scene, generator: string, seed: number, settings: ExportSettings): Promise<void> {
  const canvas = renderForExport(scene, settings)
  const blob = await canvasToBlob(canvas, settings.format)
  downloadBlob(blob, exportFilename(generator, seed, settings.format))
}
