import { describe, it, expect } from 'vitest'
import type { Scene } from '../core/scene'
import { outputSize, exceedsLimit, exportFilename, mimeOf, renderForExport, clampTileScale, MAX_DIM, SIZE_PRESETS } from './export'
import { tilePixelSize } from './canvas'

const scene: Scene = { width: 300, height: 200, background: '#000000', shapes: [] }

describe('tilePixelSize', () => {
  it('rounds to integers and never returns 0', () => {
    expect(tilePixelSize(scene, 1)).toEqual({ w: 300, h: 200 })
    expect(tilePixelSize(scene, 0.333)).toEqual({ w: 100, h: 67 })
    expect(tilePixelSize({ ...scene, width: 0.2, height: 0.2 }, 1)).toEqual({ w: 1, h: 1 })
  })
})

describe('outputSize / exceedsLimit', () => {
  it('tile mode uses scale, canvas mode uses width/height', () => {
    expect(outputSize(scene, { format: 'png', mode: 'tile', scale: 2, width: 0, height: 0 })).toEqual({ w: 600, h: 400 })
    expect(outputSize(scene, { format: 'png', mode: 'canvas', scale: 1, width: 1920.4, height: 1080 })).toEqual({ w: 1920, h: 1080 })
  })
  it('limits at MAX_DIM and rejects sizes below 1', () => {
    expect(exceedsLimit({ w: MAX_DIM, h: 10 })).toBe(false)
    expect(exceedsLimit({ w: MAX_DIM + 1, h: 10 })).toBe(true)
    expect(exceedsLimit({ w: 10, h: 0 })).toBe(true)
  })
  it('presets are within the limit', () => {
    expect(SIZE_PRESETS.length).toBeGreaterThanOrEqual(5)
    for (const p of SIZE_PRESETS) expect(exceedsLimit({ w: p.w, h: p.h })).toBe(false)
  })
})

describe('clampTileScale', () => {
  it('keeps small scales and clamps large ones to MAX_DIM per side', () => {
    const wide: Scene = { width: 12800, height: 800, background: '#000000', shapes: [] }
    expect(clampTileScale(scene, 2)).toBe(2)
    expect(clampTileScale(wide, 4)).toBeCloseTo(MAX_DIM / 12800)
    expect(Math.round(wide.width * clampTileScale(wide, 4))).toBe(MAX_DIM)
  })
})

describe('filename / mime', () => {
  it('formats the filename and mime type', () => {
    expect(exportFilename('stripes', 4242, 'png')).toBe('jacquard-stripes-4242.png')
    expect(exportFilename('isoCubes', 1, 'jpg')).toBe('jacquard-isoCubes-1.jpg')
    expect(mimeOf('png')).toBe('image/png')
    expect(mimeOf('jpg')).toBe('image/jpeg')
  })
})

describe('renderForExport (node: DOM 없음)', () => {
  it('throws before touching the DOM when the size exceeds the limit', () => {
    expect(() =>
      renderForExport(scene, { format: 'png', mode: 'canvas', scale: 1, width: MAX_DIM + 1, height: 100 }),
    ).toThrow(/8192/)
  })
  it('renderForExport still refuses oversized output when post options are given', () => {
    expect(() =>
      renderForExport(scene, { format: 'png', mode: 'tile', scale: 100, width: 0, height: 0 }, { effects: {}, seed: 1, palette: [] }),
    ).toThrow(/8192/)
  })
})
