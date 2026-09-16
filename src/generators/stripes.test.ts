import { describe, it, expect } from 'vitest'
import { run, PALETTE8 } from './testUtils'

describe('stripes', () => {
  it('tile size follows columns × segmentLength × cell and rows × (bandHeight + separator) × cell', () => {
    const s = run('stripes', { cell: 10, segmentLength: 4, columns: 3, rows: 4, bandHeight: 2, separator: 1 })
    expect(s.width).toBe(120)
    expect(s.height).toBe(120)
  })
  it('odd rows are shifted by offset × segment length and wrap', () => {
    const s = run('stripes', { cell: 10, segmentLength: 4, columns: 2, rows: 2, bandHeight: 2, separator: 0, offset: 0.5 })
    // 행 0: x = 0, 40  / 행 1: x = 20, 60 → 60+40 = 100 > 80 이므로 [60,80] + [0,20] 두 조각으로 감긴다
    const row1 = s.shapes.filter((sh) => sh.kind === 'rect' && sh.y === 20)
    const xs = row1.map((sh) => (sh.kind === 'rect' ? sh.x : -1)).sort((a, b) => a - b)
    expect(xs).toEqual([0, 20, 60])
  })
  it('alternate mode uses two foreground colors and flips them on odd rows', () => {
    const s = run('stripes', { colorMode: 'alternate', columns: 2, rows: 2, offset: 0 })
    const rowColors = (y: number) =>
      s.shapes.filter((sh) => sh.kind === 'rect' && sh.y === y).sort((a, b) => (a.kind === 'rect' && b.kind === 'rect' ? a.x - b.x : 0))
        .map((sh) => (sh.fill.type === 'solid' ? sh.fill.color : ''))
    const bandH = 3 * 16, sep = 1 * 16
    expect(rowColors(0)).toEqual([PALETTE8[1], PALETTE8[2]])
    expect(rowColors(bandH + sep)).toEqual([PALETTE8[2], PALETTE8[1]])
  })
  it('sequence mode cycles foreground colors', () => {
    const s = run('stripes', { colorMode: 'sequence', columns: 3, rows: 2 })
    const colors = s.shapes.map((sh) => (sh.fill.type === 'solid' ? sh.fill.color : ''))
    expect(colors[0]).toBe(PALETTE8[1])
    expect(colors[1]).toBe(PALETTE8[2])
    expect(colors[2]).toBe(PALETTE8[3])
  })
})
