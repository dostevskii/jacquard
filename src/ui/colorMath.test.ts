import { describe, it, expect } from 'vitest'
import { hsFromPointer, markerPosition, keepHue } from './colorMath'

describe('hsFromPointer', () => {
  it('maps top/right/bottom/left to hue 0/90/180/270', () => {
    expect(hsFromPointer(0, -100, 100).h).toBeCloseTo(0)
    expect(hsFromPointer(100, 0, 100).h).toBeCloseTo(90)
    expect(hsFromPointer(0, 100, 100).h).toBeCloseTo(180)
    expect(hsFromPointer(-100, 0, 100).h).toBeCloseTo(270)
  })
  it('saturation is the radius ratio, clamped to 100', () => {
    expect(hsFromPointer(0, -50, 100).s).toBeCloseTo(50)
    expect(hsFromPointer(0, -500, 100).s).toBe(100)
    expect(hsFromPointer(0, 0, 100).s).toBe(0)
  })
})

describe('markerPosition', () => {
  it('is the inverse of hsFromPointer', () => {
    const samples = [
      { h: 0, s: 100, v: 100 },
      { h: 90, s: 50, v: 50 },
      { h: 200, s: 75, v: 20 },
      { h: 359, s: 10, v: 90 },
    ]
    for (const hsv of samples) {
      const p = markerPosition(hsv, 100)
      const back = hsFromPointer(p.x - 100, p.y - 100, 100)
      expect(back.h).toBeCloseTo(hsv.h)
      expect(back.s).toBeCloseTo(hsv.s)
    }
  })
  it('hue 0 at full saturation sits at the top', () => {
    const p = markerPosition({ h: 0, s: 100, v: 100 }, 100)
    expect(p.x).toBeCloseTo(100)
    expect(p.y).toBeCloseTo(0)
  })
})

describe('keepHue', () => {
  it('keeps the previous hue for greys and black, otherwise takes the new hue', () => {
    expect(keepHue({ h: 0, s: 0, v: 50 }, { h: 200, s: 80, v: 80 }).h).toBe(200)
    expect(keepHue({ h: 0, s: 50, v: 0 }, { h: 200, s: 80, v: 80 }).h).toBe(200)
    expect(keepHue({ h: 30, s: 50, v: 50 }, { h: 200, s: 80, v: 80 }).h).toBe(30)
  })
})
