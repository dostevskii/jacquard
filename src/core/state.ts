import type { ParamDef, Params } from './params'
import { clampParams, defaultParams } from './params'
import { ensurePaletteLength, MAX_COLORS, MIN_COLORS } from './palettes'
import { parseHex, toHex } from './color'
import { MAX_SEED } from './prng'
import type { LockState } from './locks'
import { emptyLocks, normalizeLocks } from './locks'

export type EffectsState = Record<string, Params>

export interface PatternState {
  generator: string
  seed: number
  params: Params
  palette: string[]
  locks: LockState
  effects: EffectsState
}

export interface GeneratorInfo {
  params: ParamDef[]
  minColors: number
}
export type ResolveGenerator = (id: string) => GeneratorInfo | undefined

export interface EffectInfo {
  id: string
  params: ParamDef[]
}

export interface StateDefaults {
  generator: string
  palette: string[]
  effectDefs: EffectInfo[]
}

export const DEFAULT_SEED = 1

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(text: string): string {
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/')
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
  const bin = atob(padded)
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

export function encodeState(state: PatternState): string {
  return toBase64Url(JSON.stringify(state))
}

export function normalizePalette(input: unknown, minColors: number, fallback: string[]): string[] {
  const list: string[] = []
  if (Array.isArray(input)) {
    for (const c of input) {
      if (typeof c !== 'string') continue
      const rgb = parseHex(c)
      if (rgb) list.push(toHex(rgb))
    }
  }
  const base = list.length >= MIN_COLORS ? list.slice(0, MAX_COLORS) : fallback.slice(0, MAX_COLORS)
  return ensurePaletteLength(base, minColors)
}

/** 효과별 매개변수를 정의에 맞춰 정리한다. 없거나 깨진 값은 기본값, 미지의 id는 버린다 */
export function normalizeEffects(input: unknown, effectDefs: EffectInfo[]): EffectsState {
  const src = typeof input === 'object' && input !== null && !Array.isArray(input) ? (input as Record<string, unknown>) : {}
  const out: EffectsState = {}
  for (const def of effectDefs) {
    const raw = src[def.id]
    const rawObj = typeof raw === 'object' && raw !== null && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {}
    out[def.id] = clampParams(def.params, rawObj)
  }
  return out
}

export function decodeState(hash: string, resolve: ResolveGenerator, defaults: StateDefaults): PatternState {
  const defaultInfo = resolve(defaults.generator)
  if (!defaultInfo) throw new Error(`Unknown default generator: ${defaults.generator}`)
  const base: PatternState = {
    generator: defaults.generator,
    seed: DEFAULT_SEED,
    params: defaultParams(defaultInfo.params),
    // slice로 복사해 App 상태가 PRESETS의 배열을 그대로 참조하지 않게 한다
    palette: ensurePaletteLength(defaults.palette.slice(), defaultInfo.minColors),
    locks: emptyLocks(),
    effects: normalizeEffects(undefined, defaults.effectDefs),
  }
  const raw = hash.replace(/^#/, '')
  if (!raw) return base

  let parsed: unknown
  try {
    parsed = JSON.parse(fromBase64Url(raw))
  } catch {
    return base
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return base
  const obj = parsed as Record<string, unknown>

  const generator = typeof obj.generator === 'string' && resolve(obj.generator) ? obj.generator : defaults.generator
  const info = resolve(generator)!
  const seed =
    typeof obj.seed === 'number' && Number.isInteger(obj.seed) && obj.seed >= 0 && obj.seed <= MAX_SEED
      ? obj.seed
      : DEFAULT_SEED
  const rawParams = typeof obj.params === 'object' && obj.params !== null && !Array.isArray(obj.params)
    ? (obj.params as Record<string, unknown>)
    : {}
  const palette = normalizePalette(obj.palette, info.minColors, defaults.palette)
  return {
    generator,
    seed,
    params: clampParams(info.params, rawParams),
    palette,
    locks: normalizeLocks(obj.locks, info.params.map((d) => d.key), palette.length),
    effects: normalizeEffects(obj.effects, defaults.effectDefs),
  }
}
