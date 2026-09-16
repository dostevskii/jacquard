import type { Rng } from '../core/prng'
import type { Shape } from '../core/scene'

/** 전경색 i번째 (palette[1..] 순환, 음수도 안전) */
export function fg(palette: string[], i: number): string {
  const n = palette.length - 1
  if (n <= 0) return palette[0]
  return palette[1 + (((i % n) + n) % n)]
}

/** rng로 전경색 인덱스를 고른다. avoidIndex가 주어지고 색이 2개 이상이면 그 인덱스를 뺀 나머지에서 균등하게 뽑는다 */
export function pickFg(palette: string[], rng: Rng, avoidIndex?: number): number {
  const n = palette.length - 1
  if (n <= 1) return 0
  if (avoidIndex === undefined || avoidIndex < 0 || avoidIndex >= n) return rng.int(0, n - 1)
  let i = rng.int(0, n - 2)
  if (i >= avoidIndex) i++
  return i
}

export function rect(x: number, y: number, w: number, h: number, color: string): Shape {
  return { kind: 'rect', x, y, w, h, fill: { type: 'solid', color } }
}

export function poly(points: number[], color: string): Shape {
  return { kind: 'polygon', points, fill: { type: 'solid', color } }
}
