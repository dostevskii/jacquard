import { describe, it, expect } from 'vitest'
import { shapeBounds } from '../core/scene'
import { run } from './testUtils'

describe('gradientBars', () => {
  it('tile size follows direction', () => {
    expect(run('gradientBars', { columns: 4, barWidth: 50, length: 300, direction: 'vertical' })).toMatchObject({ width: 200, height: 300 })
    expect(run('gradientBars', { columns: 4, barWidth: 50, length: 300, direction: 'horizontal' })).toMatchObject({ width: 300, height: 200 })
  })

  it('every fill is a linear gradient along the bar axis', () => {
    const v = run('gradientBars', { direction: 'vertical' })
    for (const sh of v.shapes) {
      expect(sh.fill.type).toBe('linear')
      if (sh.fill.type === 'linear') expect(sh.fill.x1).toBe(sh.fill.x2)
    }
    const h = run('gradientBars', { direction: 'horizontal' })
    for (const sh of h.shapes) if (sh.fill.type === 'linear') expect(sh.fill.y1).toBe(sh.fill.y2)
  })

  it('stagger shifts odd columns and wraps them', () => {
    const s = run('gradientBars', { columns: 2, barWidth: 50, length: 100, bands: 2, stagger: 0.5, step: 0, mirrorX: false, mirrorY: false })
    const ys = (x: number) =>
      s.shapes.filter((sh) => sh.kind === 'rect' && sh.x === x).map((sh) => (sh.kind === 'rect' ? sh.y : -1)).sort((a, b) => a - b)
    expect(ys(0)).toEqual([0, 50])
    expect(ys(50)).toEqual([0, 25, 75])
  })

  it('symmetric shape has three stops A-B-A', () => {
    const s = run('gradientBars', { shape: 'symmetric', colorMode: 'pairs' })
    const f = s.shapes[0].fill
    expect(f.type).toBe('linear')
    if (f.type === 'linear') {
      expect(f.stops).toHaveLength(3)
      expect(f.stops[0].color).toBe(f.stops[2].color)
      expect(f.stops[1].color).not.toBe(f.stops[0].color)
    }
  })

  it('mirrorX makes the tile left-right symmetric', () => {
    const s = run('gradientBars', { columns: 6, barWidth: 50, length: 200, bands: 1, mirrorX: true, mirrorY: false })
    const key = (a: number, b: number, c: number, d: number) => [a, b, c, d].map((v) => v.toFixed(6)).join(',')
    const set = new Set(s.shapes.map((sh) => { const b = shapeBounds(sh); return key(b.x0, b.x1, b.y0, b.y1) }))
    for (const sh of s.shapes) {
      const b = shapeBounds(sh)
      expect(set.has(key(s.width - b.x1, s.width - b.x0, b.y0, b.y1))).toBe(true)
    }
  })

  it('covers the tile exactly', () => {
    const s = run('gradientBars')
    const area = s.shapes.reduce((a, sh) => a + (sh.kind === 'rect' ? sh.w * sh.h : 0), 0)
    expect(area).toBeCloseTo(s.width * s.height)
  })
})
