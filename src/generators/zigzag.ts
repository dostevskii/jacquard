import type { GeneratorDef } from './types'
import type { Shape } from '../core/scene'
import { num, str } from '../core/params'
import { fg, pickFg, rect } from './util'

/** 삼각파: 0 → 1 → 0, 주기 1 */
function tri(t: number): number {
  const f = t - Math.floor(t)
  return f < 0.5 ? f * 2 : 2 - f * 2
}

export const zigzag: GeneratorDef = {
  id: 'zigzag',
  name: 'Zigzag',
  family: 'grid',
  minColors: 3,
  params: [
    { type: 'range', key: 'cell', label: 'Cell size', min: 2, max: 32, step: 1, default: 6 },
    { type: 'range', key: 'wavelength', label: 'Wavelength', min: 4, max: 64, step: 2, default: 16 },
    { type: 'range', key: 'amplitude', label: 'Amplitude', min: 0, max: 32, step: 1, default: 6 },
    { type: 'range', key: 'bandHeight', label: 'Band height', min: 1, max: 16, step: 1, default: 3 },
    { type: 'range', key: 'bands', label: 'Bands', min: 2, max: 12, step: 1, default: 6 },
    {
      type: 'select', key: 'colorMode', label: 'Colors', default: 'sequence',
      options: [
        { value: 'sequence', label: 'Sequence' },
        { value: 'random', label: 'Random' },
      ],
    },
  ],
  generate({ params, palette, rng }) {
    const cell = num(params, 'cell')
    const wl = num(params, 'wavelength')
    const amp = num(params, 'amplitude')
    const bandH = num(params, 'bandHeight')
    const bands = num(params, 'bands')
    const mode = str(params, 'colorMode')

    const period = bands * bandH // 세로 주기(cell)
    const colors: string[] = []
    let prev: number | undefined
    for (let i = 0; i < bands; i++) {
      const ci = mode === 'random' ? pickFg(palette, rng, prev) : i
      prev = ci
      colors.push(fg(palette, ci))
    }

    const shapes: Shape[] = []
    for (let x = 0; x < wl; x++) {
      const off = Math.round(amp * tri(x / wl))
      let runStart = 0
      let runBand = -1
      for (let y = 0; y <= period; y++) {
        const band = y < period ? (((Math.floor((y + off) / bandH) % bands) + bands) % bands) : -2
        if (band !== runBand) {
          if (runBand >= 0) shapes.push(rect(x * cell, runStart * cell, cell, (y - runStart) * cell, colors[runBand]))
          runStart = y
          runBand = band
        }
      }
    }
    // 가로 주기 = wavelength, 세로 주기 = bands × bandHeight 이므로 타일이 곧 주기. tileWrap 불필요
    return { width: wl * cell, height: period * cell, background: palette[0], shapes }
  },
}
