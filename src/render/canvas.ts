import type { Paint, Scene } from '../core/scene'

export interface TilePx { w: number; h: number }

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
export function renderTile(scene: Scene, tilePx: TilePx, ctx: CanvasRenderingContext2D): void {
  const sx = tilePx.w / scene.width
  const sy = tilePx.h / scene.height
  ctx.save()
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
}

/** 타일을 오프스크린에 그린 뒤 반복 패턴으로 origin에서 시작하는 w × h 영역을 채운다 */
export function renderFill(
  scene: Scene,
  tilePx: TilePx,
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  origin: { x: number; y: number } = { x: 0, y: 0 },
): void {
  const tile = document.createElement('canvas')
  tile.width = tilePx.w
  tile.height = tilePx.h
  const tctx = tile.getContext('2d')
  if (!tctx) return
  renderTile(scene, tilePx, tctx)
  const pattern = ctx.createPattern(tile, 'repeat')
  if (!pattern) return
  ctx.save()
  ctx.translate(origin.x, origin.y)
  ctx.fillStyle = pattern
  ctx.fillRect(0, 0, w, h)
  ctx.restore()
}
