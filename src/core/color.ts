/** 0..255. parseHex는 정수를 반환하지만 hsl/hsv 변환은 소수를 그대로 반환한다(왕복 정확도). 반올림은 toHex와 UI 표시에서만 한다 */
export type Rgb = { r: number; g: number; b: number }
export type Hsl = { h: number; s: number; l: number }
export type Hsv = { h: number; s: number; v: number }

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v))
}

export function parseHex(input: string): Rgb | null {
  const m = input.trim().replace(/^#/, '')
  if (/^[0-9a-f]{3}$/i.test(m)) {
    return {
      r: parseInt(m[0] + m[0], 16),
      g: parseInt(m[1] + m[1], 16),
      b: parseInt(m[2] + m[2], 16),
    }
  }
  if (/^[0-9a-f]{6}$/i.test(m)) {
    return {
      r: parseInt(m.slice(0, 2), 16),
      g: parseInt(m.slice(2, 4), 16),
      b: parseInt(m.slice(4, 6), 16),
    }
  }
  return null
}

export function toHex({ r, g, b }: Rgb): string {
  const c = (n: number) => Math.round(clamp(n, 0, 255)).toString(16).padStart(2, '0')
  return `#${c(r)}${c(g)}${c(b)}`
}

function hueOf(rn: number, gn: number, bn: number, max: number, d: number): number {
  if (d === 0) return 0
  let h: number
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0)
  else if (max === gn) h = (bn - rn) / d + 2
  else h = (rn - gn) / d + 4
  return h * 60
}

export function rgbToHsl({ r, g, b }: Rgb): Hsl {
  const rn = r / 255, gn = g / 255, bn = b / 255
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn)
  const d = max - min
  const l = (max + min) / 2
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1))
  return { h: hueOf(rn, gn, bn, max, d), s: s * 100, l: l * 100 }
}

export function hslToRgb({ h, s, l }: Hsl): Rgb {
  const sn = s / 100, ln = l / 100
  const hn = (((h % 360) + 360) % 360) / 360
  if (sn === 0) {
    const v = ln * 255
    return { r: v, g: v, b: v }
  }
  const q = ln < 0.5 ? ln * (1 + sn) : ln + sn - ln * sn
  const p = 2 * ln - q
  const f = (t0: number) => {
    const t = ((t0 % 1) + 1) % 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }
  return { r: f(hn + 1 / 3) * 255, g: f(hn) * 255, b: f(hn - 1 / 3) * 255 }
}

export function rgbToHsv({ r, g, b }: Rgb): Hsv {
  const rn = r / 255, gn = g / 255, bn = b / 255
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn)
  const d = max - min
  return { h: hueOf(rn, gn, bn, max, d), s: max === 0 ? 0 : (d / max) * 100, v: max * 100 }
}

export function hsvToRgb({ h, s, v }: Hsv): Rgb {
  const sn = s / 100, vn = v / 100
  const hn = (((h % 360) + 360) % 360) / 60
  const i = Math.floor(hn) % 6
  const f = hn - Math.floor(hn)
  const p = vn * (1 - sn)
  const q = vn * (1 - sn * f)
  const t = vn * (1 - sn * (1 - f))
  const table: [number, number, number][] = [
    [vn, t, p], [q, vn, p], [p, vn, t], [p, q, vn], [t, p, vn], [vn, p, q],
  ]
  const [rn, gn, bn] = table[i]
  return { r: rn * 255, g: gn * 255, b: bn * 255 }
}

export function mix(a: string, b: string, t = 0.5): string {
  const ca = parseHex(a) ?? { r: 0, g: 0, b: 0 }
  const cb = parseHex(b) ?? { r: 0, g: 0, b: 0 }
  return toHex({
    r: ca.r + (cb.r - ca.r) * t,
    g: ca.g + (cb.g - ca.g) * t,
    b: ca.b + (cb.b - ca.b) * t,
  })
}
