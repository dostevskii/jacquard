export interface LockState {
  seed: boolean
  params: string[]
  palette: number[]
}

export function emptyLocks(): LockState {
  return { seed: false, params: [], palette: [] }
}

const sortedUnique = (xs: number[]): number[] => [...new Set(xs)].sort((a, b) => a - b)

export function lockParam(l: LockState, key: string): LockState {
  return l.params.includes(key) ? { ...l } : { ...l, params: [...l.params, key] }
}

export function toggleParamLock(l: LockState, key: string): LockState {
  return l.params.includes(key)
    ? { ...l, params: l.params.filter((k) => k !== key) }
    : { ...l, params: [...l.params, key] }
}

export function clearParamLocks(l: LockState): LockState {
  return { ...l, params: [] }
}

export function toggleSeedLock(l: LockState): LockState {
  return { ...l, seed: !l.seed }
}

export function lockSwatch(l: LockState, i: number): LockState {
  return l.palette.includes(i) ? { ...l } : { ...l, palette: sortedUnique([...l.palette, i]) }
}

export function toggleSwatchLock(l: LockState, i: number): LockState {
  return l.palette.includes(i)
    ? { ...l, palette: l.palette.filter((x) => x !== i) }
    : { ...l, palette: sortedUnique([...l.palette, i]) }
}

export function lockAllSwatches(l: LockState, count: number): LockState {
  return { ...l, palette: Array.from({ length: count }, (_, i) => i) }
}

/** 스와치 i와 j를 맞바꿨을 때 잠금도 함께 옮긴다 */
export function swatchLocksAfterSwap(l: LockState, i: number, j: number): LockState {
  return { ...l, palette: sortedUnique(l.palette.map((x) => (x === i ? j : x === j ? i : x))) }
}

/** 스와치 i를 지웠을 때 그 잠금은 없어지고 뒤 인덱스는 하나씩 당겨진다 */
export function swatchLocksAfterRemove(l: LockState, i: number): LockState {
  return { ...l, palette: l.palette.filter((x) => x !== i).map((x) => (x > i ? x - 1 : x)) }
}

export function clampSwatchLocks(l: LockState, count: number): LockState {
  return { ...l, palette: l.palette.filter((x) => x < count) }
}

/** URL 등 외부 입력을 정리한다. 알 수 없는 키·범위 밖 인덱스·잘못된 타입은 버린다 */
export function normalizeLocks(input: unknown, paramKeys: readonly string[], paletteLength: number): LockState {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return emptyLocks()
  const o = input as Record<string, unknown>
  const params = Array.isArray(o.params)
    ? [...new Set(o.params.filter((k): k is string => typeof k === 'string' && paramKeys.includes(k)))]
    : []
  const palette = Array.isArray(o.palette)
    ? sortedUnique(o.palette.filter((x): x is number => typeof x === 'number' && Number.isInteger(x) && x >= 0 && x < paletteLength))
    : []
  return { seed: o.seed === true, params, palette }
}
