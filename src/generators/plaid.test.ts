import { describe, it, expect } from 'vitest'
import { run, PALETTE8, colorsOf } from './testUtils'

describe('plaid', () => {
  it('tile is square when sameSett is on and is a multiple of cell', () => {
    const s = run('plaid', { cell: 10, sameSett: true })
    expect(s.width).toBe(s.height)
    expect(s.width % 10).toBe(0)
  })

  it('symmetric sett mirrors around the pivot stripe (cyclic palindrome)', () => {
    const n = 4
    const s = run('plaid', { cell: 10, sett: n, symmetric: true, blend: 'mix', sameSett: true })
    // 첫 weft 줄(y === 0)의 rect 폭 순서 = warp 세트 순서
    const widths = s.shapes
      .filter((sh) => sh.kind === 'rect' && sh.y === 0)
      .map((sh) => (sh.kind === 'rect' ? sh.w : 0))
    expect(widths).toHaveLength(2 * n - 2)
    for (let k = 1; k <= n - 2; k++) expect(widths[n - 1 - k]).toBe(widths[n - 1 + k])
  })

  it('non-symmetric sett has exactly sett stripes', () => {
    const s = run('plaid', { cell: 10, sett: 5, symmetric: false, blend: 'mix', sameSett: true })
    const row0 = s.shapes.filter((sh) => sh.kind === 'rect' && sh.y === 0)
    expect(row0).toHaveLength(5)
  })

  it('weave and alternate modes only use palette colors; mix mode blends', () => {
    for (const c of colorsOf(run('plaid', { blend: 'weave' }))) expect(PALETTE8).toContain(c)
    for (const c of colorsOf(run('plaid', { blend: 'alternate' }))) expect(PALETTE8).toContain(c)
    expect(colorsOf(run('plaid', { blend: 'mix' })).some((c) => !PALETTE8.includes(c))).toBe(true)
  })

  it('covers the tile exactly in every blend mode', () => {
    for (const blend of ['mix', 'weave', 'alternate']) {
      const s = run('plaid', { blend })
      const area = s.shapes.reduce((a, sh) => a + (sh.kind === 'rect' ? sh.w * sh.h : 0), 0)
      expect(area).toBeCloseTo(s.width * s.height)
    }
  })
})
