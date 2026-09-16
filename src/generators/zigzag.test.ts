import { describe, it, expect } from 'vitest'
import { run, PALETTE8 } from './testUtils'

describe('zigzag', () => {
  it('tile size = wavelength × cell by bands × bandHeight × cell', () => {
    const s = run('zigzag', { cell: 5, wavelength: 12, bands: 4, bandHeight: 3 })
    expect(s.width).toBe(60)
    expect(s.height).toBe(60)
  })

  it('with zero amplitude every column is plain horizontal bands', () => {
    const s = run('zigzag', { cell: 5, wavelength: 8, bands: 3, bandHeight: 2, amplitude: 0 })
    expect(s.shapes).toHaveLength(8 * 3)
    const col0 = s.shapes.filter((sh) => sh.kind === 'rect' && sh.x === 0)
    expect(col0.map((sh) => (sh.kind === 'rect' ? sh.y : -1)).sort((a, b) => a - b)).toEqual([0, 10, 20])
  })

  it('the peak column is shifted by the amplitude', () => {
    const s = run('zigzag', { cell: 5, wavelength: 8, bands: 3, bandHeight: 2, amplitude: 2, colorMode: 'sequence' })
    const colorAt = (x: number, y: number) => {
      const r = s.shapes.find((sh) => sh.kind === 'rect' && sh.x === x && y >= sh.y && y < sh.y + sh.h)
      return r && r.fill.type === 'solid' ? r.fill.color : null
    }
    // x=0 열의 맨 위는 띠 0. 반 파장(x=4셀=20px)에서 오프셋 2 = 띠 두께이므로 띠 1이 맨 위
    expect(colorAt(0, 0)).toBe(PALETTE8[1])
    expect(colorAt(20, 0)).toBe(PALETTE8[2])
  })

  it('covers the tile exactly', () => {
    const s = run('zigzag')
    const area = s.shapes.reduce((a, sh) => a + (sh.kind === 'rect' ? sh.w * sh.h : 0), 0)
    expect(area).toBeCloseTo(s.width * s.height)
  })
})
