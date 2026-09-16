import { useEffect, useRef } from 'react'
import type { Scene } from '../core/scene'
import { renderFill, tilePixelSize } from '../render/canvas'
import { MAX_DIM } from '../render/export'
import type { Theme } from './theme'

export type ViewMode = 'fill' | 'tile' | 'grid3'

interface Props {
  scene: Scene
  view: ViewMode
  scale: number
  onViewChange(v: ViewMode): void
  onScaleChange(s: number): void
  theme: Theme
}

const VIEWS: { id: ViewMode; label: string }[] = [
  { id: 'fill', label: 'Fill' },
  { id: 'tile', label: 'Tile' },
  { id: 'grid3', label: '3 × 3' },
]

export function Preview({ scene, view, scale, onViewChange, onScaleChange, theme }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return
    let raf = 0
    const draw = () => {
      canvas.dataset.theme = theme
      const dpr = window.devicePixelRatio || 1
      const cw = wrap.clientWidth
      const ch = wrap.clientHeight
      if (cw === 0 || ch === 0) return
      canvas.width = Math.round(cw * dpr)
      canvas.height = Math.round(ch * dpr)
      canvas.style.width = `${cw}px`
      canvas.style.height = `${ch}px`
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      const css = getComputedStyle(document.documentElement)
      const canvasBg = css.getPropertyValue('--canvas-bg').trim() || '#0c0c0c'
      const mutedColor = css.getPropertyValue('--muted').trim() || '#9a9a9a'
      const gridLine = css.getPropertyValue('--grid-line').trim() || 'rgba(255,255,255,0.75)'
      ctx.fillStyle = canvasBg
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      const unavailable = () => {
        ctx.save()
        ctx.fillStyle = mutedColor
        ctx.font = `${14 * dpr}px system-ui`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('Preview unavailable — tile too large for this browser', canvas.width / 2, canvas.height / 2)
        ctx.restore()
      }
      // 타일 한 변이 브라우저 캔버스 한계를 넘지 않도록 배율을 낮춘다
      const maxScale = Math.min(MAX_DIM / scene.width, MAX_DIM / scene.height)
      const eff = Math.min(scale * dpr, maxScale)
      const tilePx = tilePixelSize(scene, eff)
      if (view === 'fill') {
        if (!renderFill(scene, tilePx, ctx, canvas.width, canvas.height)) unavailable()
        return
      }
      const n = view === 'tile' ? 1 : 3
      const totalW = tilePx.w * n
      const totalH = tilePx.h * n
      const ox = Math.round((canvas.width - totalW) / 2)
      const oy = Math.round((canvas.height - totalH) / 2)
      if (!renderFill(scene, tilePx, ctx, totalW, totalH, { x: ox, y: oy })) {
        unavailable()
        return
      }
      if (n === 3) {
        ctx.save()
        ctx.strokeStyle = gridLine
        ctx.setLineDash([4 * dpr, 4 * dpr])
        ctx.lineWidth = dpr
        for (let i = 1; i < 3; i++) {
          ctx.beginPath()
          ctx.moveTo(ox + i * tilePx.w + 0.5, oy)
          ctx.lineTo(ox + i * tilePx.w + 0.5, oy + totalH)
          ctx.stroke()
          ctx.beginPath()
          ctx.moveTo(ox, oy + i * tilePx.h + 0.5)
          ctx.lineTo(ox + totalW, oy + i * tilePx.h + 0.5)
          ctx.stroke()
        }
        ctx.restore()
      }
    }
    // rAF 한 프레임 뒤에 그리므로 App의 applyTheme 효과가 먼저 반영된 뒤 CSS 변수를 읽는다 — 동기 호출로 바꾸지 말 것
    const schedule = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(draw)
    }
    schedule()
    const ro = new ResizeObserver(schedule)
    ro.observe(wrap)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [scene, view, scale, theme])

  return (
    <main className="preview">
      <div className="preview-toolbar">
        <div className="segmented">
          {VIEWS.map((v) => (
            <button key={v.id} type="button" className={v.id === view ? 'on' : ''} onClick={() => onViewChange(v.id)}>
              {v.label}
            </button>
          ))}
        </div>
        <label className="scale">
          Scale
          <input type="range" min={0.25} max={4} step={0.25} value={scale} onChange={(e) => onScaleChange(Number(e.target.value))} />
          <span className="mono">{scale.toFixed(2)}×</span>
        </label>
      </div>
      <div className="canvas-wrap" ref={wrapRef}>
        <canvas ref={canvasRef} />
      </div>
    </main>
  )
}
