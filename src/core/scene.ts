export const EPS = 1e-6

export type Paint =
  | { type: 'solid'; color: string }
  | {
      type: 'linear'
      x1: number
      y1: number
      x2: number
      y2: number
      stops: { offset: number; color: string }[]
    }

export type Shape =
  | { kind: 'rect'; x: number; y: number; w: number; h: number; fill: Paint }
  | { kind: 'polygon'; points: number[]; fill: Paint }

export interface Scene {
  width: number
  height: number
  background: string
  shapes: Shape[]
}

export interface Bounds { x0: number; y0: number; x1: number; y1: number }

export function shapeBounds(s: Shape): Bounds {
  if (s.kind === 'rect') return { x0: s.x, y0: s.y, x1: s.x + s.w, y1: s.y + s.h }
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (let i = 0; i < s.points.length; i += 2) {
    const x = s.points[i], y = s.points[i + 1]
    if (x < x0) x0 = x
    if (x > x1) x1 = x
    if (y < y0) y0 = y
    if (y > y1) y1 = y
  }
  return { x0, y0, x1, y1 }
}

export function polygonArea(points: number[]): number {
  let a = 0
  const n = points.length / 2
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    a += points[2 * i] * points[2 * j + 1] - points[2 * j] * points[2 * i + 1]
  }
  return a / 2
}

type Inside = (x: number, y: number) => boolean
type Intersect = (ax: number, ay: number, bx: number, by: number) => [number, number]

function clipEdge(pts: number[], inside: Inside, intersect: Intersect): number[] {
  const out: number[] = []
  const n = pts.length / 2
  for (let i = 0; i < n; i++) {
    const ax = pts[2 * i], ay = pts[2 * i + 1]
    const j = (i + 1) % n
    const bx = pts[2 * j], by = pts[2 * j + 1]
    const ain = inside(ax, ay), bin = inside(bx, by)
    if (ain) {
      out.push(ax, ay)
      if (!bin) out.push(...intersect(ax, ay, bx, by))
    } else if (bin) {
      out.push(...intersect(ax, ay, bx, by))
    }
  }
  return out
}

/** Sutherland–Hodgman: 다각형을 축 정렬 사각형으로 자른다. 결과가 비거나 면적이 0이면 null */
export function clipPolygonToRect(points: number[], x0: number, y0: number, x1: number, y1: number): number[] | null {
  let pts = points
  pts = clipEdge(pts, (x) => x >= x0 - EPS, (ax, ay, bx, by) => [x0, ay + ((by - ay) * (x0 - ax)) / (bx - ax)])
  if (pts.length < 6) return null
  pts = clipEdge(pts, (x) => x <= x1 + EPS, (ax, ay, bx, by) => [x1, ay + ((by - ay) * (x1 - ax)) / (bx - ax)])
  if (pts.length < 6) return null
  pts = clipEdge(pts, (_x, y) => y >= y0 - EPS, (ax, ay, bx, by) => [ax + ((bx - ax) * (y0 - ay)) / (by - ay), y0])
  if (pts.length < 6) return null
  pts = clipEdge(pts, (_x, y) => y <= y1 + EPS, (ax, ay, bx, by) => [ax + ((bx - ax) * (y1 - ay)) / (by - ay), y1])
  if (pts.length < 6) return null
  if (Math.abs(polygonArea(pts)) < EPS) return null
  return pts
}

export function clipShapeToRect(s: Shape, x0: number, y0: number, x1: number, y1: number): Shape | null {
  if (s.kind === 'rect') {
    const nx0 = Math.max(x0, s.x), ny0 = Math.max(y0, s.y)
    const nx1 = Math.min(x1, s.x + s.w), ny1 = Math.min(y1, s.y + s.h)
    if (nx1 - nx0 <= EPS || ny1 - ny0 <= EPS) return null
    return { ...s, x: nx0, y: ny0, w: nx1 - nx0, h: ny1 - ny0 }
  }
  const pts = clipPolygonToRect(s.points, x0, y0, x1, y1)
  return pts ? { ...s, points: pts } : null
}

function translatePaint(p: Paint, dx: number, dy: number): Paint {
  if (p.type === 'solid') return p
  return { ...p, x1: p.x1 + dx, y1: p.y1 + dy, x2: p.x2 + dx, y2: p.y2 + dy }
}

export function translateShape(s: Shape, dx: number, dy: number): Shape {
  if (s.kind === 'rect') return { ...s, x: s.x + dx, y: s.y + dy, fill: translatePaint(s.fill, dx, dy) }
  const points = s.points.map((v, i) => (i % 2 === 0 ? v + dx : v + dy))
  return { ...s, points, fill: translatePaint(s.fill, dx, dy) }
}

function reflectPaint(p: Paint, axis: 'x' | 'y', size: number): Paint {
  if (p.type === 'solid') return p
  return axis === 'x'
    ? { ...p, x1: size - p.x1, x2: size - p.x2 }
    : { ...p, y1: size - p.y1, y2: size - p.y2 }
}

export function reflectShape(s: Shape, axis: 'x' | 'y', size: number): Shape {
  const fill = reflectPaint(s.fill, axis, size)
  if (s.kind === 'rect') {
    return axis === 'x'
      ? { ...s, x: size - (s.x + s.w), fill }
      : { ...s, y: size - (s.y + s.h), fill }
  }
  const points = s.points.map((v, i) => {
    const isX = i % 2 === 0
    if (axis === 'x') return isX ? size - v : v
    return isX ? v : size - v
  })
  return { ...s, points, fill }
}

/**
 * 타일 경계를 넘는 도형을 반대편으로 감아 타일 안에서만 존재하도록 만든다.
 * 전제: 각 도형은 축별로 타일보다 크지 않아야 한다(w ≤ width, h ≤ height).
 * 더 큰 도형을 넣으면 같은 자리를 덮는 조각이 여러 개 나온다
 */
export function tileWrap(shapes: Shape[], width: number, height: number): Shape[] {
  const out: Shape[] = []
  for (const s of shapes) {
    const b = shapeBounds(s)
    if (b.x0 >= -EPS && b.y0 >= -EPS && b.x1 <= width + EPS && b.y1 <= height + EPS) {
      out.push(s)
      continue
    }
    for (const dx of [-width, 0, width]) {
      for (const dy of [-height, 0, height]) {
        const moved = dx === 0 && dy === 0 ? s : translateShape(s, dx, dy)
        const clipped = clipShapeToRect(moved, 0, 0, width, height)
        if (clipped) out.push(clipped)
      }
    }
  }
  return out
}
