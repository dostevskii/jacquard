import { hsvToRgb, toHex } from './color'

export interface PalettePreset {
  name: string
  colors: string[]
}

export const MAX_COLORS = 8
export const MIN_COLORS = 2

/** 첫 색이 배경. 참고 이미지에서 뽑은 근사값 */
export const PRESETS: PalettePreset[] = [
  { name: 'Missoni Blue', colors: ['#0a0a0a', '#1e6fe6', '#3b8cff', '#0b3fa8', '#9cc4ff'] },
  { name: 'Walala', colors: ['#f2f2f2', '#e63b2e', '#f2a91e', '#6aa9dc', '#1a1a1a', '#b41f2b'] },
  { name: 'Underground', colors: ['#eeeae1', '#7a1a1a', '#f2c72c', '#3a9ad9', '#e8459a', '#1f7a4d'] },
  { name: 'Boogie', colors: ['#f4efe9', '#ff2a2a', '#ffb3c1', '#ffffff'] },
  { name: 'Poppy Field', colors: ['#f48fb1', '#1b5e20', '#e53935', '#64b5f6', '#111111'] },
  { name: 'Bauhaus', colors: ['#f5f0e6', '#d32f2f', '#fbc02d', '#1565c0', '#212121'] },
  { name: 'Neon Op', colors: ['#111111', '#e6ff00', '#ff2d78', '#ff8a00', '#00a3a3'] },
  { name: 'Candy Weave', colors: ['#c8c8c8', '#1d47a8', '#ffb400', '#ff3366', '#58a36b', '#ffc9d9'] },
]

export const DEFAULT_PALETTE = PRESETS[0].colors

const FILLER = ['#e63b2e', '#f2a91e', '#6aa9dc', '#1f7a4d', '#e8459a', '#7a1a1a', '#f2f2f2', '#111111']

/** 생성기의 minColors를 채우도록 아직 없는 색을 뒤에 붙인다. 이미 충분하면 같은 배열을 그대로 반환 */
export function ensurePaletteLength(palette: string[], minColors: number): string[] {
  if (palette.length >= minColors) return palette
  const out = palette.slice()
  for (const c of FILLER) {
    if (out.length >= minColors) break
    if (!out.includes(c)) out.push(c)
  }
  return out
}

/** 황금각 색상 간격의 무작위 팔레트. 첫 색은 아주 밝거나 아주 어두운 배경 */
export function randomPalette(count: number, random: () => number = Math.random): string[] {
  const dark = random() < 0.5
  const bgHue = random() * 360
  const bg = hsvToRgb({ h: bgHue, s: dark ? 10 : 6, v: dark ? 8 + random() * 6 : 92 + random() * 5 })
  const out = [toHex(bg)]
  let h = random() * 360
  for (let i = 1; i < count; i++) {
    h = (h + 137.5) % 360
    out.push(toHex(hsvToRgb({ h, s: 55 + random() * 30, v: 35 + random() * 55 })))
  }
  return out
}
