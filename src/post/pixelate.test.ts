import { describe, it, expect } from 'vitest'
import { pixelate } from './pixelate'
import { makeImage, px, setPx, CTX } from './testUtils'

describe('pixelate', () => {
  it('fills each block with the block average and handles partial blocks', () => {
    const img = makeImage(10, 6)
    for (let y = 0; y < 6; y++) for (let x = 0; x < 10; x++) setPx(img, x, y, [x * 20, y * 40, 0])
    pixelate.apply(img, { enabled: true, block: 4 }, CTX)
    // 블록 (0,0): x 0..3 → 평균 30, y 0..3 → 평균 60
    expect(px(img, 0, 0)).toEqual([30, 60, 0, 255])
    expect(px(img, 3, 3)).toEqual([30, 60, 0, 255])
    // 오른쪽 부분 블록: x 8..9 → 평균 170; 아래 부분 블록: y 4..5 → (160+200)/2 = 180
    expect(px(img, 9, 5)).toEqual([170, 180, 0, 255])
    expect(px(img, 8, 4)).toEqual([170, 180, 0, 255])
  })
  it('block larger than the image gives one flat color', () => {
    const img = makeImage(4, 4)
    setPx(img, 0, 0, [255, 255, 255])
    pixelate.apply(img, { enabled: true, block: 64 }, CTX)
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) expect(px(img, x, y)[0]).toBe(16)
  })
  it('scales the block with pxPerUnit', () => {
    const img = makeImage(8, 2)
    setPx(img, 0, 0, [255, 0, 0])
    pixelate.apply(img, { enabled: true, block: 2 }, { ...CTX, pxPerUnit: 2 })
    expect(px(img, 3, 1)[0]).toBe(px(img, 0, 0)[0])
    expect(px(img, 4, 0)[0]).toBe(0)
  })
})
