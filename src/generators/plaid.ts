import type { GeneratorDef } from './types'
import type { Shape } from '../core/scene'
import { num, str, bool } from '../core/params'
import { mix } from '../core/color'
import { fg, pickFg, rect } from './util'

interface Stripe {
  w: number
  color: string
}

export const plaid: GeneratorDef = {
  id: 'plaid',
  name: 'Plaid',
  family: 'grid',
  minColors: 3,
  params: [
    { type: 'range', key: 'cell', label: 'Cell size', min: 2, max: 32, step: 1, default: 8 },
    { type: 'range', key: 'sett', label: 'Stripes per half sett', min: 2, max: 8, step: 1, default: 4 },
    { type: 'range', key: 'maxStripe', label: 'Max stripe width', min: 1, max: 8, step: 1, default: 4 },
    { type: 'toggle', key: 'symmetric', label: 'Symmetric sett', default: true },
    { type: 'toggle', key: 'sameSett', label: 'Same sett for weft', default: true },
    {
      type: 'select', key: 'blend', label: 'Crossing', default: 'mix',
      options: [
        { value: 'mix', label: 'Mix' },
        { value: 'weave', label: 'Weave' },
        { value: 'alternate', label: 'Alternate' },
      ],
    },
  ],
  generate({ params, palette, rng }) {
    const cell = num(params, 'cell')
    const sett = num(params, 'sett')
    const maxStripe = num(params, 'maxStripe')
    const symmetric = bool(params, 'symmetric')
    const sameSett = bool(params, 'sameSett')
    const blend = str(params, 'blend')

    const makeSett = (): Stripe[] => {
      const half: Stripe[] = []
      let prev: number | undefined
      for (let i = 0; i < sett; i++) {
        const ci = pickFg(palette, rng, prev)
        prev = ci
        half.push({ w: rng.int(1, maxStripe), color: fg(palette, ci) })
      }
      if (!symmetric) return half
      // 양 끝(pivot) 줄은 한 번만 두고 가운데를 거울 복사한다: s1..sn, s(n-1)..s2
      return half.concat(half.slice(1, -1).reverse())
    }

    const warp = makeSett()
    const weft = sameSett ? warp : makeSett()
    const total = (s: Stripe[]) => s.reduce((a, b) => a + b.w, 0)
    const width = total(warp) * cell
    const height = total(weft) * cell

    const shapes: Shape[] = []
    let y = 0
    for (let j = 0; j < weft.length; j++) {
      const wf = weft[j]
      const h = wf.w * cell
      let x = 0
      for (let i = 0; i < warp.length; i++) {
        const wp = warp[i]
        const w = wp.w * cell
        if (wp.color === wf.color) {
          shapes.push(rect(x, y, w, h, wp.color))
        } else if (blend === 'mix') {
          shapes.push(rect(x, y, w, h, mix(wp.color, wf.color)))
        } else if (blend === 'alternate') {
          shapes.push(rect(x, y, w, h, (i + j) % 2 === 0 ? wp.color : wf.color))
        } else {
          // weave: 1 cell 체커. 전역 셀 좌표로 판정해 줄 경계에서도 체커가 이어진다
          for (let cy = 0; cy < wf.w; cy++) {
            for (let cx = 0; cx < wp.w; cx++) {
              const gx = x / cell + cx
              const gy = y / cell + cy
              shapes.push(rect(x + cx * cell, y + cy * cell, cell, cell, (gx + gy) % 2 === 0 ? wp.color : wf.color))
            }
          }
        }
        x += w
      }
      y += h
    }
    // 모든 도형이 타일 안에 정확히 놓이므로 tileWrap 불필요
    return { width, height, background: palette[0], shapes }
  },
}
