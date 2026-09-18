import type { Paint, Scene } from '../core/scene'
import type { EffectsState } from '../core/state'
import { applyEffects, hasEnabledEffects } from '../post'

export interface TilePx { w: number; h: number }

/** 효과가 켜진 미리보기 타일의 픽셀 상한 — 이보다 크면 작은 타일을 그려 확대한다 */
export const PREVIEW_EFFECT_PX_LIMIT = 4_000_000

/** 타일 1장에 적용할 후처리 설정. 없거나 켜진 효과가 없으면 픽셀 왕복을 건너뛴다 */
export interface PostOptions {
  effects: EffectsState
  seed: number
  palette: string[]
}

export function tilePixelSize(scene: Scene, scale: number): TilePx {
  return {
    w: Math.max(1, Math.round(scene.width * scale)),
    h: Math.max(1, Math.round(scene.height * scale)),
  }
}

function makePaint(ctx: CanvasRenderingContext2D, paint: Paint, sx: number, sy: number): string | CanvasGradient {
  if (paint.type === 'solid') return paint.color
  const g = ctx.createLinearGradient(paint.x1 * sx, paint.y1 * sy, paint.x2 * sx, paint.y2 * sy)
  for (const st of paint.stops) g.addColorStop(Math.min(1, Math.max(0, st.offset)), st.color)
  return g
}

/** 타일 1장을 (0,0)부터 tilePx 크기로 그린다. 배율은 축별로 정확히 tilePx / scene 크기 */
export function renderTile(scene: Scene, tilePx: TilePx, ctx: CanvasRenderingContext2D, post?: PostOptions): void {
  const sx = tilePx.w / scene.width
  const sy = tilePx.h / scene.height
  ctx.save()
  // 호출자가 남긴 파선 설정이 폴리곤 이음새 스트로크에 새어 들어오지 않게 한다
  ctx.setLineDash([])
  ctx.fillStyle = scene.background
  ctx.fillRect(0, 0, tilePx.w, tilePx.h)
  for (const s of scene.shapes) {
    const paint = makePaint(ctx, s.fill, sx, sy)
    ctx.fillStyle = paint
    if (s.kind === 'rect') {
      // 각 변을 장치 픽셀에 맞춰 이음새를 없앤다
      const x0 = Math.round(s.x * sx)
      const y0 = Math.round(s.y * sy)
      const x1 = Math.round((s.x + s.w) * sx)
      const y1 = Math.round((s.y + s.h) * sy)
      if (x1 > x0 && y1 > y0) ctx.fillRect(x0, y0, x1 - x0, y1 - y0)
    } else {
      ctx.beginPath()
      for (let i = 0; i < s.points.length; i += 2) {
        const px = s.points[i] * sx
        const py = s.points[i + 1] * sy
        if (i === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      ctx.closePath()
      ctx.fill()
      // 같은 페인트로 1px 스트로크를 덧그려 안티에일리어싱 틈을 가린다
      ctx.strokeStyle = paint
      ctx.lineWidth = 1
      ctx.lineJoin = 'miter'
      ctx.stroke()
    }
  }
  ctx.restore()
  // 효과는 타일이 반복되기 전 한 장에만 적용한다 — 미리보기와 두 내보내기 모드가 같은 픽셀을 낸다
  if (post && hasEnabledEffects(post.effects)) {
    const img = ctx.getImageData(0, 0, tilePx.w, tilePx.h)
    applyEffects(img, post.effects, { pxPerUnit: tilePx.w / scene.width, seed: post.seed, palette: post.palette })
    ctx.putImageData(img, 0, 0)
  }
}

/**
 * 타일을 오프스크린에 그린 뒤 반복 패턴으로 origin에서 시작하는 w × h 영역을 채운다.
 * 타일이 너무 커서 오프스크린 컨텍스트나 패턴을 만들지 못하면 아무것도 그리지 않고 false를 반환한다
 */
export function renderFill(
  scene: Scene,
  tilePx: TilePx,
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  origin: { x: number; y: number } = { x: 0, y: 0 },
  post?: PostOptions,
): boolean {
  const tile = document.createElement('canvas')
  tile.width = tilePx.w
  tile.height = tilePx.h
  // 효과가 켜져 있으면 getImageData 왕복이 있으므로 읽기 힌트를 준다
  const tctx = tile.getContext('2d', post && hasEnabledEffects(post.effects) ? { willReadFrequently: true } : undefined)
  if (!tctx) return false
  // 거대한 타일에서 getImageData가 실패하면 rAF 콜백을 터뜨리지 않고 "Preview unavailable"로 넘긴다
  try {
    renderTile(scene, tilePx, tctx, post)
  } catch {
    return false
  }
  const pattern = ctx.createPattern(tile, 'repeat')
  if (!pattern) return false
  ctx.save()
  ctx.translate(origin.x, origin.y)
  ctx.fillStyle = pattern
  ctx.fillRect(0, 0, w, h)
  ctx.restore()
  return true
}
