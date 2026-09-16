import type { GeneratorDef } from './types'
import type { Shape } from '../core/scene'
import { clipShapeToRect, reflectShape, tileWrap } from '../core/scene'
import { num, str, bool } from '../core/params'
import { fg, pickFg } from './util'

/** 왼쪽(또는 위) 절반만 남기고 거울 복사해 좌우(상하) 대칭을 만든다 */
function mirrorHalf(shapes: Shape[], w: number, h: number, axis: 'x' | 'y'): Shape[] {
  const kept: Shape[] = []
  for (const s of shapes) {
    const c = axis === 'x' ? clipShapeToRect(s, 0, 0, w / 2, h) : clipShapeToRect(s, 0, 0, w, h / 2)
    if (c) kept.push(c)
  }
  return kept.concat(kept.map((s) => reflectShape(s, axis, axis === 'x' ? w : h)))
}

export const gradientBars: GeneratorDef = {
  id: 'gradientBars',
  name: 'Gradient Bars',
  family: 'gradient',
  minColors: 3,
  params: [
    { type: 'range', key: 'columns', label: 'Columns', min: 2, max: 64, step: 1, default: 12 },
    { type: 'range', key: 'barWidth', label: 'Bar width', min: 8, max: 200, step: 1, default: 60 },
    { type: 'range', key: 'length', label: 'Bar length', min: 200, max: 2000, step: 10, default: 800 },
    {
      type: 'select', key: 'direction', label: 'Direction', default: 'vertical',
      options: [
        { value: 'vertical', label: 'Vertical' },
        { value: 'horizontal', label: 'Horizontal' },
      ],
    },
    { type: 'range', key: 'bands', label: 'Segments', min: 1, max: 12, step: 1, default: 1 },
    { type: 'range', key: 'stagger', label: 'Stagger', min: 0, max: 1, step: 0.05, default: 0.5 },
    { type: 'range', key: 'step', label: 'Step per column', min: -1, max: 1, step: 0.05, default: 0 },
    {
      type: 'select', key: 'shape', label: 'Gradient', default: 'linear',
      options: [
        { value: 'linear', label: 'A → B' },
        { value: 'symmetric', label: 'A → B → A' },
      ],
    },
    {
      type: 'select', key: 'colorMode', label: 'Colors', default: 'pairs',
      options: [
        { value: 'pairs', label: 'Pairs' },
        { value: 'random', label: 'Random' },
      ],
    },
    { type: 'toggle', key: 'mirrorX', label: 'Mirror horizontally', default: false },
    { type: 'toggle', key: 'mirrorY', label: 'Mirror vertically', default: false },
  ],
  generate({ params, palette, rng }) {
    const columns = num(params, 'columns')
    const barW = num(params, 'barWidth')
    const length = num(params, 'length')
    const dir = str(params, 'direction')
    const bands = num(params, 'bands')
    const stagger = num(params, 'stagger')
    const step = num(params, 'step')
    const shape = str(params, 'shape')
    const mode = str(params, 'colorMode')
    const mirrorX = bool(params, 'mirrorX')
    const mirrorY = bool(params, 'mirrorY')

    const segLen = length / bands
    const shapes: Shape[] = []
    for (let i = 0; i < columns; i++) {
      let a: string
      let b: string
      if (mode === 'random') {
        const ai = pickFg(palette, rng)
        const bi = pickFg(palette, rng, ai)
        a = fg(palette, ai)
        b = fg(palette, bi)
      } else {
        a = fg(palette, 2 * i)
        b = fg(palette, 2 * i + 1)
      }
      const phase = (i % 2) * stagger + i * step
      const shift = (phase - Math.floor(phase)) * segLen
      const stops =
        shape === 'symmetric'
          ? [{ offset: 0, color: a }, { offset: 0.5, color: b }, { offset: 1, color: a }]
          : [{ offset: 0, color: a }, { offset: 1, color: b }]
      const u0 = i * barW
      for (let k = 0; k < bands; k++) {
        const v0 = k * segLen + shift
        if (dir === 'vertical') {
          shapes.push({
            kind: 'rect', x: u0, y: v0, w: barW, h: segLen,
            fill: { type: 'linear', x1: u0, y1: v0, x2: u0, y2: v0 + segLen, stops },
          })
        } else {
          shapes.push({
            kind: 'rect', x: v0, y: u0, w: segLen, h: barW,
            fill: { type: 'linear', x1: v0, y1: u0, x2: v0 + segLen, y2: u0, stops },
          })
        }
      }
    }
    const width = dir === 'vertical' ? columns * barW : length
    const height = dir === 'vertical' ? length : columns * barW
    let out = tileWrap(shapes, width, height)
    if (mirrorX) out = mirrorHalf(out, width, height, 'x')
    if (mirrorY) out = mirrorHalf(out, width, height, 'y')
    return { width, height, background: palette[0], shapes: out }
  },
}
