export type ParamValue = number | string | boolean

export type ParamDef =
  | { type: 'range'; key: string; label: string; min: number; max: number; step: number; default: number }
  | { type: 'select'; key: string; label: string; options: { value: string; label: string }[]; default: string }
  | { type: 'toggle'; key: string; label: string; default: boolean }

export type Params = Record<string, ParamValue>

export function defaultParams(defs: ParamDef[]): Params {
  const out: Params = {}
  for (const d of defs) out[d.key] = d.default
  return out
}

function snap(v: number, min: number, max: number, step: number): number {
  const steps = Math.round((v - min) / step)
  const snapped = min + steps * step
  const clamped = Math.min(max, Math.max(min, snapped))
  return Number(clamped.toFixed(6))
}

/** 알 수 없는 키는 버리고, 타입이 맞지 않거나 범위 밖인 값은 기본값 또는 경계값으로 보정한다 */
export function clampParams(defs: ParamDef[], input: Record<string, unknown>): Params {
  const out = defaultParams(defs)
  for (const d of defs) {
    const v = input[d.key]
    if (d.type === 'range') {
      if (typeof v === 'number' && Number.isFinite(v)) out[d.key] = snap(v, d.min, d.max, d.step)
    } else if (d.type === 'select') {
      if (typeof v === 'string' && d.options.some((o) => o.value === v)) out[d.key] = v
    } else if (typeof v === 'boolean') {
      out[d.key] = v
    }
  }
  return out
}

export const num = (p: Params, key: string): number => p[key] as number
export const str = (p: Params, key: string): string => p[key] as string
export const bool = (p: Params, key: string): boolean => p[key] as boolean
