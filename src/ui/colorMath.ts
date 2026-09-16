import type { Hsv } from '../core/color'

/** 색상환 중심 기준 포인터 위치 → 색상(위쪽 0°, 시계 방향)과 채도(반지름 비율 0..100) */
export function hsFromPointer(dx: number, dy: number, radius: number): { h: number; s: number } {
  const r = radius > 0 ? Math.min(1, Math.hypot(dx, dy) / radius) : 0
  const deg = (Math.atan2(dy, dx) * 180) / Math.PI
  return { h: (deg + 90 + 360) % 360, s: r * 100 }
}

/** 색상환 위 마커 위치 (색상환 좌상단 기준 px) */
export function markerPosition(hsv: Hsv, radius: number): { x: number; y: number } {
  const rad = ((hsv.h - 90) * Math.PI) / 180
  const r = (hsv.s / 100) * radius
  return { x: radius + r * Math.cos(rad), y: radius + r * Math.sin(rad) }
}

/** 채도나 명도가 0이면 색상 정보가 사라지므로 이전 색상을 유지한다 */
export function keepHue(next: Hsv, prev: Hsv): Hsv {
  return next.s < 1e-6 || next.v < 1e-6 ? { ...next, h: prev.h } : next
}
