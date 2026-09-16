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

  it('non-symmetric sett has sett stripes, rounded up to an even count', () => {
    const s = run('plaid', { cell: 10, sett: 5, symmetric: false, blend: 'mix', sameSett: true })
    const row0 = s.shapes.filter((sh) => sh.kind === 'rect' && sh.y === 0)
    expect(row0).toHaveLength(6)
    const even = run('plaid', { cell: 10, sett: 6, symmetric: false, blend: 'mix', sameSett: true })
    expect(even.shapes.filter((sh) => sh.kind === 'rect' && sh.y === 0)).toHaveLength(6)
  })

  it('sett total is even so the weave checker is seamless', () => {
    for (let seed = 1; seed <= 60; seed++) {
      for (const symmetric of [true, false]) {
        const s = run('plaid', { cell: 4, symmetric, sameSett: false, blend: 'weave' }, PALETTE8, seed)
        expect((s.width / 4) % 2).toBe(0)
        expect((s.height / 4) % 2).toBe(0)
      }
    }
  })

  it('non-symmetric alternate crossings have an even count', () => {
    for (const sett of [3, 5, 7]) {
      const s = run('plaid', { cell: 10, sett, symmetric: false, blend: 'mix', sameSett: true })
      const row0 = s.shapes.filter((sh) => sh.kind === 'rect' && sh.y === 0)
      expect(row0.length % 2).toBe(0)
    }
  })

  it('non-symmetric setts do not repeat the first color on the last stripe', () => {
    const colorAt = (sh: { fill: { type: string; color?: string } }) => (sh.fill.type === 'solid' ? sh.fill.color : '')
    for (let seed = 1; seed <= 60; seed++) {
      const s = run('plaid', { cell: 10, sett: 4, symmetric: false, sameSett: true, blend: 'mix' }, PALETTE8, seed)
      const row0 = s.shapes.filter((sh) => sh.kind === 'rect' && sh.y === 0)
      // sameSett이라 weft[0] === warp[0]이고, 같은 색 교차는 섞지 않고 그대로 칠한다.
      // 마지막 줄도 첫 줄과 같은 색이면 값이 똑같아지므로, 다르면 이음새에서 줄이 붙지 않는다
      expect(colorAt(row0[0])).not.toBe(colorAt(row0[row0.length - 1]))
    }
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
