import { useRef } from 'react'
import type { PointerEvent } from 'react'
import type { Hsv } from '../core/color'
import { hsFromPointer, markerPosition } from './colorMath'

interface Props {
  hsv: Hsv
  onChange(hsv: Hsv): void
  size?: number
}

export function ColorWheel({ hsv, onChange, size = 200 }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const radius = size / 2

  const update = (e: PointerEvent<HTMLDivElement>) => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const { h, s } = hsFromPointer(
      e.clientX - (rect.left + rect.width / 2),
      e.clientY - (rect.top + rect.height / 2),
      rect.width / 2,
    )
    onChange({ h, s, v: hsv.v })
  }

  const marker = markerPosition(hsv, radius)
  return (
    <div
      className="wheel"
      ref={ref}
      style={{ width: size, height: size }}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        update(e)
      }}
      onPointerMove={(e) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) update(e)
      }}
      onPointerUp={(e) => e.currentTarget.releasePointerCapture(e.pointerId)}
    >
      <div className="wheel-layer wheel-hue" />
      <div className="wheel-layer wheel-sat" />
      <div className="wheel-layer wheel-dim" style={{ opacity: 1 - hsv.v / 100 }} />
      <div className="wheel-marker" style={{ left: marker.x, top: marker.y }} />
    </div>
  )
}
