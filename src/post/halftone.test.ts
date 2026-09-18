import { describe, it, expect } from 'vitest'
import { halftone, inkAndPaper } from './halftone'
import { makeImage, px, CTX } from './testUtils'

const INK: [number, number, number] = [17, 17, 17]      // #111111
const PAPER: [number, number, number] = [242, 242, 242]  // #f2f2f2
const run = (fill: [number, number, number], mode = 'ink', cell = 8) => {
  const img = makeImage(32, 32, fill)
  halftone.apply(img, { enabled: true, cell, mode }, CTX)
  return img
}
const inkCount = (img: ReturnType<typeof makeImage>) => {
  let n = 0
  for (let i = 0; i < 32 * 32; i++) if (img.data[i * 4] === INK[0] && img.data[i * 4 + 1] === INK[1]) n++
  return n
}

describe('inkAndPaper', () => {
  it('picks the darkest and lightest palette colors', () => {
    expect(inkAndPaper(CTX.palette)).toEqual({ ink: INK, paper: PAPER })
    expect(inkAndPaper([])).toEqual({ ink: [0, 0, 0], paper: [255, 255, 255] })
  })
})

describe('halftone', () => {
  it('white becomes all paper, black becomes all ink', () => {
    const white = run([255, 255, 255])
    for (let i = 0; i < 32 * 32; i++) expect([white.data[i * 4], white.data[i * 4 + 1], white.data[i * 4 + 2]]).toEqual(PAPER)
    const black = run([0, 0, 0])
    expect(inkCount(black)).toBe(32 * 32)
  })
  it('ink coverage grows monotonically as the source gets darker', () => {
    const counts = [240, 200, 160, 120, 80, 40].map((v) => inkCount(run([v, v, v])))
    for (let i = 1; i < counts.length; i++) expect(counts[i]).toBeGreaterThan(counts[i - 1])
  })
  it('ink mode uses exactly two colors', () => {
    const img = run([120, 60, 200])
    const colors = new Set<string>()
    for (let i = 0; i < 32 * 32; i++) colors.add(`${img.data[i * 4]},${img.data[i * 4 + 1]},${img.data[i * 4 + 2]}`)
    expect(colors.size).toBe(2)
  })
  it('color mode paints dots in the cell average color on paper', () => {
    const img = run([200, 40, 40], 'color')
    const center = px(img, 4, 4)
    expect([center[0], center[1], center[2]]).toEqual([200, 40, 40])
    const corner = px(img, 0, 0)
    expect([corner[0], corner[1], corner[2]]).toEqual(PAPER)
  })
  it('aligns cells to the tile origin and handles partial cells', () => {
    const img = makeImage(20, 12, [0, 0, 0])
    halftone.apply(img, { enabled: true, cell: 8, mode: 'ink' }, CTX)
    expect(inkCount(img)).toBe(20 * 12)
    expect(img.data[3]).toBe(255)
  })
})
