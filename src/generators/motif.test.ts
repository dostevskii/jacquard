import { describe, it, expect } from 'vitest'
import type { Scene } from '../core/scene'
import { run, PALETTE8 } from './testUtils'

/** 모티프 색 rect를 size × size 불리언 격자로 되돌린다 (spacing 0, bandRows 0, stagger false 전제) */
function motifGrid(size: number, cell: number, scene: Scene, color: string): boolean[][] {
  const g = Array.from({ length: size }, () => Array<boolean>(size).fill(false))
  for (const sh of scene.shapes) {
    if (sh.kind !== 'rect' || sh.fill.type !== 'solid' || sh.fill.color !== color) continue
    const x = Math.round(sh.x / cell)
    const y = Math.round(sh.y / cell)
    if (x < size && y < size) g[y][x] = true
  }
  return g
}

describe('motif', () => {
  it('tile size follows size, spacing, bandRows and stagger', () => {
    expect(run('motif', { cell: 10, size: 9, spacing: 2, bandRows: 3, stagger: false })).toMatchObject({ width: 110, height: 140 })
    expect(run('motif', { cell: 10, size: 9, spacing: 2, bandRows: 3, stagger: true })).toMatchObject({ width: 110, height: 280 })
  })

  it('quad symmetry mirrors horizontally and vertically', () => {
    const size = 11, cell = 10
    const s = run('motif', { cell, size, spacing: 0, bandRows: 0, stagger: false, symmetry: 'quad', density: 0.4 })
    const g = motifGrid(size, cell, s, PALETTE8[1])
    expect(g.flat().some(Boolean)).toBe(true)
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        expect(g[y][x]).toBe(g[y][size - 1 - x])
        expect(g[y][x]).toBe(g[size - 1 - y][x])
      }
    }
  })

  it('oct symmetry also mirrors across the diagonal', () => {
    const size = 9, cell = 10
    const s = run('motif', { cell, size, spacing: 0, bandRows: 0, stagger: false, symmetry: 'oct', density: 0.4 })
    const g = motifGrid(size, cell, s, PALETTE8[1])
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) expect(g[y][x]).toBe(g[x][y])
  })

  it('smoothing never removes filled cells', () => {
    const size = 11, cell = 10
    const base = motifGrid(size, cell, run('motif', { cell, size, spacing: 0, bandRows: 0, smooth: 0, density: 0.3 }), PALETTE8[1])
    const smoothed = motifGrid(size, cell, run('motif', { cell, size, spacing: 0, bandRows: 0, smooth: 2, density: 0.3 }), PALETTE8[1])
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (base[y][x]) expect(smoothed[y][x]).toBe(true)
  })

  it('band rows use two alternating colors across the full width', () => {
    const s = run('motif', { cell: 10, size: 7, spacing: 0, bandRows: 2, stagger: false })
    const band = s.shapes.filter((sh) => sh.kind === 'rect' && sh.y >= 70)
    expect(band).toHaveLength(7 * 2)
    const colors = new Set(band.map((sh) => (sh.fill.type === 'solid' ? sh.fill.color : '')))
    expect(colors).toEqual(new Set([PALETTE8[2], PALETTE8[3]]))
  })
})
