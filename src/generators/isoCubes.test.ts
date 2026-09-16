import { describe, it, expect } from 'vitest'
import { polygonArea } from '../core/scene'
import { run, PALETTE8, colorsOf } from './testUtils'

const polyArea = (s: ReturnType<typeof run>) =>
  s.shapes.reduce((a, sh) => a + (sh.kind === 'polygon' ? Math.abs(polygonArea(sh.points)) : 0), 0)

describe('isoCubes', () => {
  it('tile size = cols × √3 × size by rows × 3 × size', () => {
    const s = run('isoCubes', { size: 40, cols: 2, rows: 1 })
    expect(s.width).toBeCloseTo(2 * Math.sqrt(3) * 40)
    expect(s.height).toBeCloseTo(120)
  })

  it('only polygons, three faces per cube before wrapping', () => {
    const s = run('isoCubes', { size: 40, cols: 2, rows: 1, gap: 0 })
    expect(s.shapes.every((sh) => sh.kind === 'polygon')).toBe(true)
    // 2열 × (1행 쌍 = 2행) = 4 큐브 × 3면 = 12개 이상 (경계에서 잘린 조각 포함)
    expect(s.shapes.length).toBeGreaterThanOrEqual(12)
  })

  it('polygons cover the tile exactly when gap is 0', () => {
    const s = run('isoCubes', { gap: 0 })
    expect(polyArea(s)).toBeCloseTo(s.width * s.height, 3)
  })

  it('gap leaves background showing', () => {
    const s = run('isoCubes', { gap: 4 })
    expect(polyArea(s)).toBeLessThan(s.width * s.height * 0.95)
  })

  it('without shuffle the three faces use palette[1..3]', () => {
    const s = run('isoCubes', { shuffle: false })
    expect(new Set(colorsOf(s))).toEqual(new Set([PALETTE8[1], PALETTE8[2], PALETTE8[3]]))
  })
})
