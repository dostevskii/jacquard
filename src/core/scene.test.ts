import { describe, it, expect } from 'vitest'
import type { Shape } from './scene'
import {
  EPS, shapeBounds, polygonArea, clipPolygonToRect, clipShapeToRect,
  translateShape, reflectShape, tileWrap,
} from './scene'

const solid = (color = '#ff0000') => ({ type: 'solid' as const, color })
const rect = (x: number, y: number, w: number, h: number): Shape => ({ kind: 'rect', x, y, w, h, fill: solid() })
const rectArea = (s: Shape) => (s.kind === 'rect' ? s.w * s.h : Math.abs(polygonArea(s.points)))

describe('shapeBounds / polygonArea', () => {
  it('rect bounds', () => {
    expect(shapeBounds(rect(1, 2, 3, 4))).toEqual({ x0: 1, y0: 2, x1: 4, y1: 6 })
  })
  it('polygon bounds and area', () => {
    const tri: Shape = { kind: 'polygon', points: [0, 0, 4, 0, 0, 3], fill: solid() }
    expect(shapeBounds(tri)).toEqual({ x0: 0, y0: 0, x1: 4, y1: 3 })
    expect(Math.abs(polygonArea(tri.points))).toBeCloseTo(6)
  })
})

describe('clipPolygonToRect', () => {
  it('keeps a polygon fully inside', () => {
    const out = clipPolygonToRect([1, 1, 3, 1, 2, 3], 0, 0, 10, 10)!
    expect(Math.abs(polygonArea(out))).toBeCloseTo(2)
  })
  it('clips a triangle crossing the right edge', () => {
    const out = clipPolygonToRect([8, 0, 12, 0, 8, 4], 0, 0, 10, 10)!
    for (let i = 0; i < out.length; i += 2) {
      expect(out[i]).toBeGreaterThanOrEqual(-EPS)
      expect(out[i]).toBeLessThanOrEqual(10 + EPS)
    }
    // 원래 면적 8 중 x>10 부분(삼각형 면적 2)이 잘려 6이 남는다
    expect(Math.abs(polygonArea(out))).toBeCloseTo(6)
  })
  it('returns null when fully outside', () => {
    expect(clipPolygonToRect([20, 20, 30, 20, 20, 30], 0, 0, 10, 10)).toBeNull()
  })
})

describe('clipShapeToRect', () => {
  it('intersects rects', () => {
    expect(clipShapeToRect(rect(90, 5, 20, 10), 0, 0, 100, 100)).toEqual(rect(90, 5, 10, 10))
    expect(clipShapeToRect(rect(120, 5, 20, 10), 0, 0, 100, 100)).toBeNull()
  })
})

describe('translateShape / reflectShape', () => {
  it('translates rect and its gradient', () => {
    const s: Shape = {
      kind: 'rect', x: 0, y: 0, w: 10, h: 10,
      fill: { type: 'linear', x1: 0, y1: 0, x2: 0, y2: 10, stops: [{ offset: 0, color: '#000000' }, { offset: 1, color: '#ffffff' }] },
    }
    const t = translateShape(s, 5, -3)
    expect(t.kind === 'rect' && t.x).toBe(5)
    expect(t.kind === 'rect' && t.y).toBe(-3)
    expect(t.fill.type === 'linear' && t.fill.y1).toBe(-3)
    expect(t.fill.type === 'linear' && t.fill.y2).toBe(7)
  })
  it('reflects rect across x within width', () => {
    const r = reflectShape(rect(10, 0, 20, 5), 'x', 100)
    expect(r).toEqual(rect(70, 0, 20, 5))
  })
  it('reflects polygon and gradient across y', () => {
    const s: Shape = {
      kind: 'polygon', points: [0, 0, 10, 0, 0, 10],
      fill: { type: 'linear', x1: 0, y1: 0, x2: 0, y2: 10, stops: [] },
    }
    const r = reflectShape(s, 'y', 100)
    expect(r.kind === 'polygon' && r.points).toEqual([0, 100, 10, 100, 0, 90])
    expect(r.fill.type === 'linear' && r.fill.y1).toBe(100)
    expect(r.fill.type === 'linear' && r.fill.y2).toBe(90)
  })
})

describe('tileWrap', () => {
  it('leaves an inside shape untouched', () => {
    const s = rect(10, 10, 20, 20)
    expect(tileWrap([s], 100, 100)).toEqual([s])
  })
  it('splits a shape crossing the right edge into two pieces with the same total area', () => {
    const out = tileWrap([rect(90, 10, 20, 10)], 100, 100)
    expect(out).toHaveLength(2)
    const total = out.reduce((a, s) => a + rectArea(s), 0)
    expect(total).toBeCloseTo(200)
    for (const s of out) {
      const b = shapeBounds(s)
      expect(b.x0).toBeGreaterThanOrEqual(-EPS)
      expect(b.x1).toBeLessThanOrEqual(100 + EPS)
    }
    expect(out.some(s => s.kind === 'rect' && s.x === 0 && s.w === 10)).toBe(true)
  })
  it('splits a corner shape into four pieces', () => {
    const out = tileWrap([rect(95, 95, 10, 10)], 100, 100)
    expect(out).toHaveLength(4)
    expect(out.reduce((a, s) => a + rectArea(s), 0)).toBeCloseTo(100)
  })
  it('moves gradient coordinates with the wrapped piece', () => {
    const s: Shape = {
      kind: 'rect', x: 90, y: 0, w: 20, h: 10,
      fill: { type: 'linear', x1: 90, y1: 0, x2: 110, y2: 0, stops: [] },
    }
    const out = tileWrap([s], 100, 100)
    const wrapped = out.find(p => p.kind === 'rect' && p.x === 0)!
    expect(wrapped.fill.type === 'linear' && wrapped.fill.x1).toBe(-10)
    expect(wrapped.fill.type === 'linear' && wrapped.fill.x2).toBe(10)
  })
  it('wraps polygons too', () => {
    const tri: Shape = { kind: 'polygon', points: [95, 0, 105, 0, 100, 10], fill: solid() }
    const out = tileWrap([tri], 100, 100)
    expect(out).toHaveLength(2)
    expect(out.reduce((a, s) => a + rectArea(s), 0)).toBeCloseTo(50)
  })
})
