import type { EffectContext, RasterImage } from './types'

export function makeImage(width: number, height: number, fill: [number, number, number] = [0, 0, 0]): RasterImage {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = fill[0]
    data[i * 4 + 1] = fill[1]
    data[i * 4 + 2] = fill[2]
    data[i * 4 + 3] = 255
  }
  return { width, height, data }
}

export function px(img: RasterImage, x: number, y: number): [number, number, number, number] {
  const i = (y * img.width + x) * 4
  return [img.data[i], img.data[i + 1], img.data[i + 2], img.data[i + 3]]
}

export function setPx(img: RasterImage, x: number, y: number, rgb: [number, number, number]): void {
  const i = (y * img.width + x) * 4
  img.data[i] = rgb[0]
  img.data[i + 1] = rgb[1]
  img.data[i + 2] = rgb[2]
  img.data[i + 3] = 255
}

export function cloneImage(img: RasterImage): RasterImage {
  return { width: img.width, height: img.height, data: new Uint8ClampedArray(img.data) }
}

export const CTX: EffectContext = { pxPerUnit: 1, seed: 7, palette: ['#111111', '#e63b2e', '#f2a91e', '#f2f2f2'] }
