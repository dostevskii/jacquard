import { describe, it, expect } from 'vitest'
import { run, PALETTE8, colorsOf } from './testUtils'

describe('rings', () => {
  it('tile is cols × rows cells with one rect per cell', () => {
    const s = run('rings', { cell: 10, cols: 8, rows: 6 })
    expect(s.width).toBe(80)
    expect(s.height).toBe(60)
    expect(s.shapes).toHaveLength(48)
  })

  it('grout shrinks each cell on all sides', () => {
    const s = run('rings', { cell: 10, grout: 2 })
    for (const sh of s.shapes) {
      expect(sh.kind === 'rect' && sh.w).toBe(8)
      expect(sh.kind === 'rect' && sh.h).toBe(8)
      expect(sh.kind === 'rect' && (sh.x - 1) % 10).toBe(0)
    }
  })

  it('the outer ring is one color all the way around', () => {
    const cell = 10, cols = 10, rows = 8
    const s = run('rings', { cell, cols, rows, grout: 0 })
    const at = (i: number, j: number) => {
      const r = s.shapes.find((sh) => sh.kind === 'rect' && Math.round(sh.x / cell) === i && Math.round(sh.y / cell) === j)
      return r && r.fill.type === 'solid' ? r.fill.color : ''
    }
    const c = at(0, 0)
    expect(PALETTE8.slice(1)).toContain(c)
    for (let i = 0; i < cols; i++) {
      expect(at(i, 0)).toBe(c)
      expect(at(i, rows - 1)).toBe(c)
    }
    for (let j = 0; j < rows; j++) {
      expect(at(0, j)).toBe(c)
      expect(at(cols - 1, j)).toBe(c)
    }
  })

  it('every center mode only uses palette colors', () => {
    for (const center of ['solid', 'checker', 'stripes']) {
      for (const c of colorsOf(run('rings', { center }))) expect(PALETTE8).toContain(c)
    }
  })
})
