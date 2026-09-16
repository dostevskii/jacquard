# Jacquard v1.1 구현 계획 — 전역/개별 랜덤, 잠금, 라이트 테마

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 상단 Randomize가 시드·매개변수·팔레트 전부를 무작위로 바꾸되 사용자가 손댔거나 잠근 항목은 건드리지 않고, 항목마다 잠금·개별 랜덤 버튼을 두며, 라이트 테마를 기본으로 만든다.

**Architecture:** 잠금 상태 `LockState`를 `PatternState`에 넣어 URL에 함께 저장한다. 잠금 조작과 무작위 규칙은 `src/core/locks.ts`, `src/core/random.ts`의 순수 함수로 두고 Vitest로 검증한다. UI는 기존 컴포넌트(`ParamControl`, `TopBar`, `PalettePanel`)에 잠금·주사위 아이콘 버튼을 붙이고, App이 "값 변경 → 잠금", "개별 🎲 → 값만", "전역 Randomize → 잠기지 않은 것만"을 연결한다. 테마는 CSS 변수 두 벌과 `data-theme` 속성, `localStorage`로 처리한다.

**Tech Stack:** 기존과 동일 — Vite 8, React 19, TypeScript 6, Vitest, oxlint. 새 의존성 없음.

**Spec:** `docs/superpowers/specs/2026-09-17-jacquard-randomize-locks-theme-design.md` (선행 `2026-09-16-jacquard-design.md`). 실행자는 두 문서의 관련 절을 먼저 읽는다.

## Global Constraints

- 작업 폴더 `C:\Users\JohnHB\jacquard`, 브랜치 `main`, 시작 HEAD `8727b79`. 현재 190 tests / 18 files, lint·build 통과 상태를 매 Task 종료 시 유지한다.
- 런타임 의존성 추가 금지(react, react-dom만). `verbatimModuleSyntax`·`erasableSyntaxOnly`: 타입은 `import type`, `enum`/`namespace` 금지. 미사용 로컬·import는 빌드 실패.
- `src/core/*`는 DOM 참조 금지. `Math.random`은 `core/prng.randomSeed`·`core/palettes.randomPalette` 기본 인자 외에 쓰지 않는다. UI의 무작위는 `mulberry32(randomSeed())`로 만든 `Rng`를 순수 함수에 넘긴다.
- oxlint: `react/rules-of-hooks` 오류, `react/only-export-components` 경고 0, `react(set-state-in-effect)` 경고 0(효과 안에서 setState 금지 — 파생 상태 패턴 사용).
- 아이콘은 인라인 SVG(`currentColor`), 이모지 금지. UI 문구 영어.
- 잠금은 값을 바꾸지 않으며, 잠긴 항목도 직접 수정 가능하다. 개별 🎲는 잠금을 바꾸지 않고 잠겨 있어도 동작한다. 전역 Randomize는 잠기지 않은 시드·매개변수·스와치만 바꾸고 생성기는 바꾸지 않는다.
- 자동 잠금: 매개변수 변경 → 그 키, 시드 입력 확정 → 시드, 색 편집기 → 선택 스와치, 프리셋 적용 → 팔레트 전체. 생성기 변경 → 매개변수 잠금 초기화, 시드·팔레트 잠금 유지(팔레트 길이로 clamp).
- 라이트가 기본 테마. `localStorage['jacquard-theme']`가 `'dark'`일 때만 다크. OS 설정은 보지 않는다. 테마는 URL에 넣지 않는다.
- 각 Task 종료 시 `npm test && npm run lint && npm run build` 통과 후 커밋. 커밋 메시지: 한국어 제목 + 빈 줄 + 실행 세션 attribution 트레일러. 구현자는 push 하지 않는다.
- Windows(Git Bash). 한글이 든 파일은 heredoc 대신 파일 쓰기 도구로 만든다.

---

## 파일 구조

| 파일 | 책임 |
|---|---|
| `src/core/locks.ts` (+test) | `LockState`와 잠금 조작 순수 함수, `normalizeLocks` |
| `src/core/random.ts` (+test) | 매개변수·팔레트·전체 무작위 순수 함수 |
| `src/core/state.ts` (+test 수정) | `PatternState.locks` 추가, 인코딩·디코딩 |
| `src/ui/LockButton.tsx`, `src/ui/DiceButton.tsx` | 자물쇠·주사위 아이콘 버튼(및 아이콘 컴포넌트) |
| `src/ui/ParamControl.tsx`, `src/ui/ControlPanel.tsx` | 컨트롤 head 줄(라벨·🎲·🔒), 잠금 props 전달 |
| `src/ui/TopBar.tsx` | 시드 🎲/🔒, 전역 Randomize, 테마 토글 |
| `src/ui/PalettePanel.tsx` | 스와치 잠금 배지, 선택 스와치 🎲, Randomize colors, 자동 잠금 |
| `src/ui/theme.ts` (+test), `src/main.tsx`, `src/ui/Preview.tsx` | 테마 로드·저장·적용, 캔버스 색을 CSS 변수에서 읽기 |
| `src/App.tsx` | 잠금·무작위·테마 상태 연결 |
| `src/styles.css` | 라이트/다크 변수, 아이콘 버튼, head 줄, 스와치 배지 |
| `src/generators/generators.test.ts` | `generateScene` 호출에 `locks` 추가 |
| `README.md`, `docs/screenshots/*.png` | 기능·조작 표 갱신, 라이트 테마 스크린샷 |

---

### Task 1: 잠금·무작위 코어와 상태 통합

**Files:**
- Create: `src/core/locks.ts`, `src/core/locks.test.ts`, `src/core/random.ts`, `src/core/random.test.ts`
- Modify: `src/core/state.ts`, `src/core/state.test.ts`, `src/generators/generators.test.ts`

**Interfaces:**
- Consumes: `ParamDef`/`Params`/`ParamValue`/`snapValue` (core/params), `Rng`/`MAX_SEED`/`mulberry32` (core/prng), `randomPalette` (core/palettes), `rgbToHsv`/`parseHex` (core/color, 테스트용)
- Produces:
  ```ts
  // core/locks.ts
  export interface LockState { seed: boolean; params: string[]; palette: number[] }
  export function emptyLocks(): LockState
  export function lockParam(l: LockState, key: string): LockState
  export function toggleParamLock(l: LockState, key: string): LockState
  export function clearParamLocks(l: LockState): LockState
  export function toggleSeedLock(l: LockState): LockState
  export function lockSwatch(l: LockState, i: number): LockState
  export function toggleSwatchLock(l: LockState, i: number): LockState
  export function lockAllSwatches(l: LockState, count: number): LockState
  export function swatchLocksAfterSwap(l: LockState, i: number, j: number): LockState
  export function swatchLocksAfterRemove(l: LockState, i: number): LockState
  export function clampSwatchLocks(l: LockState, count: number): LockState
  export function normalizeLocks(input: unknown, paramKeys: readonly string[], paletteLength: number): LockState
  // core/random.ts
  export function randomParamValue(def: ParamDef, rng: Rng): ParamValue
  export function randomizeParams(defs: ParamDef[], params: Params, locked: readonly string[], rng: Rng): Params
  export function randomSwatch(index: number, rng: Rng): string
  export function randomizePalette(palette: string[], locked: readonly number[], rng: Rng): string[]
  export function randomizeAll(state: PatternState, defs: ParamDef[], rng: Rng): PatternState
  // core/state.ts
  export interface PatternState { generator: string; seed: number; params: Params; palette: string[]; locks: LockState }
  ```

- [ ] **Step 1: locks 테스트 작성**

`src/core/locks.test.ts`
```ts
import { describe, it, expect } from 'vitest'
import type { LockState } from './locks'
import {
  emptyLocks, lockParam, toggleParamLock, clearParamLocks, toggleSeedLock,
  lockSwatch, toggleSwatchLock, lockAllSwatches, swatchLocksAfterSwap, swatchLocksAfterRemove,
  clampSwatchLocks, normalizeLocks,
} from './locks'

const base = (): LockState => ({ seed: false, params: ['cell'], palette: [0, 2] })

describe('locks helpers are pure', () => {
  it('never mutate the input and return fresh objects', () => {
    const l = base()
    const snapshot = JSON.stringify(l)
    const outs = [
      lockParam(l, 'rows'), toggleParamLock(l, 'cell'), clearParamLocks(l), toggleSeedLock(l),
      lockSwatch(l, 1), toggleSwatchLock(l, 0), lockAllSwatches(l, 3), swatchLocksAfterSwap(l, 0, 1),
      swatchLocksAfterRemove(l, 0), clampSwatchLocks(l, 1),
    ]
    expect(JSON.stringify(l)).toBe(snapshot)
    for (const o of outs) expect(o).not.toBe(l)
    expect(emptyLocks()).not.toBe(emptyLocks())
  })
})

describe('param locks', () => {
  it('lockParam adds once, toggle flips, clear empties', () => {
    const l = base()
    expect(lockParam(l, 'rows').params).toEqual(['cell', 'rows'])
    expect(lockParam(l, 'cell').params).toEqual(['cell'])
    expect(toggleParamLock(l, 'cell').params).toEqual([])
    expect(toggleParamLock(l, 'rows').params).toEqual(['cell', 'rows'])
    expect(clearParamLocks(l)).toEqual({ seed: false, params: [], palette: [0, 2] })
  })
  it('toggleSeedLock flips only seed', () => {
    expect(toggleSeedLock(base())).toEqual({ seed: true, params: ['cell'], palette: [0, 2] })
  })
})

describe('swatch locks', () => {
  it('lock/toggle keep the list sorted and unique', () => {
    expect(lockSwatch(base(), 1).palette).toEqual([0, 1, 2])
    expect(lockSwatch(base(), 2).palette).toEqual([0, 2])
    expect(toggleSwatchLock(base(), 2).palette).toEqual([0])
    expect(toggleSwatchLock(base(), 1).palette).toEqual([0, 1, 2])
    expect(lockAllSwatches(base(), 4).palette).toEqual([0, 1, 2, 3])
  })
  it('swap moves locks with the swatches', () => {
    expect(swatchLocksAfterSwap(base(), 0, 1).palette).toEqual([1, 2])
    expect(swatchLocksAfterSwap(base(), 2, 3).palette).toEqual([0, 3])
    expect(swatchLocksAfterSwap(base(), 1, 3).palette).toEqual([0, 2])
  })
  it('remove drops the index and shifts later ones down', () => {
    expect(swatchLocksAfterRemove(base(), 0).palette).toEqual([1])
    expect(swatchLocksAfterRemove(base(), 1).palette).toEqual([0, 1])
    expect(swatchLocksAfterRemove(base(), 2).palette).toEqual([0])
  })
  it('clamp removes indices beyond the palette', () => {
    expect(clampSwatchLocks(base(), 2).palette).toEqual([0])
    expect(clampSwatchLocks(base(), 3).palette).toEqual([0, 2])
  })
})

describe('normalizeLocks', () => {
  it('returns empty locks for junk', () => {
    expect(normalizeLocks(undefined, ['cell'], 3)).toEqual(emptyLocks())
    expect(normalizeLocks('x', ['cell'], 3)).toEqual(emptyLocks())
    expect(normalizeLocks([1], ['cell'], 3)).toEqual(emptyLocks())
  })
  it('keeps only known keys and in-range indices, dedups and sorts', () => {
    const out = normalizeLocks({ seed: true, params: ['cell', 'zzz', 5, 'cell'], palette: [2, 0, 2, -1, 9, 1.5, 'a'] }, ['cell', 'rows'], 3)
    expect(out).toEqual({ seed: true, params: ['cell'], palette: [0, 2] })
    expect(normalizeLocks({ seed: 'yes' }, [], 0)).toEqual(emptyLocks())
  })
})
```

- [ ] **Step 2: random 테스트 작성**

`src/core/random.test.ts`
```ts
import { describe, it, expect } from 'vitest'
import type { ParamDef } from './params'
import { mulberry32 } from './prng'
import { parseHex, rgbToHsv } from './color'
import type { PatternState } from './state'
import { randomParamValue, randomizeParams, randomSwatch, randomizePalette, randomizeAll } from './random'

const DEFS: ParamDef[] = [
  { type: 'range', key: 'cell', label: 'Cell', min: 4, max: 64, step: 2, default: 16 },
  { type: 'range', key: 'offset', label: 'Offset', min: 0, max: 1, step: 0.25, default: 0.5 },
  { type: 'select', key: 'mode', label: 'Mode', options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }, { value: 'c', label: 'C' }], default: 'a' },
  { type: 'toggle', key: 'flag', label: 'Flag', default: false },
]
const PALETTE = ['#111111', '#e63b2e', '#f2a91e', '#6aa9dc']

describe('randomParamValue', () => {
  it('range values stay inside min..max and on the step grid', () => {
    const rng = mulberry32(3)
    const seen = new Set<number>()
    for (let i = 0; i < 500; i++) {
      const v = randomParamValue(DEFS[1], rng) as number
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(1)
      expect(Math.abs(v / 0.25 - Math.round(v / 0.25))).toBeLessThan(1e-9)
      seen.add(v)
    }
    expect([...seen].sort()).toEqual([0, 0.25, 0.5, 0.75, 1])
    for (let i = 0; i < 200; i++) {
      const v = randomParamValue(DEFS[0], rng) as number
      expect(v % 2).toBe(0)
      expect(v).toBeGreaterThanOrEqual(4)
      expect(v).toBeLessThanOrEqual(64)
    }
  })
  it('select picks an existing option and toggle yields both values', () => {
    const rng = mulberry32(9)
    const modes = new Set<string>()
    const flags = new Set<boolean>()
    for (let i = 0; i < 200; i++) {
      modes.add(randomParamValue(DEFS[2], rng) as string)
      flags.add(randomParamValue(DEFS[3], rng) as boolean)
    }
    expect([...modes].sort()).toEqual(['a', 'b', 'c'])
    expect(flags.size).toBe(2)
  })
})

describe('randomizeParams', () => {
  const params = { cell: 16, offset: 0.5, mode: 'a', flag: false }
  it('leaves locked keys untouched and changes unlocked ones deterministically', () => {
    const a = randomizeParams(DEFS, params, ['cell', 'mode'], mulberry32(5))
    const b = randomizeParams(DEFS, params, ['cell', 'mode'], mulberry32(5))
    expect(a).toEqual(b)
    expect(a.cell).toBe(16)
    expect(a.mode).toBe('a')
    expect(Object.keys(a).sort()).toEqual(['cell', 'flag', 'mode', 'offset'])
  })
  it('different seeds give different results and the input is not mutated', () => {
    const results = new Set<string>()
    for (let s = 1; s <= 20; s++) results.add(JSON.stringify(randomizeParams(DEFS, params, [], mulberry32(s))))
    expect(results.size).toBeGreaterThan(5)
    expect(params).toEqual({ cell: 16, offset: 0.5, mode: 'a', flag: false })
  })
})

describe('randomSwatch / randomizePalette', () => {
  it('index 0 is a background-style color (very dark or very light), others are foreground-style', () => {
    for (let s = 1; s <= 30; s++) {
      const bg = rgbToHsv(parseHex(randomSwatch(0, mulberry32(s)))!)
      expect(bg.v <= 15 || bg.v >= 91).toBe(true)
      const fg = rgbToHsv(parseHex(randomSwatch(3, mulberry32(s)))!)
      expect(fg.s).toBeGreaterThanOrEqual(54)
      expect(fg.v).toBeGreaterThanOrEqual(34)
    }
  })
  it('randomizePalette keeps length and locked indices', () => {
    const out = randomizePalette(PALETTE, [0, 2], mulberry32(7))
    expect(out).toHaveLength(4)
    expect(out[0]).toBe('#111111')
    expect(out[2]).toBe('#f2a91e')
    expect(out[1]).not.toBe('#e63b2e')
    for (const c of out) expect(c).toMatch(/^#[0-9a-f]{6}$/)
    expect(randomizePalette(PALETTE, [0, 2], mulberry32(7))).toEqual(out)
  })
})

describe('randomizeAll', () => {
  const state: PatternState = { generator: 'g', seed: 42, params: { cell: 16, offset: 0.5, mode: 'a', flag: false }, palette: PALETTE, locks: { seed: true, params: ['offset'], palette: [1] } }
  it('respects every lock and leaves generator and locks unchanged', () => {
    const out = randomizeAll(state, DEFS, mulberry32(11))
    expect(out.seed).toBe(42)
    expect(out.params.offset).toBe(0.5)
    expect(out.palette[1]).toBe('#e63b2e')
    expect(out.generator).toBe('g')
    expect(out.locks).toEqual(state.locks)
    expect(out.palette).toHaveLength(4)
  })
  it('changes the seed when it is not locked', () => {
    const out = randomizeAll({ ...state, locks: { seed: false, params: [], palette: [] } }, DEFS, mulberry32(11))
    expect(out.seed).not.toBe(42)
    expect(Number.isInteger(out.seed)).toBe(true)
    expect(out.seed).toBeGreaterThanOrEqual(0)
    expect(out.seed).toBeLessThanOrEqual(0xffffffff)
  })
})
```

- [ ] **Step 3: 실패 확인**

Run: `npx vitest run src/core/locks.test.ts src/core/random.test.ts`
Expected: FAIL — `Cannot find module './locks'` / `'./random'`

- [ ] **Step 4: locks.ts 구현**

`src/core/locks.ts`
```ts
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
```

- [ ] **Step 5: random.ts 구현**

`src/core/random.ts`
```ts
import type { ParamDef, ParamValue, Params } from './params'
import { snapValue } from './params'
import type { Rng } from './prng'
import { MAX_SEED } from './prng'
import { randomPalette } from './palettes'
import type { PatternState } from './state'

/** 정의 범위 안에서 무작위 값 하나. range는 step 격자 위, select는 옵션 중 하나, toggle은 참/거짓 */
export function randomParamValue(def: ParamDef, rng: Rng): ParamValue {
  if (def.type === 'range') {
    const steps = Math.round((def.max - def.min) / def.step)
    return snapValue(def, def.min + rng.int(0, steps) * def.step)
  }
  if (def.type === 'select') return rng.pick(def.options).value
  return rng.next() < 0.5
}

/** 잠기지 않은 키만 무작위로 교체한다. rng는 defs 순서대로 소비한다 */
export function randomizeParams(defs: ParamDef[], params: Params, locked: readonly string[], rng: Rng): Params {
  const out: Params = { ...params }
  for (const def of defs) {
    if (!locked.includes(def.key)) out[def.key] = randomParamValue(def, rng)
  }
  return out
}

/** 스와치 하나. 0번은 배경형(아주 밝거나 어두움), 나머지는 전경형 */
export function randomSwatch(index: number, rng: Rng): string {
  const pair = randomPalette(2, () => rng.next())
  return index === 0 ? pair[0] : pair[1]
}

/** 길이는 그대로, 잠긴 인덱스는 유지하고 나머지를 새 팔레트로 교체 */
export function randomizePalette(palette: string[], locked: readonly number[], rng: Rng): string[] {
  const fresh = randomPalette(palette.length, () => rng.next())
  return palette.map((c, i) => (locked.includes(i) ? c : fresh[i]))
}

/** 전역 Randomize: 잠기지 않은 시드 → 매개변수 → 팔레트 순으로 교체. 생성기·잠금은 그대로 */
export function randomizeAll(state: PatternState, defs: ParamDef[], rng: Rng): PatternState {
  const seed = state.locks.seed ? state.seed : rng.int(0, MAX_SEED)
  const params = randomizeParams(defs, state.params, state.locks.params, rng)
  const palette = randomizePalette(state.palette, state.locks.palette, rng)
  return { ...state, seed, params, palette }
}
```

- [ ] **Step 6: state.ts에 locks 통합**

`src/core/state.ts` 수정:
- import 추가: `import type { LockState } from './locks'` 와 `import { emptyLocks, normalizeLocks } from './locks'`
- `PatternState`에 `locks: LockState` 추가.
- `decodeState`의 `base`에 `locks: emptyLocks()` 추가.
- 반환 객체를 다음처럼 바꾼다(팔레트를 먼저 계산해 길이를 쓴다):
```ts
  const palette = normalizePalette(obj.palette, info.minColors, defaults.palette)
  return {
    generator,
    seed,
    params: clampParams(info.params, rawParams),
    palette,
    locks: normalizeLocks(obj.locks, info.params.map((d) => d.key), palette.length),
  }
```

`src/core/state.test.ts` 수정:
- import에 `import { emptyLocks } from './locks'` 추가.
- 기존 `PatternState` 리터럴 4곳에 `locks` 필드를 넣는다: round-trip 상태는 `locks: { seed: true, params: ['flag'], palette: [1] }`, 나머지 세 곳(`falls back`, `clamps`, `normalizes`)은 `locks: emptyLocks()`.
- `returns defaults` 기대값에 `locks: emptyLocks()` 추가.
- 테스트 추가:
```ts
  it('restores empty locks for a hash without locks and filters bad locks', () => {
    const legacy = btoa(JSON.stringify({ generator: 'a', seed: 2, params: { cell: 8 }, palette: ['#000000', '#ffffff', '#ff0000'] }))
    expect(decodeState('#' + legacy, resolve, defaults).locks).toEqual(emptyLocks())
    const hash = encodeState({ generator: 'a', seed: 2, params: {}, palette: ['#000000', '#ffffff', '#ff0000'], locks: { seed: true, params: ['cell', 'nope'], palette: [0, 7] } })
    expect(decodeState(hash, resolve, defaults).locks).toEqual({ seed: true, params: ['cell'], palette: [0] })
  })
```

`src/generators/generators.test.ts` 수정: `generateScene({ generator: DEFAULT_GENERATOR_ID, seed: 3, params: { cell: 9999 }, palette: [...] })` 호출에 `locks: emptyLocks()`를 추가하고 `import { emptyLocks } from '../core/locks'`를 넣는다.

- [ ] **Step 7: 통과 확인·전체 검증·커밋**

Run: `npx vitest run src/core` → PASS. Run: `npm test && npm run lint && npm run build` → 모두 통과(`tsc`가 `locks` 누락 리터럴을 잡으면 그 자리에 `emptyLocks()`를 넣는다).

```bash
git add src/core src/generators/generators.test.ts
git commit -m "feat(core): 잠금 상태·무작위 규칙 순수 함수, PatternState.locks URL 저장"
```

---

### Task 2: 아이콘 버튼, 매개변수 컨트롤의 잠금·개별 랜덤, App 연결

**Files:**
- Create: `src/ui/LockButton.tsx`, `src/ui/DiceButton.tsx`
- Modify: `src/ui/ParamControl.tsx`, `src/ui/ControlPanel.tsx`, `src/App.tsx`, `src/styles.css`

**Interfaces:**
- Consumes: `lockParam`, `toggleParamLock`, `clearParamLocks`, `clampSwatchLocks` (core/locks); `randomParamValue` (core/random); `mulberry32`, `randomSeed` (core/prng)
- Produces:
  ```ts
  // ui/LockButton.tsx
  export function LockIcon(props: { locked: boolean; size?: number }): JSX.Element
  export function LockButton(props: { locked: boolean; onToggle(): void; label?: string; className?: string }): JSX.Element
  // ui/DiceButton.tsx
  export function DiceIcon(props: { size?: number }): JSX.Element
  export function DiceButton(props: { onClick(): void; title?: string }): JSX.Element
  // ui/ParamControl.tsx — props 추가
  locked: boolean; onToggleLock(): void; onRandomize(): void
  // ui/ControlPanel.tsx — props 추가
  lockedKeys: string[]; onToggleLock(key: string): void; onRandomizeParam(key: string): void
  ```

- [ ] **Step 1: 아이콘 버튼 작성**

`src/ui/LockButton.tsx`
```tsx
interface IconProps {
  locked: boolean
  size?: number
}

export function LockIcon({ locked, size = 14 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <rect x="3" y="7" width="10" height="7" rx="1.5" fill="currentColor" />
      {locked ? (
        <path d="M5 7V5a3 3 0 0 1 6 0v2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      ) : (
        <path d="M5 7V5a3 3 0 0 1 6 0" fill="none" stroke="currentColor" strokeWidth="1.6" />
      )}
    </svg>
  )
}

interface Props {
  locked: boolean
  onToggle(): void
  label?: string
  className?: string
}

export function LockButton({ locked, onToggle, label = 'this value', className = '' }: Props) {
  const title = locked
    ? `Locked — Randomize leaves ${label} alone. Click to unlock.`
    : `Unlocked — Randomize may change ${label}. Click to lock.`
  return (
    <button
      type="button"
      className={`icon-btn lock${locked ? ' on' : ''}${className ? ` ${className}` : ''}`}
      title={title}
      aria-label={title}
      aria-pressed={locked}
      onClick={onToggle}
    >
      <LockIcon locked={locked} />
    </button>
  )
}
```

`src/ui/DiceButton.tsx`
```tsx
interface IconProps {
  size?: number
}

export function DiceIcon({ size = 14 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <rect x="1.5" y="1.5" width="13" height="13" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="5" cy="5" r="1.3" fill="currentColor" />
      <circle cx="11" cy="5" r="1.3" fill="currentColor" />
      <circle cx="8" cy="8" r="1.3" fill="currentColor" />
      <circle cx="5" cy="11" r="1.3" fill="currentColor" />
      <circle cx="11" cy="11" r="1.3" fill="currentColor" />
    </svg>
  )
}

interface Props {
  onClick(): void
  title?: string
}

export function DiceButton({ onClick, title = 'Randomize this value' }: Props) {
  return (
    <button type="button" className="icon-btn dice" title={title} aria-label={title} onClick={onClick}>
      <DiceIcon />
    </button>
  )
}
```

- [ ] **Step 2: ParamControl에 head 줄 추가**

`src/ui/ParamControl.tsx` — `Props`와 렌더를 다음처럼 바꾼다(`NumberField`는 그대로 둔다).
```tsx
import { useState } from 'react'
import type { ReactNode } from 'react'
import type { ParamDef, ParamValue } from '../core/params'
import { snapValue } from '../core/params'
import { LockButton } from './LockButton'
import { DiceButton } from './DiceButton'

interface Props {
  def: ParamDef
  value: ParamValue
  locked: boolean
  onChange(v: ParamValue): void
  onToggleLock(): void
  onRandomize(): void
}

interface HeadProps {
  label: string
  locked: boolean
  onToggleLock(): void
  onRandomize(): void
  children?: ReactNode
}

/** 라벨 줄: [라벨] [spacer] [children] [🎲] [🔒] */
function ControlHead({ label, locked, onToggleLock, onRandomize, children }: HeadProps) {
  return (
    <div className="control-head">
      <span className="control-label">{label}</span>
      <span className="spacer" />
      {children}
      <DiceButton onClick={onRandomize} title={`Randomize ${label}`} />
      <LockButton locked={locked} onToggle={onToggleLock} label={label} />
    </div>
  )
}
```
(기존 `NumberField` 정의는 이 아래에 그대로 유지)
```tsx
export function ParamControl({ def, value, locked, onChange, onToggleLock, onRandomize }: Props) {
  const cls = `control${locked ? ' locked' : ''}`
  const head = { label: def.label, locked, onToggleLock, onRandomize }
  if (def.type === 'range') {
    const v = typeof value === 'number' ? value : def.default
    return (
      <div className={cls}>
        <ControlHead {...head} />
        <input
          type="range"
          min={def.min}
          max={def.max}
          step={def.step}
          value={v}
          aria-label={def.label}
          onChange={(e) => onChange(snapValue(def, Number(e.target.value)))}
        />
        <NumberField value={v} snap={(n) => snapValue(def, n)} onCommit={onChange} />
      </div>
    )
  }
  if (def.type === 'select') {
    const v = typeof value === 'string' ? value : def.default
    return (
      <div className={cls}>
        <ControlHead {...head} />
        {def.options.length <= 4 ? (
          <div className="segmented">
            {def.options.map((o) => (
              <button key={o.value} type="button" className={o.value === v ? 'on' : ''} onClick={() => onChange(o.value)}>
                {o.label}
              </button>
            ))}
          </div>
        ) : (
          <select value={v} aria-label={def.label} onChange={(e) => onChange(e.target.value)}>
            {def.options.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        )}
      </div>
    )
  }
  const v = typeof value === 'boolean' ? value : def.default
  return (
    <div className={`${cls} toggle`}>
      <ControlHead {...head}>
        <input type="checkbox" checked={v} aria-label={def.label} onChange={(e) => onChange(e.target.checked)} />
      </ControlHead>
    </div>
  )
}
```

- [ ] **Step 3: ControlPanel props 전달**

`src/ui/ControlPanel.tsx`
```tsx
interface Props {
  generator: GeneratorDef
  params: Params
  lockedKeys: string[]
  onParamChange(key: string, value: ParamValue): void
  onToggleLock(key: string): void
  onRandomizeParam(key: string): void
  scene: Scene
  tilePx: TilePx
  children?: ReactNode
}

export function ControlPanel({ generator, params, lockedKeys, onParamChange, onToggleLock, onRandomizeParam, scene, tilePx, children }: Props) {
  return (
    <aside className="panel">
      <section className="panel-section">
        <h2>Parameters</h2>
        {generator.params.map((def) => (
          <ParamControl
            key={def.key}
            def={def}
            value={params[def.key] ?? def.default}
            locked={lockedKeys.includes(def.key)}
            onChange={(v) => onParamChange(def.key, v)}
            onToggleLock={() => onToggleLock(def.key)}
            onRandomize={() => onRandomizeParam(def.key)}
          />
        ))}
      </section>
      {children}
      <section className="panel-section">
        <h2>Output</h2>
        <div className="info">Tile: {Math.round(scene.width)} × {Math.round(scene.height)} units</div>
        <div className="info">At current scale: {tilePx.w} × {tilePx.h} px</div>
        <div className="info">Shapes: {scene.shapes.length}</div>
      </section>
    </aside>
  )
}
```

- [ ] **Step 4: App 연결 (매개변수 부분)**

`src/App.tsx` — import 추가:
```tsx
import { clampSwatchLocks, clearParamLocks, lockParam, toggleParamLock } from './core/locks'
import { randomParamValue } from './core/random'
import { mulberry32, randomSeed } from './core/prng'   // randomSeed는 이미 import됨 — 한 줄로 합친다
```
핸들러를 바꾼다/추가한다:
```tsx
  // 사용자가 값을 바꾸면 그 매개변수는 잠긴다
  const setParam = (key: string, value: ParamValue) =>
    setPattern((p) => ({ ...p, params: { ...p.params, [key]: value }, locks: lockParam(p.locks, key) }))

  // 개별 주사위: 값만 바꾸고 잠금은 건드리지 않는다
  const randomizeParam = (key: string) =>
    setPattern((p) => {
      const def = getGenerator(p.generator)?.params.find((d) => d.key === key)
      if (!def) return p
      return { ...p, params: { ...p.params, [key]: randomParamValue(def, mulberry32(randomSeed())) } }
    })

  const onToggleParamLock = (key: string) => setPattern((p) => ({ ...p, locks: toggleParamLock(p.locks, key) }))

  const selectGenerator = (id: string) => {
    const g = getGenerator(id)
    if (!g) return
    setPattern((p) => {
      const palette = ensurePaletteLength(p.palette, g.minColors)
      return {
        ...p,
        generator: id,
        params: defaultParams(g.params),
        palette,
        // 키가 달라지므로 매개변수 잠금은 초기화, 팔레트 잠금은 길이에 맞춰 유지
        locks: clampSwatchLocks(clearParamLocks(p.locks), palette.length),
      }
    })
  }
```
`<ControlPanel …>`에 `lockedKeys={pattern.locks.params} onToggleLock={onToggleParamLock} onRandomizeParam={randomizeParam}`를 넘긴다.

- [ ] **Step 5: 스타일 추가**

`src/styles.css` — `.control` 관련 규칙 아래에 추가:
```css
.control-head { display: flex; align-items: center; gap: 4px; min-height: 22px; }
.control-head .control-label { flex: none; }
.control.locked .control-label { color: var(--text); }
.control.toggle { grid-template-columns: 1fr; }
.control.toggle input[type='checkbox'] { margin: 0 4px 0 0; }
.icon-btn {
  display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px;
  padding: 0; border: 0; border-radius: 4px; background: transparent; color: var(--muted); cursor: pointer;
}
.icon-btn:hover { color: var(--text); background: var(--border); }
.icon-btn.lock.on { color: var(--accent); }
```
(기존 `.control.toggle { grid-template-columns: 1fr auto; … }` 규칙은 위 규칙으로 덮이므로 삭제한다.)

- [ ] **Step 6: 검증·브라우저 확인·커밋**

Run: `npm test && npm run lint && npm run build` → 통과.
브라우저(`npm run dev`, Playwright): (a) 각 컨트롤 라벨 줄 오른쪽에 🎲·🔒가 보인다 (b) 슬라이더를 움직이면 🔒가 강조색으로 바뀌고 라벨이 밝아진다 (c) 🔒 클릭으로 풀린다 (d) 🎲를 누르면 그 값만 바뀌고 🔒는 그대로다 (e) 생성기를 바꾸면 잠금 표시가 모두 사라진다 (f) 새로고침 후 잠금이 유지된다 (URL). 콘솔 오류 0.

```bash
git add src/ui src/App.tsx src/styles.css
git commit -m "feat(ui): 매개변수 잠금·개별 랜덤 버튼, 값 변경 시 자동 잠금"
```

---

### Task 3: 상단 바 — 시드 잠금·개별 랜덤, 전역 Randomize

**Files:**
- Modify: `src/ui/TopBar.tsx`, `src/App.tsx`, `src/styles.css`

**Interfaces:**
- Consumes: `randomizeAll` (core/random), `toggleSeedLock` (core/locks), `DiceButton`/`DiceIcon`, `LockButton`
- Produces (TopBar props): `seedLocked: boolean; onToggleSeedLock(): void; onRandomizeAll(): void` (기존 `onRandomSeed`는 시드만 바꾸는 개별 🎲로 유지)

- [ ] **Step 1: TopBar 수정**

`src/ui/TopBar.tsx` — import에 `import { DiceButton, DiceIcon } from './DiceButton'`, `import { LockButton } from './LockButton'` 추가. `Props`에 `seedLocked: boolean`, `onToggleSeedLock(): void`, `onRandomizeAll(): void` 추가. 시드 영역과 전역 버튼을 다음으로 바꾼다:
```tsx
      <label className={`seed${p.seedLocked ? ' locked' : ''}`}>
        Seed
        <input
          type="text"
          inputMode="numeric"
          value={seedText}
          onChange={(e) => setSeedDraft(e.target.value)}
          onBlur={commitSeed}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitSeed()
          }}
        />
      </label>
      <DiceButton onClick={p.onRandomSeed} title="Randomize seed" />
      <LockButton locked={p.seedLocked} onToggle={p.onToggleSeedLock} label="the seed" />
      <button type="button" className="btn randomize" title="Randomize everything that is not locked" onClick={p.onRandomizeAll}>
        <DiceIcon /> Randomize
      </button>
```
(기존 `🎲` 버튼 한 줄은 삭제.)

- [ ] **Step 2: App 연결**

`src/App.tsx` — import에 `randomizeAll` (core/random), `toggleSeedLock` (core/locks) 추가. 핸들러:
```tsx
  // 시드를 직접 입력하면 시드가 잠긴다
  const setSeed = (seed: number) => setPattern((p) => ({ ...p, seed, locks: { ...p.locks, seed: true } }))
  const randomizeSeedOnly = () => setPattern((p) => ({ ...p, seed: randomSeed() }))
  const onToggleSeedLock = () => setPattern((p) => ({ ...p, locks: toggleSeedLock(p.locks) }))
  // 전역 Randomize: 잠기지 않은 시드·매개변수·스와치만
  const randomizeEverything = () =>
    setPattern((p) => randomizeAll(p, getGenerator(p.generator)?.params ?? [], mulberry32(randomSeed())))
```
`<TopBar …>`에 `seed={pattern.seed} seedLocked={pattern.locks.seed} onSeedChange={setSeed} onRandomSeed={randomizeSeedOnly} onToggleSeedLock={onToggleSeedLock} onRandomizeAll={randomizeEverything}` 을 넘긴다(기존 인라인 `onSeedChange`/`onRandomSeed` 교체).

- [ ] **Step 3: 스타일**

`src/styles.css`에 추가:
```css
.btn.randomize { display: inline-flex; align-items: center; gap: 6px; }
.seed.locked { color: var(--text); }
```

- [ ] **Step 4: 검증·브라우저 확인·커밋**

Run: `npm test && npm run lint && npm run build` → 통과.
브라우저: (a) 시드 🎲는 시드만 바꾼다 (b) 시드를 직접 입력하면 시드 🔒가 켜진다 (c) Randomize를 누르면 잠기지 않은 매개변수·시드가 모두 바뀌고 8종 생성기 어느 것에서도 캔버스가 매번 달라진다 (d) 잠긴 항목은 값이 유지된다 (e) 생성기는 바뀌지 않는다. 콘솔 오류 0.

```bash
git add src/ui/TopBar.tsx src/App.tsx src/styles.css
git commit -m "feat(ui): 시드 잠금·개별 랜덤, 전역 Randomize 버튼"
```

---

### Task 4: 팔레트 패널 — 스와치 잠금 배지, 선택 스와치 랜덤, Randomize colors, 자동 잠금

**Files:**
- Modify: `src/ui/PalettePanel.tsx`, `src/App.tsx`, `src/styles.css`

**Interfaces:**
- Consumes: `LockState`, `lockSwatch`, `toggleSwatchLock`, `lockAllSwatches`, `swatchLocksAfterSwap`, `swatchLocksAfterRemove` (core/locks); `randomSwatch`, `randomizePalette` (core/random); `LockIcon`, `DiceButton`; `mulberry32`, `randomSeed`
- Produces (PalettePanel props): `{ palette: string[]; locks: LockState; minColors: number; onChange(palette: string[], locks: LockState): void }`

- [ ] **Step 1: PalettePanel 수정**

`src/ui/PalettePanel.tsx` — import를 다음으로 바꾼다:
```tsx
import { useState } from 'react'
import type { Hsv } from '../core/color'
import { hsvToRgb, parseHex, rgbToHsv, toHex } from '../core/color'
import { MAX_COLORS, MIN_COLORS, PRESETS, ensurePaletteLength } from '../core/palettes'
import type { LockState } from '../core/locks'
import { lockAllSwatches, lockSwatch, swatchLocksAfterRemove, swatchLocksAfterSwap, toggleSwatchLock } from '../core/locks'
import { randomSwatch, randomizePalette } from '../core/random'
import { mulberry32, randomSeed } from '../core/prng'
import { ColorEditor } from './ColorEditor'
import { LockIcon } from './LockButton'
import { DiceButton } from './DiceButton'

interface Props {
  palette: string[]
  locks: LockState
  minColors: number
  onChange(palette: string[], locks: LockState): void
}
```
핸들러를 다음으로 바꾼다(`edited` 캐시·`hsv` 파생 로직은 그대로):
```tsx
  const fresh = () => mulberry32(randomSeed())

  // 색 편집기로 바꾼 색은 사용자가 고른 것이므로 그 스와치를 잠근다
  const edit = (next: Hsv) => {
    const hex = toHex(hsvToRgb(next))
    setEdited({ index: sel, hex, hsv: next })
    const p = palette.slice()
    p[sel] = hex
    onChange(p, lockSwatch(locks, sel))
  }
  const move = (dir: -1 | 1) => {
    const j = sel + dir
    if (j < 0 || j >= palette.length) return
    const p = palette.slice()
    const tmp = p[sel]
    p[sel] = p[j]
    p[j] = tmp
    onChange(p, swatchLocksAfterSwap(locks, sel, j))
    setSelected(j)
    setEdited((e) => ({ ...e, index: j }))
  }
  const add = () => {
    if (palette.length >= MAX_COLORS) return
    onChange([...palette, randomSwatch(palette.length, fresh())], locks)
    setSelected(palette.length)
  }
  const remove = () => {
    if (palette.length <= minLen) return
    onChange(palette.filter((_, i) => i !== sel), swatchLocksAfterRemove(locks, sel))
    setSelected(Math.max(0, sel - 1))
  }
  // 프리셋 선택은 색을 고른 명시적 행위이므로 팔레트 전체를 잠근다
  const applyPreset = (name: string) => {
    const preset = PRESETS.find((p) => p.name === name)
    if (!preset) return
    const next = ensurePaletteLength(preset.colors.slice(), minColors)
    onChange(next, lockAllSwatches(locks, next.length))
    setSelected(0)
  }
  // 개별·전체 랜덤은 잠금을 바꾸지 않는다
  const randomizeSelected = () => {
    const p = palette.slice()
    p[sel] = randomSwatch(sel, fresh())
    onChange(p, locks)
  }
  const randomizeColors = () => onChange(randomizePalette(palette, locks.palette, fresh()), locks)
  const toggleLock = (i: number) => onChange(palette, toggleSwatchLock(locks, i))
```
JSX를 다음으로 바꾼다:
```tsx
  return (
    <section className="panel-section">
      <h2>Palette</h2>
      <div className="swatches">
        {palette.map((c, i) => {
          const locked = locks.palette.includes(i)
          return (
            <div key={i} className={`swatch${i === sel ? ' on' : ''}${locked ? ' locked' : ''}`} style={{ background: c }} title={c}>
              <button type="button" className="swatch-pick" aria-label={`Select color ${i + 1}`} onClick={() => setSelected(i)} />
              {i === 0 ? <span className="swatch-tag">BG</span> : null}
              <button
                type="button"
                className={`swatch-lock${locked ? ' on' : ''}`}
                title={locked ? 'Locked — Randomize keeps this color. Click to unlock.' : 'Unlocked — Randomize may change this color. Click to lock.'}
                aria-pressed={locked}
                aria-label={`${locked ? 'Unlock' : 'Lock'} color ${i + 1}`}
                onClick={() => toggleLock(i)}
              >
                <LockIcon locked={locked} size={9} />
              </button>
            </div>
          )
        })}
      </div>
      <div className="palette-tools">
        <button type="button" className="btn" onClick={() => move(-1)} disabled={sel === 0} title="Move left">◀</button>
        <button type="button" className="btn" onClick={() => move(1)} disabled={sel === palette.length - 1} title="Move right">▶</button>
        <button type="button" className="btn" onClick={add} disabled={palette.length >= MAX_COLORS} title="Add color">+</button>
        <button type="button" className="btn" onClick={remove} disabled={palette.length <= minLen} title="Remove color">−</button>
        <DiceButton onClick={randomizeSelected} title="Randomize the selected color" />
      </div>
      <div className="palette-tools">
        <select className="select" value="" onChange={(e) => applyPreset(e.target.value)} aria-label="Preset palette">
          <option value="" disabled>Preset…</option>
          {PRESETS.map((p) => (
            <option key={p.name} value={p.name}>{p.name}</option>
          ))}
        </select>
        <button type="button" className="btn" onClick={randomizeColors} title="Randomize every color that is not locked">Randomize colors</button>
      </div>
      <ColorEditor hsv={hsv} onChange={edit} />
    </section>
  )
```
(`randomPalette` import는 더 이상 쓰지 않으므로 제거.)

- [ ] **Step 2: App 연결**

`src/App.tsx`의 `<PalettePanel …>`를 다음으로 바꾼다:
```tsx
          <PalettePanel
            palette={pattern.palette}
            locks={pattern.locks}
            minColors={generator.minColors}
            onChange={(palette, locks) => setPattern((p) => ({ ...p, palette, locks }))}
          />
```

- [ ] **Step 3: 스타일**

`src/styles.css`의 `/* palette */` 블록을 다음으로 교체/추가:
```css
.swatches { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 8px; padding-top: 4px; }
.swatch {
  position: relative; width: 30px; height: 30px; border-radius: 4px; border: 2px solid transparent;
  box-shadow: inset 0 0 0 1px var(--swatch-ring);
}
.swatch.on { border-color: var(--text); }
.swatch-pick { position: absolute; inset: 0; background: transparent; border: 0; padding: 0; cursor: pointer; border-radius: 2px; }
.swatch-tag {
  position: absolute; left: 0; right: 0; bottom: -1px; font-size: 9px; font-weight: 700; text-align: center;
  color: #fff; text-shadow: 0 0 2px #000, 0 0 2px #000; pointer-events: none;
}
.swatch-lock {
  position: absolute; top: -6px; right: -6px; width: 15px; height: 15px; border-radius: 50%;
  border: 1px solid var(--border); background: var(--panel); color: var(--muted); padding: 0;
  display: inline-flex; align-items: center; justify-content: center; cursor: pointer; opacity: 0;
}
.swatch:hover .swatch-lock, .swatch-lock.on { opacity: 1; }
.swatch-lock.on { color: var(--accent); border-color: var(--accent); }
.palette-tools { display: flex; align-items: center; gap: 4px; margin-bottom: 6px; }
.palette-tools .btn { padding: 3px 6px; }
.palette-tools .btn:disabled { opacity: 0.35; cursor: default; border-color: var(--border); }
.palette-tools .select { min-width: 0; flex: 1 1 auto; }
```
`--swatch-ring` 변수는 Task 5에서 테마별로 정의한다. 이 Task에서는 `:root`에 `--swatch-ring: rgba(255, 255, 255, 0.15);` 한 줄을 임시로 추가한다.

- [ ] **Step 4: 검증·브라우저 확인·커밋**

Run: `npm test && npm run lint && npm run build` → 통과.
브라우저: (a) 스와치에 마우스를 올리면 자물쇠 배지가 보이고 클릭하면 잠긴다(배지가 강조색으로 고정) (b) 색상환으로 색을 바꾸면 그 스와치가 잠긴다 (c) 프리셋을 적용하면 모든 스와치가 잠긴다 (d) 선택 스와치 🎲는 그 색만 바꾸고 잠금은 그대로다 (e) Randomize colors와 상단 Randomize는 잠긴 스와치를 유지한다 (f) ◀ ▶로 옮기면 잠금이 따라간다, −로 지우면 뒤 잠금이 당겨진다 (g) 패널에 가로 스크롤바가 없다. 콘솔 오류 0.

```bash
git add src/ui/PalettePanel.tsx src/App.tsx src/styles.css
git commit -m "feat(ui): 스와치 잠금 배지, 선택 색 랜덤, Randomize colors, 색 편집·프리셋 자동 잠금"
```

---

### Task 5: 라이트 테마(기본)와 토글

**Files:**
- Create: `src/ui/theme.ts`, `src/ui/theme.test.ts`
- Modify: `src/styles.css`, `src/main.tsx`, `src/App.tsx`, `src/ui/TopBar.tsx`, `src/ui/Preview.tsx`

**Interfaces:**
- Produces:
  ```ts
  // ui/theme.ts
  export type Theme = 'light' | 'dark'
  export const THEME_KEY = 'jacquard-theme'
  export interface ThemeStore { getItem(key: string): string | null; setItem(key: string, value: string): void }
  export function loadTheme(store: ThemeStore | null): Theme
  export function saveTheme(store: ThemeStore | null, theme: Theme): void
  export function browserStorage(): ThemeStore | null
  export function applyTheme(theme: Theme): void
  // TopBar props 추가: theme: Theme; onToggleTheme(): void
  // Preview props 추가: theme: Theme  (테마 변경 시 다시 그리기 위한 의존성)
  ```

- [ ] **Step 1: theme 테스트 작성**

`src/ui/theme.test.ts`
```ts
import { describe, it, expect } from 'vitest'
import type { ThemeStore } from './theme'
import { loadTheme, saveTheme, THEME_KEY } from './theme'

function store(initial: Record<string, string> = {}): ThemeStore & { data: Record<string, string> } {
  const data = { ...initial }
  return { data, getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = v } }
}

describe('loadTheme', () => {
  it('defaults to light when nothing is stored, the store is missing, or the value is junk', () => {
    expect(loadTheme(store())).toBe('light')
    expect(loadTheme(null)).toBe('light')
    expect(loadTheme(store({ [THEME_KEY]: 'blue' }))).toBe('light')
  })
  it('returns dark only for the exact value "dark"', () => {
    expect(loadTheme(store({ [THEME_KEY]: 'dark' }))).toBe('dark')
    expect(loadTheme(store({ [THEME_KEY]: 'Dark' }))).toBe('light')
  })
  it('survives a throwing store', () => {
    const bad: ThemeStore = { getItem: () => { throw new Error('denied') }, setItem: () => { throw new Error('denied') } }
    expect(loadTheme(bad)).toBe('light')
    expect(() => saveTheme(bad, 'dark')).not.toThrow()
  })
})

describe('saveTheme', () => {
  it('writes the theme under THEME_KEY and ignores a missing store', () => {
    const s = store()
    saveTheme(s, 'dark')
    expect(s.data[THEME_KEY]).toBe('dark')
    expect(() => saveTheme(null, 'light')).not.toThrow()
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/ui/theme.test.ts` → FAIL `Cannot find module './theme'`

- [ ] **Step 3: theme.ts 구현**

`src/ui/theme.ts`
```ts
export type Theme = 'light' | 'dark'

export const THEME_KEY = 'jacquard-theme'

export interface ThemeStore {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

/** 저장값이 정확히 'dark'일 때만 다크. 그 외(없음·깨짐·접근 불가)는 라이트 */
export function loadTheme(store: ThemeStore | null): Theme {
  try {
    return store?.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

export function saveTheme(store: ThemeStore | null, theme: Theme): void {
  try {
    store?.setItem(THEME_KEY, theme)
  } catch {
    // 사생활 모드 등으로 저장이 막히면 조용히 넘어간다
  }
}

export function browserStorage(): ThemeStore | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme
}
```

- [ ] **Step 4: CSS 변수 두 벌**

`src/styles.css`의 첫 `:root { … }` 블록을 다음으로 교체한다(폰트 설정은 유지):
```css
:root {
  color-scheme: light;
  --bg: #f3f3f1;
  --panel: #ffffff;
  --border: #d9d9d6;
  --text: #1a1a1a;
  --muted: #6a6a6a;
  --accent: #2b6cd9;
  --on-accent: #ffffff;
  --canvas-bg: #e4e4e1;
  --danger: #c62828;
  --grid-line: rgba(0, 0, 0, 0.6);
  --swatch-ring: rgba(0, 0, 0, 0.15);
  font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  font-size: 13px;
}
:root[data-theme='dark'] {
  color-scheme: dark;
  --bg: #141414;
  --panel: #1d1d1d;
  --border: #2c2c2c;
  --text: #ececec;
  --muted: #9a9a9a;
  --accent: #6aa9dc;
  --on-accent: #0c0c0c;
  --canvas-bg: #0c0c0c;
  --danger: #ff6b5e;
  --grid-line: rgba(255, 255, 255, 0.75);
  --swatch-ring: rgba(255, 255, 255, 0.15);
}
```
그리고 하드코딩 색을 변수로 바꾼다: `.segmented button.on { … color: var(--on-accent); }`, `.btn.primary { … color: var(--on-accent); … }`, `.control .num.invalid { border-color: var(--danger); }`, `.field.invalid input { border-color: var(--danger); }`, `.info.error { color: var(--danger); }`. Task 4에서 임시로 넣은 `--swatch-ring` 줄은 삭제한다. `.icon-btn.theme` 규칙은 필요 없다(`.icon-btn` 공용).

- [ ] **Step 5: main.tsx, App, TopBar, Preview**

`src/main.tsx` — 렌더 전에 테마를 적용해 첫 화면 깜빡임을 막는다:
```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import App from './App'
import { applyTheme, browserStorage, loadTheme } from './ui/theme'

applyTheme(loadTheme(browserStorage()))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

`src/App.tsx` — import `import type { Theme } from './ui/theme'`, `import { applyTheme, browserStorage, loadTheme, saveTheme } from './ui/theme'`. 상태와 효과:
```tsx
  const [theme, setTheme] = useState<Theme>(() => loadTheme(browserStorage()))
  useEffect(() => {
    applyTheme(theme)
    saveTheme(browserStorage(), theme)
  }, [theme])
  const toggleTheme = () => setTheme((t) => (t === 'light' ? 'dark' : 'light'))
```
`<TopBar … theme={theme} onToggleTheme={toggleTheme} />`, `<Preview … theme={theme} />`.

`src/ui/TopBar.tsx` — `Props`에 `theme: Theme; onToggleTheme(): void` 추가(`import type { Theme } from './theme'`). Copy link 버튼 앞에:
```tsx
      <button
        type="button"
        className="icon-btn theme"
        title={p.theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
        aria-label={p.theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
        onClick={p.onToggleTheme}
      >
        {p.theme === 'light' ? (
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M11.5 9.5A5 5 0 0 1 6.5 4.5a5 5 0 0 0 5 8 5 5 0 0 0 3-1z" fill="currentColor" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
            <circle cx="8" cy="8" r="3" fill="currentColor" />
            <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.5 1.5M11.5 11.5 13 13M3 13l1.5-1.5M11.5 4.5 13 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        )}
      </button>
```

`src/ui/Preview.tsx` — `Props`에 `theme: string` 추가하고 effect 의존성 배열을 `[scene, view, scale, theme]`로 바꾼다. `draw` 안에서 색을 변수에서 읽는다:
```tsx
      const css = getComputedStyle(document.documentElement)
      const canvasBg = css.getPropertyValue('--canvas-bg').trim() || '#0c0c0c'
      const mutedColor = css.getPropertyValue('--muted').trim() || '#9a9a9a'
      const gridLine = css.getPropertyValue('--grid-line').trim() || 'rgba(255,255,255,0.75)'
```
`ctx.fillStyle = '#0c0c0c'` → `canvasBg`, `unavailable`의 `'#9a9a9a'` → `mutedColor`, 3×3의 `ctx.strokeStyle = 'rgba(255,255,255,0.75)'` → `gridLine`. `theme` prop은 테마가 바뀔 때 다시 그리기 위한 의존성이다. effect 본문의 `draw` 첫 줄에 `canvas.dataset.theme = theme` 를 넣어(캔버스에 현재 테마를 표시하는 속성 하나, 다른 부작용 없음) 값이 실제로 사용되게 하고, 의존성 배열을 `[scene, view, scale, theme]`로 둔다.

- [ ] **Step 6: 검증·브라우저 확인·커밋**

Run: `npm test && npm run lint && npm run build` → 통과.
브라우저: (a) localStorage를 비운 새 컨텍스트에서 라이트 테마로 뜬다(배경 밝음, 캔버스 바탕 `#e4e4e1`) (b) 토글 → 다크로 바뀌고 미리보기 바탕·3×3 점선 색도 바뀐다 (c) 새로고침 후 다크 유지 (d) 라이트에서 강조 버튼 글자가 흰색, 잠금 아이콘 강조색이 보인다 (e) 색상환·스와치·모달이 두 테마에서 모두 정상. 콘솔 오류 0. 라이트/다크 스크린샷 각 1장을 임시로 찍어 보고서에 첨부(커밋하지 않음).

```bash
git add src/ui/theme.ts src/ui/theme.test.ts src/styles.css src/main.tsx src/App.tsx src/ui/TopBar.tsx src/ui/Preview.tsx
git commit -m "feat(ui): 라이트 테마 기본값, 해/달 토글, 테마 변수화"
```

---

### Task 6: 시나리오 검증, 스크린샷 재촬영, README 갱신, 재배포

**Files:**
- Modify: `README.md`, `docs/screenshots/*.png` (11장 전부), `docs/superpowers/specs/2026-09-16-jacquard-design.md`(9절 배포 줄만)

- [ ] **Step 1: Playwright 시나리오 8종**

`npm run dev` 상태에서 1440×1024, 새 브라우저 컨텍스트(localStorage 비움)로:
1. 8종 생성기 각각에서 Randomize 3회 → 매번 캔버스 픽셀 지문이 달라진다.
2. 첫 로드가 라이트, 토글 → 다크, 새로고침 후 다크 유지.
3. Cell size 슬라이더 조작 → 🔒 켜짐 → Randomize 3회 후 Cell size 값 유지.
4. 손대지 않은 Rows에 🔒 수동 → Randomize 후 유지; 🔒 해제 → Randomize 후 바뀜.
5. Band height 🎲 → 그 값만 바뀌고 🔒는 꺼진 상태, 다른 값 불변.
6. 프리셋 Walala 적용 → 스와치 전부 잠김 → Randomize 후 색 유지; 2번 스와치 🔒 해제 → Randomize 후 그 색만 바뀜.
7. 시드 12345 입력 → 시드 🔒 켜짐 → Randomize 후 시드 12345 유지.
8. 위 상태에서 Copy link URL을 새 탭에 열면 잠금·값이 그대로 복원된다.
결과와 콘솔 메시지를 보고서에 기록한다. 실패하면 멈추고 보고한다(코드 수정은 컨트롤러 판단).

- [ ] **Step 2: 스크린샷 11장 라이트 테마로 재촬영**

`docs/screenshots/` 전부 덮어쓴다(1440×1024, 라이트, 새로고침 초기 상태에서 프리셋만 적용): `hero.png`(Gradient Bars + Boogie, Fill), `01-stripes.png`(Poppy Field), `02-plaid.png`(Underground), `03-zigzag.png`(Missoni Blue), `04-motif.png`(Bauhaus), `05-rings.png`(Walala), `06-gradient-bars.png`(Candy Weave), `07-iso-cubes.png`(Neon Op), `08-triangles.png`(Neon Op, Rhombus), `palette-editor.png`(팔레트 편집기가 보이도록 스크롤, 스와치 하나 잠금 상태), `export-dialog.png`(Canvas 모드). 개발용 요소가 찍히지 않게 한다.

- [ ] **Step 3: README 갱신 (영문·한국어 동일하게)**

- `## What is Jacquard?` 둘째 문단에 한 문장 추가: Randomize가 잠기지 않은 모든 것을 바꾸고, 손댄 값은 자동으로 잠기며, 자물쇠로 직접 잠글 수 있다는 점.
- `## Features`에 불릿 추가: **Randomize with locks** — top-bar Randomize changes seed, every parameter and every unlocked colour; anything you touched is locked automatically; lock/unlock icons on every control and swatch; per-value dice buttons. **Light and dark themes** — light by default, toggle in the top bar, remembered in the browser.
- `## Controls` 표: `🎲` 행을 "Dice next to a value / swatch — randomizes only that value; never locks it"로, `Shuffle` 행을 `Randomize colors — new colours for every unlocked swatch`로 바꾸고, `Randomize (top bar)`, `Lock icon`, `Sun / moon` 행을 추가. 자동 잠금 규칙 한 줄(값을 바꾸면 잠김, 프리셋은 전체 잠김, 개별 dice는 잠그지 않음)도 표 아래에 적는다.
- `## Known limitations`: "테마는 URL에 저장되지 않고 브라우저에만 기억된다" 추가. 실제로 확인한 사실만 쓴다.
- 한국어 절도 같은 내용으로.

- [ ] **Step 4: 검증·재배포·커밋**

Run: `npm test && npm run lint && npm run build` → 통과. `npm run deploy` → 라이브 URL에서 라이트 테마 기본, Randomize·잠금 동작, 8종 렌더 확인. 설계서(v1) 9절의 배포 줄 아래에 `- v1.1 배포: 2026-MM-DD (Randomize·잠금·라이트 테마)` 한 줄 추가.

```bash
git add README.md docs/screenshots docs/superpowers/specs/2026-09-16-jacquard-design.md
git commit -m "docs: v1.1 README·스크린샷(라이트 테마), 배포 기록"
```

---

## 자체 검토 결과 (계획 작성자)

- 스펙 §3(상태·URL) → Task 1. §4(무작위 규칙) → Task 1. §5(잠금 규칙 표) → Task 2(매개변수)·3(시드)·4(팔레트)·App `selectGenerator`. §6.1 아이콘 → Task 2. §6.2 → Task 2. §6.3 → Task 3·5. §6.4 → Task 4. §6.5 → Task 2~4. §7 → Task 5. §8 → 각 Task 테스트 + Task 6 시나리오. §9 순서 = Task 1~6.
- 타입 일관성: `onChange(palette, locks: LockState)`(Task 4)와 App의 `setPattern((p) => ({ ...p, palette, locks }))` 일치. `ControlPanel`의 `lockedKeys/onToggleLock/onRandomizeParam` 이름이 Task 2의 App 핸들러와 일치. `TopBar`의 `seedLocked/onToggleSeedLock/onRandomizeAll/theme/onToggleTheme` 일치.
- 스펙 §3.1의 `EMPTY_LOCKS` 상수는 공유 참조 문제를 피하려고 `emptyLocks()` 함수로 바꿨다(컨트롤러가 스펙 문구를 갱신한다).
- Task 5의 Preview `theme` 미사용 경고 처리: `canvas.dataset.theme = theme` 한 줄로 사용 처리(부작용 없음).
