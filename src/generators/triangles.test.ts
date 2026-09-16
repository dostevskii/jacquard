import { describe, it, expect } from 'vitest'
import { polygonArea } from '../core/scene'
import { run, PALETTE8, colorsOf } from './testUtils'

const polyArea = (s: ReturnType<typeof run>) =>
  s.shapes.reduce((a, sh) => a + (sh.kind === 'polygon' ? Math.abs(polygonArea(sh.points)) : 0), 0)

describe('triangles', () => {
  it('tile size = cols × size by rows × √3/2 × size, swapped when vertical', () => {
    const h = run('triangles', { size: 40, cols: 4, rows: 2, orientation: 'horizontal' })
    expect(h.width).toBeCloseTo(160)
    expect(h.height).toBeCloseTo(2 * (Math.sqrt(3) / 2) * 40)
    const v = run('triangles', { size: 40, cols: 4, rows: 2, orientation: 'vertical' })
    expect(v.width).toBeCloseTo(h.height)
    expect(v.height).toBeCloseTo(h.width)
  })

  it('covers the tile exactly in both orientations', () => {
    for (const orientation of ['horizontal', 'vertical']) {
      const s = run('triangles', { orientation })
      expect(polyArea(s)).toBeCloseTo(s.width * s.height, 3)
    }
  })

  it('checker uses exactly two foreground colors', () => {
    expect(new Set(colorsOf(run('triangles', { rule: 'checker' })))).toEqual(new Set([PALETTE8[1], PALETTE8[2]]))
  })

  it('stripes colors by row', () => {
    expect(new Set(colorsOf(run('triangles', { rule: 'stripes', rows: 2 })))).toEqual(new Set([PALETTE8[1], PALETTE8[2]]))
    expect(new Set(colorsOf(run('triangles', { rule: 'stripes', rows: 4 }))).size).toBe(4)
  })

  it('rhombus gives each up/down pair one color', () => {
    const s = run('triangles', { rule: 'rhombus', cols: 3, rows: 2, size: 40 })
    expect(new Set(colorsOf(s)).size).toBeGreaterThanOrEqual(3)
  })
})
