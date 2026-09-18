import type { EffectDef } from './types'
import { enabledParam } from './types'
import { num } from '../core/params'

export const posterize: EffectDef = {
  id: 'posterize',
  name: 'Posterize',
  params: [enabledParam(), { type: 'range', key: 'levels', label: 'Levels', min: 2, max: 16, step: 1, default: 4 }],
  apply(img, params) {
    const L = num(params, 'levels')
    const lut = new Uint8ClampedArray(256)
    for (let v = 0; v < 256; v++) lut[v] = Math.round((Math.round((v / 255) * (L - 1)) / (L - 1)) * 255)
    const { data } = img
    for (let i = 0; i < data.length; i += 4) {
      data[i] = lut[data[i]]
      data[i + 1] = lut[data[i + 1]]
      data[i + 2] = lut[data[i + 2]]
    }
  },
}
