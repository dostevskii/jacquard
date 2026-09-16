import { describe, it, expect } from 'vitest'
import { parseHex, toHex, rgbToHsl, hslToRgb, rgbToHsv, hsvToRgb, mix, clamp } from './color'

const SAMPLES = [
  '#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff', '#808080',
  '#e63b2e', '#f2a91e', '#6aa9dc', '#1e6fe6', '#7a1a1a', '#ffb3c1',
]

describe('parseHex / toHex', () => {
  it('accepts #rrggbb, rrggbb, #rgb, rgb', () => {
    expect(parseHex('#1e6fe6')).toEqual({ r: 30, g: 111, b: 230 })
    expect(parseHex('1e6fe6')).toEqual({ r: 30, g: 111, b: 230 })
    expect(parseHex('#abc')).toEqual({ r: 170, g: 187, b: 204 })
    expect(parseHex('ABC')).toEqual({ r: 170, g: 187, b: 204 })
    expect(parseHex('  #1E6FE6 ')).toEqual({ r: 30, g: 111, b: 230 })
  })
  it('rejects invalid input', () => {
    expect(parseHex('')).toBeNull()
    expect(parseHex('#12')).toBeNull()
    expect(parseHex('#12345')).toBeNull()
    expect(parseHex('#gggggg')).toBeNull()
    expect(parseHex('red')).toBeNull()
  })
  it('toHex rounds and pads', () => {
    expect(toHex({ r: 30, g: 111, b: 230 })).toBe('#1e6fe6')
    expect(toHex({ r: 0.4, g: 255, b: 7.6 })).toBe('#00ff08')
    expect(toHex({ r: -5, g: 300, b: 0 })).toBe('#00ff00')
  })
})

describe('round trips', () => {
  it('hex -> rgb -> hsl -> rgb -> hex', () => {
    for (const hex of SAMPLES) {
      const rgb = parseHex(hex)!
      expect(toHex(hslToRgb(rgbToHsl(rgb)))).toBe(hex)
    }
  })
  it('hex -> rgb -> hsv -> rgb -> hex', () => {
    for (const hex of SAMPLES) {
      const rgb = parseHex(hex)!
      expect(toHex(hsvToRgb(rgbToHsv(rgb)))).toBe(hex)
    }
  })
  it('known values', () => {
    expect(rgbToHsl({ r: 255, g: 0, b: 0 })).toEqual({ h: 0, s: 100, l: 50 })
    expect(rgbToHsv({ r: 0, g: 0, b: 255 })).toEqual({ h: 240, s: 100, v: 100 })
    const grey = rgbToHsl({ r: 128, g: 128, b: 128 })
    expect(grey.s).toBe(0)
    expect(grey.h).toBe(0)
  })
  it('hue wraps outside 0..360', () => {
    expect(toHex(hsvToRgb({ h: 360, s: 100, v: 100 }))).toBe('#ff0000')
    expect(toHex(hsvToRgb({ h: -120, s: 100, v: 100 }))).toBe('#0000ff')
    expect(toHex(hslToRgb({ h: 480, s: 100, l: 50 }))).toBe('#00ff00')
  })
})

describe('mix / clamp', () => {
  it('mixes at midpoint by default', () => {
    expect(mix('#000000', '#ffffff')).toBe('#808080')
    expect(mix('#ff0000', '#0000ff', 0)).toBe('#ff0000')
    expect(mix('#ff0000', '#0000ff', 1)).toBe('#0000ff')
  })
  it('clamp', () => {
    expect(clamp(5, 0, 3)).toBe(3)
    expect(clamp(-1, 0, 3)).toBe(0)
    expect(clamp(2, 0, 3)).toBe(2)
  })
})
