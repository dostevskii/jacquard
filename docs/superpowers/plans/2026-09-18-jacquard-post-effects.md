# Jacquard v1.2 구현 계획 — 후처리 엔진 6종, 기본 생성기 Zigzag

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 타일 1장의 픽셀에 Blur·Grain·Pixelate·Posterize·Dither·Halftone을 고정 순서로 적용하는 후처리 엔진을 만들고, Effects 패널·URL 상태·내보내기에 연결하며, 첫 접속 생성기를 Zigzag로 바꾼다.

**Architecture:** 효과는 `src/post/`의 순수 함수(`RasterImage` in-place 수정)로, Canvas를 모르므로 Node의 Vitest로 검증한다. `renderTile`이 도형을 그린 뒤 `getImageData → applyEffects → putImageData`를 수행하므로 미리보기·타일 내보내기·캔버스 내보내기가 같은 결과를 낸다. 크기 매개변수는 타일 단위(unit)이고 `pxPerUnit`을 곱한다. `PatternState.effects`는 URL에 저장되고, 잠금·Randomize와는 무관하다.

**Tech Stack:** 기존과 동일(Vite 8, React 19, TypeScript 6, Vitest, oxlint). 새 의존성 없음.

**Spec:** `docs/superpowers/specs/2026-09-18-jacquard-post-effects-design.md` (선행 `2026-09-16`, `2026-09-17` 설계서). 실행자는 §3~§7을 먼저 읽는다.

## Global Constraints

- 작업 폴더 `C:\Users\JohnHB\jacquard`, 브랜치 `main`, 시작 HEAD `d78da73`. 현재 212 tests / 21 files, lint·build 통과를 매 Task 종료 시 유지한다.
- 런타임 의존성 추가 금지. `verbatimModuleSyntax`·`erasableSyntaxOnly`: 타입은 `import type`, `enum`/`namespace` 금지. 미사용 로컬·import는 빌드 실패.
- `src/core/*`, `src/post/*`는 DOM 참조 금지(`document`, `window`, `ImageData` 생성자 금지 — `RasterImage`는 평범한 객체). `src/core/state.ts`는 `src/post/`를 import하지 않는다(정의 목록을 인자로 받는다).
- 효과는 RGB만 바꾸고 알파는 255로 유지한다. 크기 매개변수는 unit이며 `pxPerUnit`을 곱해 px로 바꾼다. 블러 반지름 px 상한 64.
- 적용 순서 고정: pixelate → blur → posterize → dither → halftone → grain (`EFFECTS` 배열 순서).
- 후처리는 전역 Randomize·잠금과 무관하다(`randomizeAll`·`locks` 불변). 개별 🎲만 있다.
- oxlint: `react/rules-of-hooks` 오류, `react/only-export-components` 경고 0, `react(set-state-in-effect)` 경고 0.
- UI 문구 영어. 아이콘은 기존 `DiceButton`/`LockButton` 재사용.
- 각 Task 종료 시 `npm test && npm run lint && npm run build` 통과 후 커밋. 커밋 메시지: 한국어 제목 + 빈 줄 + 실행 세션 attribution 트레일러. 구현자는 push 하지 않는다.
- Windows(Git Bash). 한글이 든 파일은 heredoc 대신 파일 쓰기 도구로 만든다.

---

## 파일 구조

| 파일 | 책임 |
|---|---|
| `src/post/types.ts` | `RasterImage`, `EffectContext`, `EffectDef`, `enabledParam()` |
| `src/post/index.ts` (+test) | `EFFECTS` 순서 배열, `defaultEffects`, `hasEnabledEffects`, `applyEffects`, `effectInfos` |
| `src/post/blur.ts`, `grain.ts`, `pixelate.ts`, `posterize.ts`, `dither.ts`, `halftone.ts` (+각 test) | 효과 6종 |
| `src/post/testUtils.ts` | 테스트용 이미지 생성·읽기 헬퍼 |
| `src/core/state.ts` (+test) | `EffectsState`, `EffectInfo`, `normalizeEffects`, `PatternState.effects` |
| `src/generators/index.ts` | `DEFAULT_GENERATOR_ID = 'zigzag'` |
| `src/render/canvas.ts`, `src/render/export.ts` (+test) | `PostOptions`, 렌더 후 효과 적용 |
| `src/ui/EffectsPanel.tsx` | Effects 섹션 |
| `src/ui/ParamControl.tsx` | `lockable` prop |
| `src/ui/ControlPanel.tsx`, `src/ui/Preview.tsx`, `src/ui/ExportDialog.tsx`, `src/App.tsx`, `src/styles.css` | 연결 |
| `README.md`, `docs/screenshots/effects-*.png` | 문서 |

---

### Task 1: 효과 엔진 골격, 상태 통합, 기본 생성기 Zigzag

**Files:**
- Create: `src/post/types.ts`, `src/post/index.ts`, `src/post/index.test.ts`, `src/post/testUtils.ts`
- Modify: `src/core/state.ts`, `src/core/state.test.ts`, `src/generators/index.ts`, `src/generators/generators.test.ts`, `src/App.tsx`

**Interfaces:**
- Consumes: `ParamDef`, `Params`, `defaultParams`, `clampParams`, `bool` (core/params)
- Produces:
  ```ts
  // core/state.ts
  export type EffectsState = Record<string, Params>
  export interface EffectInfo { id: string; params: ParamDef[] }
  export interface StateDefaults { generator: string; palette: string[]; effectDefs: EffectInfo[] }
  export function normalizeEffects(input: unknown, effectDefs: EffectInfo[]): EffectsState
  export interface PatternState { generator; seed; params; palette; locks; effects: EffectsState }
  // post/types.ts
  export interface RasterImage { width: number; height: number; data: Uint8ClampedArray }
  export interface EffectContext { pxPerUnit: number; seed: number; palette: string[] }
  export interface EffectDef { id: string; name: string; params: ParamDef[]; apply(img: RasterImage, params: Params, ctx: EffectContext): void }
  export function enabledParam(): ParamDef     // { type: 'toggle', key: 'enabled', label: 'Enabled', default: false }
  // post/index.ts
  export const EFFECTS: EffectDef[]            // Task 2~4에서 채움. 최종 [pixelate, blur, posterize, dither, halftone, grain]
  export function defaultEffects(defs?: EffectDef[]): EffectsState
  export function hasEnabledEffects(effects: EffectsState, defs?: EffectDef[]): boolean
  export function applyEffects(img: RasterImage, effects: EffectsState, ctx: EffectContext, defs?: EffectDef[]): void
  export function effectInfos(defs?: EffectDef[]): EffectInfo[]
  // post/testUtils.ts
  export function makeImage(width: number, height: number, fill?: [number, number, number]): RasterImage
  export function px(img: RasterImage, x: number, y: number): [number, number, number, number]
  export function setPx(img: RasterImage, x: number, y: number, rgb: [number, number, number]): void
  export function cloneImage(img: RasterImage): RasterImage
  export const CTX: EffectContext              // { pxPerUnit: 1, seed: 7, palette: ['#111111', '#e63b2e', '#f2a91e', '#f2f2f2'] }
  ```

- [ ] **Step 1: 테스트 작성**

`src/post/testUtils.ts`
```ts
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
```

`src/post/index.test.ts`
```ts
import { describe, it, expect } from 'vitest'
import type { EffectDef } from './types'
import { enabledParam } from './types'
import { EFFECTS, applyEffects, defaultEffects, hasEnabledEffects, effectInfos } from './index'
import { makeImage, CTX } from './testUtils'

const calls: string[] = []
const fake = (id: string): EffectDef => ({
  id,
  name: id,
  params: [enabledParam(), { type: 'range', key: 'amount', label: 'Amount', min: 0, max: 10, step: 1, default: 3 }],
  apply(img) {
    calls.push(id)
    img.data[0] = img.data[0] + 10
  },
})
const DEFS = [fake('a'), fake('b'), fake('c')]

describe('post registry', () => {
  it('defaultEffects has every id with its defaults', () => {
    expect(defaultEffects(DEFS)).toEqual({ a: { enabled: false, amount: 3 }, b: { enabled: false, amount: 3 }, c: { enabled: false, amount: 3 } })
    expect(effectInfos(DEFS).map((e) => e.id)).toEqual(['a', 'b', 'c'])
    for (const e of EFFECTS) expect(e.params[0]).toEqual(enabledParam())
  })
  it('hasEnabledEffects only when some effect is enabled', () => {
    const e = defaultEffects(DEFS)
    expect(hasEnabledEffects(e, DEFS)).toBe(false)
    e.b = { ...e.b, enabled: true }
    expect(hasEnabledEffects(e, DEFS)).toBe(true)
    expect(hasEnabledEffects({}, DEFS)).toBe(false)
  })
  it('applyEffects runs enabled effects in registry order and leaves the image alone otherwise', () => {
    const img = makeImage(2, 2, [100, 100, 100])
    calls.length = 0
    applyEffects(img, defaultEffects(DEFS), CTX, DEFS)
    expect(calls).toEqual([])
    expect(img.data[0]).toBe(100)
    const e = defaultEffects(DEFS)
    e.c = { ...e.c, enabled: true }
    e.a = { ...e.a, enabled: true }
    applyEffects(img, e, CTX, DEFS)
    expect(calls).toEqual(['a', 'c'])
    expect(img.data[0]).toBe(120)
    expect(img.data[3]).toBe(255)
  })
  it('ignores ids that are not registered', () => {
    const img = makeImage(1, 1)
    calls.length = 0
    applyEffects(img, { zzz: { enabled: true } }, CTX, DEFS)
    expect(calls).toEqual([])
  })
})
```

`src/core/state.test.ts` 수정 — 상단에 가짜 효과 정의와 기본값을 추가하고 모든 `PatternState` 리터럴·기대값에 `effects`를 넣는다:
```ts
const FX_DEFS = [
  { id: 'fx', params: [{ type: 'toggle', key: 'enabled', label: 'Enabled', default: false }, { type: 'range', key: 'amount', label: 'Amount', min: 0, max: 10, step: 1, default: 3 }] as ParamDef[] },
]
const FX_DEFAULT = { fx: { enabled: false, amount: 3 } }
const defaults = { generator: 'a', palette: ['#000000', '#ffffff', '#ff0000', '#00ff00'], effectDefs: FX_DEFS }
```
- round-trip 상태: `effects: { fx: { enabled: true, amount: 8 } }`; `returns defaults` 기대값과 나머지 리터럴: `effects: FX_DEFAULT`(리터럴에는 `effects: { ...FX_DEFAULT }`).
- 테스트 추가:
```ts
  it('restores default effects for a hash without effects and clamps bad values', () => {
    const legacy = btoa(JSON.stringify({ generator: 'a', seed: 2, params: {}, palette: ['#000000', '#ffffff', '#ff0000'] }))
    expect(decodeState('#' + legacy, resolve, defaults).effects).toEqual(FX_DEFAULT)
    const hash = encodeState({ generator: 'a', seed: 2, params: {}, palette: ['#000000', '#ffffff', '#ff0000'], locks: emptyLocks(), effects: { fx: { enabled: true, amount: 99 }, zzz: { enabled: true } } })
    expect(decodeState(hash, resolve, defaults).effects).toEqual({ fx: { enabled: true, amount: 10 } })
  })
```
그리고 `normalizeEffects` 직접 테스트:
```ts
describe('normalizeEffects', () => {
  it('handles junk and partial input', () => {
    expect(normalizeEffects(undefined, FX_DEFS)).toEqual(FX_DEFAULT)
    expect(normalizeEffects('x', FX_DEFS)).toEqual(FX_DEFAULT)
    expect(normalizeEffects({ fx: 'bad' }, FX_DEFS)).toEqual(FX_DEFAULT)
    expect(normalizeEffects({ fx: { amount: 5 } }, FX_DEFS)).toEqual({ fx: { enabled: false, amount: 5 } })
  })
})
```

`src/generators/generators.test.ts`: `generateScene({ …, locks: emptyLocks() })` 리터럴에 `effects: {}` 추가.

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/post src/core/state.test.ts`
Expected: FAIL — `Cannot find module './index'`(post), state 테스트는 타입·기대값 불일치

- [ ] **Step 3: 구현**

`src/post/types.ts`
```ts
import type { ParamDef, Params } from '../core/params'

/** RGBA 픽셀 버퍼. ImageData가 이 형태를 만족한다 */
export interface RasterImage {
  width: number
  height: number
  data: Uint8ClampedArray
}

export interface EffectContext {
  /** 타일 unit → px 배율 (tilePx.w / scene.width) */
  pxPerUnit: number
  seed: number
  palette: string[]
}

export interface EffectDef {
  id: string
  name: string
  /** 첫 항목은 항상 enabledParam() */
  params: ParamDef[]
  /** 제자리(in-place) 수정. 알파는 255 유지 */
  apply(img: RasterImage, params: Params, ctx: EffectContext): void
}

export function enabledParam(): ParamDef {
  return { type: 'toggle', key: 'enabled', label: 'Enabled', default: false }
}
```

`src/post/index.ts`
```ts
import type { EffectInfo, EffectsState } from '../core/state'
import { bool, defaultParams } from '../core/params'
import type { EffectContext, EffectDef, RasterImage } from './types'

// Task 2~4에서 import를 추가하며 이 순서로 채운다: pixelate, blur, posterize, dither, halftone, grain
export const EFFECTS: EffectDef[] = []

export function defaultEffects(defs: EffectDef[] = EFFECTS): EffectsState {
  const out: EffectsState = {}
  for (const e of defs) out[e.id] = defaultParams(e.params)
  return out
}

export function effectInfos(defs: EffectDef[] = EFFECTS): EffectInfo[] {
  return defs.map((e) => ({ id: e.id, params: e.params }))
}

export function hasEnabledEffects(effects: EffectsState, defs: EffectDef[] = EFFECTS): boolean {
  return defs.some((e) => effects[e.id] !== undefined && bool(effects[e.id], 'enabled'))
}

/** 켜진 효과를 등록 순서대로 제자리 적용한다 */
export function applyEffects(img: RasterImage, effects: EffectsState, ctx: EffectContext, defs: EffectDef[] = EFFECTS): void {
  for (const e of defs) {
    const p = effects[e.id]
    if (p && bool(p, 'enabled')) e.apply(img, p, ctx)
  }
}
```

`src/core/state.ts` 수정:
- `PatternState`에 `effects: EffectsState` 추가. 타입·인터페이스 추가:
```ts
export type EffectsState = Record<string, Params>
export interface EffectInfo { id: string; params: ParamDef[] }
export interface StateDefaults { generator: string; palette: string[]; effectDefs: EffectInfo[] }

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
```
- `decodeState`: `base`에 `effects: normalizeEffects(undefined, defaults.effectDefs)`, 반환 객체에 `effects: normalizeEffects(obj.effects, defaults.effectDefs)`.

`src/generators/index.ts`: `export const DEFAULT_GENERATOR_ID = 'zigzag'`.

`src/App.tsx`: `import { effectInfos } from './post'` 추가하고 `decodeState(..., { generator: DEFAULT_GENERATOR_ID, palette: DEFAULT_PALETTE, effectDefs: effectInfos() })`. (효과 상태의 UI 연결은 Task 5·6.)

- [ ] **Step 4: 통과 확인·전체 검증·커밋**

Run: `npx vitest run src/post src/core src/generators` → PASS. `npm test && npm run lint && npm run build` → 통과(`PatternState` 리터럴 누락이 tsc에 잡히면 `effects: {}`를 넣는다).

```bash
git add src/post src/core src/generators src/App.tsx
git commit -m "feat(post): 효과 엔진 골격·상태 통합, 기본 생성기 zigzag"
```

---

### Task 2: Blur, Grain

**Files:**
- Create: `src/post/blur.ts`, `src/post/blur.test.ts`, `src/post/grain.ts`, `src/post/grain.test.ts`
- Modify: `src/post/index.ts` (import + `EFFECTS`에 `blur`, `grain` 추가 — 최종 순서를 위해 지금은 `[blur, grain]`)

**Interfaces:**
- Produces: `export const blur: EffectDef` (id `'blur'`), `export const MAX_BLUR_PX = 64`, `export const grain: EffectDef` (id `'grain'`), `export function grainNoise(cx: number, cy: number, seed: number): number` (−1..1, 테스트용 export)

- [ ] **Step 1: 테스트 작성**

`src/post/blur.test.ts`
```ts
import { describe, it, expect } from 'vitest'
import type { RasterImage } from './types'
import { blur, MAX_BLUR_PX } from './blur'
import { makeImage, px, setPx, cloneImage, CTX } from './testUtils'

/** 검증용 느린 참조 구현: 경계를 감는 박스 블러 1회(가로 후 세로) */
function referenceBox(img: RasterImage, r: number): RasterImage {
  const out = cloneImage(img)
  const { width: w, height: h } = img
  const win = 2 * r + 1
  const tmp = cloneImage(img)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) for (let c = 0; c < 3; c++) {
    let s = 0
    for (let k = -r; k <= r; k++) s += img.data[(y * w + (((x + k) % w) + w) % w) * 4 + c]
    tmp.data[(y * w + x) * 4 + c] = s / win
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) for (let c = 0; c < 3; c++) {
    let s = 0
    for (let k = -r; k <= r; k++) s += tmp.data[((((y + k) % h) + h) % h) * w + x) * 4 + c]
    out.data[(y * w + x) * 4 + c] = s / win
  }
  return out
}

const run = (img: RasterImage, radius: number, pxPerUnit = 1) => blur.apply(img, { enabled: true, radius }, { ...CTX, pxPerUnit })

describe('blur', () => {
  it('leaves a uniform image unchanged', () => {
    const img = makeImage(8, 6, [10, 200, 30])
    run(img, 3)
    for (let y = 0; y < 6; y++) for (let x = 0; x < 8; x++) expect(px(img, x, y)).toEqual([10, 200, 30, 255])
  })
  it('does nothing when the radius rounds below one pixel', () => {
    const img = makeImage(4, 4)
    setPx(img, 1, 1, [255, 255, 255])
    const before = cloneImage(img)
    run(img, 0.5, 0.5)
    expect(img.data).toEqual(before.data)
  })
  it('matches a naive wrap-around box blur applied three times (±1)', () => {
    const img = makeImage(12, 9)
    setPx(img, 0, 0, [255, 0, 0])
    setPx(img, 11, 4, [0, 255, 0])
    setPx(img, 5, 8, [0, 0, 255])
    let ref = cloneImage(img)
    for (let i = 0; i < 3; i++) ref = referenceBox(ref, 2)
    run(img, 2)
    for (let i = 0; i < img.data.length; i++) expect(Math.abs(img.data[i] - ref.data[i])).toBeLessThanOrEqual(1)
  })
  it('bleeds across the tile edge so repeats stay seamless', () => {
    const img = makeImage(16, 16)
    setPx(img, 0, 8, [255, 255, 255])
    run(img, 1)
    expect(px(img, 15, 8)[0]).toBeGreaterThan(0)
    expect(px(img, 8, 8)[0]).toBe(0)
  })
  it('preserves the mean and keeps alpha at 255', () => {
    const img = makeImage(10, 10)
    for (let x = 0; x < 10; x++) setPx(img, x, 3, [200, 100, 50])
    const mean = (im: RasterImage, c: number) => { let s = 0; for (let i = 0; i < 100; i++) s += im.data[i * 4 + c]; return s / 100 }
    const m0 = mean(img, 0)
    run(img, 2)
    expect(Math.abs(mean(img, 0) - m0)).toBeLessThan(1.5)
    for (let i = 0; i < 100; i++) expect(img.data[i * 4 + 3]).toBe(255)
  })
  it('caps the pixel radius', () => {
    expect(MAX_BLUR_PX).toBe(64)
    const img = makeImage(4, 4)
    expect(() => run(img, 32, 100)).not.toThrow()
  })
})
```

`src/post/grain.test.ts`
```ts
import { describe, it, expect } from 'vitest'
import { grain, grainNoise } from './grain'
import { makeImage, px, CTX } from './testUtils'

const run = (amount: number, size = 1, color = false, seed = 7, pxPerUnit = 1) => {
  const img = makeImage(32, 32, [128, 128, 128])
  grain.apply(img, { enabled: true, amount, size, color }, { ...CTX, seed, pxPerUnit })
  return img
}

describe('grainNoise', () => {
  it('is deterministic, in [-1, 1] and roughly centered', () => {
    let sum = 0
    for (let i = 0; i < 4000; i++) {
      const v = grainNoise(i % 64, Math.floor(i / 64), 11)
      expect(v).toBeGreaterThanOrEqual(-1)
      expect(v).toBeLessThanOrEqual(1)
      sum += v
    }
    expect(Math.abs(sum / 4000)).toBeLessThan(0.05)
    expect(grainNoise(3, 4, 5)).toBe(grainNoise(3, 4, 5))
    expect(grainNoise(3, 4, 5)).not.toBe(grainNoise(3, 4, 6))
  })
})

describe('grain', () => {
  it('is deterministic per seed and differs across seeds', () => {
    expect(run(50).data).toEqual(run(50).data)
    expect(run(50, 1, false, 7).data).not.toEqual(run(50, 1, false, 8).data)
  })
  it('never exceeds amount × 1.28 and averages near zero', () => {
    const img = run(100)
    let sum = 0
    for (let i = 0; i < 32 * 32; i++) {
      const d = img.data[i * 4] - 128
      expect(Math.abs(d)).toBeLessThanOrEqual(128)
      sum += d
    }
    // 시드가 고정이라 확률 검사가 아니다. 평균의 표준편차 ≈ 2.3이므로 12.8은 넉넉한 상한
    expect(Math.abs(sum / 1024)).toBeLessThan(128 * 0.1)
    const mild = run(10)
    for (let i = 0; i < 32 * 32; i++) expect(Math.abs(mild.data[i * 4] - 128)).toBeLessThanOrEqual(13)
  })
  it('amount 0 leaves the image unchanged and alpha stays 255', () => {
    const img = run(0)
    for (let i = 0; i < 32 * 32; i++) {
      expect(img.data[i * 4]).toBe(128)
      expect(img.data[i * 4 + 3]).toBe(255)
    }
  })
  it('size 4 makes 4×4 blocks share one value', () => {
    const img = run(60, 4)
    for (let by = 0; by < 8; by++) for (let bx = 0; bx < 8; bx++) {
      const v = px(img, bx * 4, by * 4)[0]
      for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) expect(px(img, bx * 4 + x, by * 4 + y)[0]).toBe(v)
    }
  })
  it('mono grain moves all channels together, color grain does not', () => {
    const mono = run(60)
    for (let i = 0; i < 32 * 32; i++) {
      expect(mono.data[i * 4]).toBe(mono.data[i * 4 + 1])
      expect(mono.data[i * 4]).toBe(mono.data[i * 4 + 2])
    }
    const col = run(60, 1, true)
    let differs = 0
    for (let i = 0; i < 32 * 32; i++) if (col.data[i * 4] !== col.data[i * 4 + 1]) differs++
    expect(differs).toBeGreaterThan(500)
  })
  it('scales grain size with pxPerUnit', () => {
    const img = run(60, 2, false, 7, 2)
    const v = px(img, 0, 0)[0]
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) expect(px(img, x, y)[0]).toBe(v)
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/post/blur.test.ts src/post/grain.test.ts` → FAIL `Cannot find module`

- [ ] **Step 3: 구현**

`src/post/blur.ts`
```ts
import type { EffectDef, RasterImage } from './types'
import { enabledParam } from './types'
import { num } from '../core/params'

export const MAX_BLUR_PX = 64

const mod = (i: number, n: number) => ((i % n) + n) % n

/**
 * 한 줄(행 또는 열)의 RGB 세 채널에 경계를 감는 박스 블러를 적용한다.
 * base: 첫 픽셀의 R 인덱스, step: 다음 픽셀까지의 인덱스 간격(행 4, 열 width*4), n: 줄 길이
 */
function blurLine(data: Uint8ClampedArray, tmp: Float32Array, base: number, step: number, n: number, r: number): void {
  const win = 2 * r + 1
  for (let c = 0; c < 3; c++) {
    let sum = 0
    for (let k = -r; k <= r; k++) sum += data[base + mod(k, n) * step + c]
    for (let i = 0; i < n; i++) {
      tmp[i] = sum / win
      sum += data[base + mod(i + r + 1, n) * step + c] - data[base + mod(i - r, n) * step + c]
    }
    for (let i = 0; i < n; i++) data[base + i * step + c] = tmp[i]
  }
}

/** 박스 블러 1회(가로 → 세로), 경계 감기 */
function boxBlur(img: RasterImage, r: number): void {
  const { width: w, height: h, data } = img
  const tmp = new Float32Array(Math.max(w, h))
  for (let y = 0; y < h; y++) blurLine(data, tmp, y * w * 4, 4, w, r)
  for (let x = 0; x < w; x++) blurLine(data, tmp, x * 4, w * 4, h, r)
}

export const blur: EffectDef = {
  id: 'blur',
  name: 'Blur',
  params: [
    enabledParam(),
    { type: 'range', key: 'radius', label: 'Radius', min: 0.5, max: 32, step: 0.5, default: 4 },
  ],
  apply(img, params, ctx) {
    const r = Math.min(MAX_BLUR_PX, Math.round(num(params, 'radius') * ctx.pxPerUnit))
    if (r < 1) return
    // 박스 블러 3회 ≈ 가우시안
    for (let pass = 0; pass < 3; pass++) boxBlur(img, r)
  },
}
```

`src/post/grain.ts`
```ts
import type { EffectDef } from './types'
import { enabledParam } from './types'
import { bool, num } from '../core/params'

/** 정수 해시 → [-1, 1]. 같은 (cx, cy, seed)면 항상 같은 값 */
export function grainNoise(cx: number, cy: number, seed: number): number {
  let h = (Math.imul(cx, 0x9e3779b1) ^ Math.imul(cy, 0x85ebca77) ^ Math.imul(seed, 0xc2b2ae3d)) >>> 0
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d)
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39)
  h ^= h >>> 15
  return ((h >>> 0) / 4294967296) * 2 - 1
}

export const grain: EffectDef = {
  id: 'grain',
  name: 'Grain',
  params: [
    enabledParam(),
    { type: 'range', key: 'amount', label: 'Amount', min: 0, max: 100, step: 1, default: 30 },
    { type: 'range', key: 'size', label: 'Grain size', min: 1, max: 8, step: 1, default: 1 },
    { type: 'toggle', key: 'color', label: 'Color grain', default: false },
  ],
  apply(img, params, ctx) {
    const maxDelta = num(params, 'amount') * 1.28
    if (maxDelta <= 0) return
    const s = Math.max(1, Math.round(num(params, 'size') * ctx.pxPerUnit))
    const color = bool(params, 'color')
    const { width: w, height: h, data } = img
    for (let y = 0; y < h; y++) {
      const cy = Math.floor(y / s)
      for (let x = 0; x < w; x++) {
        const cx = Math.floor(x / s)
        const i = (y * w + x) * 4
        if (color) {
          for (let c = 0; c < 3; c++) data[i + c] = data[i + c] + grainNoise(cx, cy, ctx.seed + 1 + c) * maxDelta
        } else {
          const d = grainNoise(cx, cy, ctx.seed) * maxDelta
          data[i] = data[i] + d
          data[i + 1] = data[i + 1] + d
          data[i + 2] = data[i + 2] + d
        }
      }
    }
  },
}
```
(`Uint8ClampedArray` 대입이 반올림·클램프를 처리한다. 반올림 때문에 세 채널이 같은 delta를 받으면 같은 값이 된다.)

`src/post/index.ts`: `import { blur } from './blur'`, `import { grain } from './grain'`, `export const EFFECTS: EffectDef[] = [blur, grain]`.

- [ ] **Step 4: 통과 확인·커밋**

Run: `npx vitest run src/post` → PASS. `npm test && npm run lint && npm run build` → 통과.

```bash
git add src/post
git commit -m "feat(post): blur(경계 감기 박스 블러×3), grain(결정적 해시 노이즈)"
```

---

### Task 3: Pixelate, Posterize, Dither

**Files:**
- Create: `src/post/pixelate.ts`(+test), `src/post/posterize.ts`(+test), `src/post/dither.ts`(+test)
- Modify: `src/post/index.ts` — `EFFECTS = [pixelate, blur, posterize, dither, grain]`

**Interfaces:**
- Produces: `export const pixelate: EffectDef` (id `'pixelate'`), `export const posterize: EffectDef` (id `'posterize'`), `export const dither: EffectDef` (id `'dither'`), `export function bayerMatrix(size: 2 | 4 | 8): number[][]`

- [ ] **Step 1: 테스트 작성**

`src/post/pixelate.test.ts`
```ts
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
```

`src/post/posterize.test.ts`
```ts
import { describe, it, expect } from 'vitest'
import { posterize } from './posterize'
import { makeImage, setPx, CTX } from './testUtils'

function gradient(): ReturnType<typeof makeImage> {
  const img = makeImage(256, 1)
  for (let x = 0; x < 256; x++) setPx(img, x, 0, [x, 255 - x, x])
  return img
}

describe('posterize', () => {
  it('limits each channel to `levels` distinct values, keeping 0 and 255', () => {
    for (const levels of [2, 3, 4, 8, 16]) {
      const img = gradient()
      posterize.apply(img, { enabled: true, levels }, CTX)
      const values = new Set<number>()
      for (let x = 0; x < 256; x++) values.add(img.data[x * 4])
      expect(values.size).toBe(levels)
      expect(values.has(0)).toBe(true)
      expect(values.has(255)).toBe(true)
    }
  })
  it('is monotonic', () => {
    const img = gradient()
    posterize.apply(img, { enabled: true, levels: 5 }, CTX)
    for (let x = 1; x < 256; x++) expect(img.data[x * 4]).toBeGreaterThanOrEqual(img.data[(x - 1) * 4])
  })
})
```

`src/post/dither.test.ts`
```ts
import { describe, it, expect } from 'vitest'
import { dither, bayerMatrix } from './dither'
import { makeImage, px, CTX } from './testUtils'

describe('bayerMatrix', () => {
  it('builds the standard matrices', () => {
    expect(bayerMatrix(2)).toEqual([[0, 2], [3, 1]])
    const m4 = bayerMatrix(4)
    expect(m4.flat().sort((a, b) => a - b)).toEqual(Array.from({ length: 16 }, (_, i) => i))
    expect(m4[0]).toEqual([0, 8, 2, 10])
    expect(bayerMatrix(8).flat().sort((a, b) => a - b)).toEqual(Array.from({ length: 64 }, (_, i) => i))
  })
})

describe('dither', () => {
  it('outputs only the level set', () => {
    const img = makeImage(16, 16)
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) img.data[(y * 16 + x) * 4] = x * 16
    dither.apply(img, { enabled: true, levels: 3, matrix: '4' }, CTX)
    for (let i = 0; i < 256; i++) expect([0, 128, 255]).toContain(img.data[i * 4])
  })
  it('turns 50 % grey into about half black, half white at two levels', () => {
    const img = makeImage(16, 16, [128, 128, 128])
    dither.apply(img, { enabled: true, levels: 2, matrix: '4' }, CTX)
    let white = 0
    for (let i = 0; i < 256; i++) if (img.data[i * 4] === 255) white++
    expect(Math.abs(white - 128)).toBeLessThanOrEqual(16)
  })
  it('repeats with the matrix period', () => {
    const img = makeImage(16, 8, [100, 100, 100])
    dither.apply(img, { enabled: true, levels: 2, matrix: '4' }, CTX)
    for (let y = 0; y < 8; y++) for (let x = 0; x < 16; x++) expect(px(img, x, y)).toEqual(px(img, x % 4, y % 4))
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/post/pixelate.test.ts src/post/posterize.test.ts src/post/dither.test.ts` → FAIL `Cannot find module`

- [ ] **Step 3: 구현**

`src/post/pixelate.ts`
```ts
import type { EffectDef } from './types'
import { enabledParam } from './types'
import { num } from '../core/params'

export const pixelate: EffectDef = {
  id: 'pixelate',
  name: 'Pixelate',
  params: [enabledParam(), { type: 'range', key: 'block', label: 'Block size', min: 2, max: 64, step: 1, default: 8 }],
  apply(img, params, ctx) {
    const b = Math.max(1, Math.round(num(params, 'block') * ctx.pxPerUnit))
    const { width: w, height: h, data } = img
    for (let by = 0; by < h; by += b) {
      const y1 = Math.min(h, by + b)
      for (let bx = 0; bx < w; bx += b) {
        const x1 = Math.min(w, bx + b)
        let r = 0, g = 0, bl = 0, n = 0
        for (let y = by; y < y1; y++) for (let x = bx; x < x1; x++) {
          const i = (y * w + x) * 4
          r += data[i]; g += data[i + 1]; bl += data[i + 2]; n++
        }
        const R = r / n, G = g / n, B = bl / n
        for (let y = by; y < y1; y++) for (let x = bx; x < x1; x++) {
          const i = (y * w + x) * 4
          data[i] = R; data[i + 1] = G; data[i + 2] = B
        }
      }
    }
  },
}
```

`src/post/posterize.ts`
```ts
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
```

`src/post/dither.ts`
```ts
import type { EffectDef } from './types'
import { enabledParam } from './types'
import { num, str } from '../core/params'

/** Bayer 임계 행렬: M1 = [[0]], M2n = [[4M, 4M+2], [4M+3, 4M+1]] */
export function bayerMatrix(size: 2 | 4 | 8): number[][] {
  let m: number[][] = [[0]]
  while (m.length < size) {
    const n = m.length
    const next: number[][] = Array.from({ length: 2 * n }, () => Array<number>(2 * n).fill(0))
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const v = 4 * m[y][x]
      next[y][x] = v
      next[y][x + n] = v + 2
      next[y + n][x] = v + 3
      next[y + n][x + n] = v + 1
    }
    m = next
  }
  return m
}

export const dither: EffectDef = {
  id: 'dither',
  name: 'Dither',
  params: [
    enabledParam(),
    { type: 'range', key: 'levels', label: 'Levels', min: 2, max: 8, step: 1, default: 2 },
    {
      type: 'select', key: 'matrix', label: 'Matrix', default: '4',
      options: [{ value: '2', label: '2 × 2' }, { value: '4', label: '4 × 4' }, { value: '8', label: '8 × 8' }],
    },
  ],
  apply(img, params) {
    const L = num(params, 'levels')
    const size = Number(str(params, 'matrix')) as 2 | 4 | 8
    const m = bayerMatrix(size)
    const cells = size * size
    const { width: w, height: h, data } = img
    for (let y = 0; y < h; y++) {
      const row = m[y % size]
      for (let x = 0; x < w; x++) {
        const t = (row[x % size] + 0.5) / cells - 0.5
        const i = (y * w + x) * 4
        for (let c = 0; c < 3; c++) {
          const q = (data[i + c] / 255) * (L - 1)
          const k = Math.min(L - 1, Math.max(0, Math.round(q + t)))
          data[i + c] = Math.round((k / (L - 1)) * 255)
        }
      }
    }
  },
}
```

`src/post/index.ts`: import 추가, `EFFECTS = [pixelate, blur, posterize, dither, grain]`.

- [ ] **Step 4: 통과 확인·커밋**

Run: `npx vitest run src/post` → PASS. `npm test && npm run lint && npm run build` → 통과.

```bash
git add src/post
git commit -m "feat(post): pixelate, posterize, dither(Bayer 순서 디더링)"
```

---

### Task 4: Halftone

**Files:**
- Create: `src/post/halftone.ts`, `src/post/halftone.test.ts`
- Modify: `src/post/index.ts` — 최종 `EFFECTS = [pixelate, blur, posterize, dither, halftone, grain]`

**Interfaces:**
- Consumes: `parseHex` (core/color)
- Produces: `export const halftone: EffectDef` (id `'halftone'`), `export function inkAndPaper(palette: string[]): { ink: [number, number, number]; paper: [number, number, number] }`

- [ ] **Step 1: 테스트 작성**

`src/post/halftone.test.ts`
```ts
import { describe, it, expect } from 'vitest'
import { halftone, inkAndPaper } from './halftone'
import { makeImage, px, CTX } from './testUtils'

const INK: [number, number, number] = [17, 17, 17]      // #111111
const PAPER: [number, number, number] = [242, 242, 242]  // #f2f2f2
const run = (fill: [number, number, number], mode = 'ink', cell = 8) => {
  const img = makeImage(32, 32, fill)
  halftone.apply(img, { enabled: true, cell, mode }, CTX)
  return img
}
const inkCount = (img: ReturnType<typeof makeImage>) => {
  let n = 0
  for (let i = 0; i < 32 * 32; i++) if (img.data[i * 4] === INK[0] && img.data[i * 4 + 1] === INK[1]) n++
  return n
}

describe('inkAndPaper', () => {
  it('picks the darkest and lightest palette colors', () => {
    expect(inkAndPaper(CTX.palette)).toEqual({ ink: INK, paper: PAPER })
    expect(inkAndPaper([])).toEqual({ ink: [0, 0, 0], paper: [255, 255, 255] })
  })
})

describe('halftone', () => {
  it('white becomes all paper, black becomes all ink', () => {
    const white = run([255, 255, 255])
    for (let i = 0; i < 32 * 32; i++) expect([white.data[i * 4], white.data[i * 4 + 1], white.data[i * 4 + 2]]).toEqual(PAPER)
    const black = run([0, 0, 0])
    expect(inkCount(black)).toBe(32 * 32)
  })
  it('ink coverage grows monotonically as the source gets darker', () => {
    const counts = [240, 200, 160, 120, 80, 40].map((v) => inkCount(run([v, v, v])))
    for (let i = 1; i < counts.length; i++) expect(counts[i]).toBeGreaterThan(counts[i - 1])
  })
  it('ink mode uses exactly two colors', () => {
    const img = run([120, 60, 200])
    const colors = new Set<string>()
    for (let i = 0; i < 32 * 32; i++) colors.add(`${img.data[i * 4]},${img.data[i * 4 + 1]},${img.data[i * 4 + 2]}`)
    expect(colors.size).toBe(2)
  })
  it('color mode paints dots in the cell average color on paper', () => {
    const img = run([200, 40, 40], 'color')
    const center = px(img, 4, 4)
    expect([center[0], center[1], center[2]]).toEqual([200, 40, 40])
    const corner = px(img, 0, 0)
    expect([corner[0], corner[1], corner[2]]).toEqual(PAPER)
  })
  it('aligns cells to the tile origin and handles partial cells', () => {
    const img = makeImage(20, 12, [0, 0, 0])
    halftone.apply(img, { enabled: true, cell: 8, mode: 'ink' }, CTX)
    expect(inkCount(img)).toBe(20 * 12)
    expect(img.data[3]).toBe(255)
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/post/halftone.test.ts` → FAIL `Cannot find module`

- [ ] **Step 3: 구현**

`src/post/halftone.ts`
```ts
import type { EffectDef } from './types'
import { enabledParam } from './types'
import { num, str } from '../core/params'
import { parseHex } from '../core/color'

type Rgb3 = [number, number, number]
const luma = (r: number, g: number, b: number) => (0.299 * r + 0.587 * g + 0.114 * b) / 255

/** 팔레트에서 가장 어두운 색(잉크)과 가장 밝은 색(종이) */
export function inkAndPaper(palette: string[]): { ink: Rgb3; paper: Rgb3 } {
  let ink: Rgb3 = [0, 0, 0]
  let paper: Rgb3 = [255, 255, 255]
  let lo = Infinity
  let hi = -Infinity
  for (const hex of palette) {
    const c = parseHex(hex)
    if (!c) continue
    const l = luma(c.r, c.g, c.b)
    if (l < lo) { lo = l; ink = [c.r, c.g, c.b] }
    if (l > hi) { hi = l; paper = [c.r, c.g, c.b] }
  }
  return { ink, paper }
}

export const halftone: EffectDef = {
  id: 'halftone',
  name: 'Halftone',
  params: [
    enabledParam(),
    { type: 'range', key: 'cell', label: 'Cell size', min: 2, max: 32, step: 1, default: 8 },
    { type: 'select', key: 'mode', label: 'Dots', default: 'ink', options: [{ value: 'ink', label: 'Ink' }, { value: 'color', label: 'Color' }] },
  ],
  apply(img, params, ctx) {
    const c = Math.max(2, Math.round(num(params, 'cell') * ctx.pxPerUnit))
    const colorMode = str(params, 'mode') === 'color'
    const { ink, paper } = inkAndPaper(ctx.palette)
    const { width: w, height: h, data } = img
    const src = new Uint8ClampedArray(data)
    for (let by = 0; by < h; by += c) {
      const y1 = Math.min(h, by + c)
      for (let bx = 0; bx < w; bx += c) {
        const x1 = Math.min(w, bx + c)
        let r = 0, g = 0, b = 0, n = 0
        for (let y = by; y < y1; y++) for (let x = bx; x < x1; x++) {
          const i = (y * w + x) * 4
          r += src[i]; g += src[i + 1]; b += src[i + 2]; n++
        }
        const R = r / n, G = g / n, B = b / n
        const a = 1 - luma(R, G, B)                 // 잉크 면적 비율
        const radius = 0.7071 * c * Math.sqrt(a)    // a = 1이면 셀 모서리까지 덮는다
        const cx = (bx + x1) / 2, cy = (by + y1) / 2
        const dot: Rgb3 = colorMode ? [R, G, B] : ink
        for (let y = by; y < y1; y++) for (let x = bx; x < x1; x++) {
          const dx = x + 0.5 - cx, dy = y + 0.5 - cy
          const i = (y * w + x) * 4
          // radius 0(흰색)이면 홀수 셀의 중심 픽셀도 종이로 남긴다
          const on = radius > 0 && dx * dx + dy * dy <= radius * radius
          const col = on ? dot : paper
          data[i] = col[0]; data[i + 1] = col[1]; data[i + 2] = col[2]
        }
      }
    }
  },
}
```
(color 모드 테스트의 `[200, 40, 40]` 기대값: 평균은 정확히 원본이므로 반올림 후 동일.)

`src/post/index.ts`: import 추가, `EFFECTS = [pixelate, blur, posterize, dither, halftone, grain]`.

- [ ] **Step 4: 통과 확인·커밋**

Run: `npx vitest run src/post` → PASS. `npm test && npm run lint && npm run build` → 통과.

```bash
git add src/post
git commit -m "feat(post): halftone(잉크/컬러 점, 팔레트 극값 잉크·종이) — 효과 6종 완성"
```

---

### Task 5: 렌더러·내보내기·App 연결

**Files:**
- Modify: `src/render/canvas.ts`, `src/render/export.ts`, `src/render/export.test.ts`, `src/ui/Preview.tsx`, `src/ui/ExportDialog.tsx`, `src/App.tsx`

**Interfaces:**
- Consumes: `applyEffects`, `hasEnabledEffects` (post/index); `EffectsState` (core/state)
- Produces:
  ```ts
  // render/canvas.ts
  export interface PostOptions { effects: EffectsState; seed: number; palette: string[] }
  export function renderTile(scene, tilePx, ctx, post?: PostOptions): void
  export function renderFill(scene, tilePx, ctx, w, h, origin?, post?: PostOptions): boolean
  // render/export.ts
  export function renderForExport(scene, settings, post?: PostOptions): HTMLCanvasElement
  export async function exportImage(scene, generator, seed, settings, post?: PostOptions): Promise<void>
  // ui/Preview.tsx, ui/ExportDialog.tsx — prop `post: PostOptions`
  // App.tsx — const post: PostOptions (useMemo)
  ```

- [ ] **Step 1: canvas.ts**

`src/render/canvas.ts` — import 추가 `import type { EffectsState } from '../core/state'`, `import { applyEffects, hasEnabledEffects } from '../post'`. 타입과 `renderTile` 끝부분:
```ts
export interface PostOptions {
  effects: EffectsState
  seed: number
  palette: string[]
}

export function renderTile(scene: Scene, tilePx: TilePx, ctx: CanvasRenderingContext2D, post?: PostOptions): void {
  // …기존 도형 그리기 그대로… ctx.restore() 뒤에:
  if (post && hasEnabledEffects(post.effects)) {
    const img = ctx.getImageData(0, 0, tilePx.w, tilePx.h)
    applyEffects(img, post.effects, { pxPerUnit: tilePx.w / scene.width, seed: post.seed, palette: post.palette })
    ctx.putImageData(img, 0, 0)
  }
}
```
`renderFill(scene, tilePx, ctx, w, h, origin = { x: 0, y: 0 }, post?: PostOptions)`는 `renderTile(scene, tilePx, tctx, post)`로 넘긴다.

- [ ] **Step 2: export.ts + 테스트**

`renderForExport(scene, settings, post?: PostOptions)`: 두 분기 모두 `post`를 넘긴다. `exportImage(scene, generator, seed, settings, post?)`도 `renderForExport(scene, settings, post)`로. `export.test.ts`의 기존 `renderForExport` throw 테스트는 인자를 추가하지 않아도 통과해야 한다(옵션). 테스트 하나 추가:
```ts
  it('renderForExport still refuses oversized output when post options are given', () => {
    expect(() => renderForExport(scene, { format: 'png', mode: 'tile', scale: 100, width: 0, height: 0 }, { effects: {}, seed: 1, palette: [] })).toThrow(/8192/)
  })
```

- [ ] **Step 3: Preview·ExportDialog·App**

`src/ui/Preview.tsx`: `import type { PostOptions } from '../render/canvas'`; `Props`에 `post: PostOptions`; 두 `renderFill` 호출에 마지막 인자로 `post`(fill 분기는 `renderFill(scene, tilePx, ctx, canvas.width, canvas.height, { x: 0, y: 0 }, post)`); effect 의존성 `[scene, view, scale, theme, post]`.

`src/ui/ExportDialog.tsx`: `Props`에 `post: PostOptions`; `exportImage(scene, generator, seed, settings, post)`.

`src/App.tsx` (이 Task에서는 `post` 객체만 추가한다. 효과 값 핸들러는 소비자인 `EffectsPanel`과 함께 Task 6에서 넣는다 — 먼저 넣으면 미사용 변수로 빌드가 실패한다):
```tsx
import type { PostOptions } from './render/canvas'
// …App 본문, tilePx 계산 근처:
  const post: PostOptions = useMemo(
    () => ({ effects: pattern.effects, seed: pattern.seed, palette: pattern.palette }),
    [pattern.effects, pattern.seed, pattern.palette],
  )
```
`<Preview … post={post} />`, `<ExportDialog … post={post} />`.

- [ ] **Step 4: 검증·브라우저 스모크·커밋**

Run: `npm test && npm run lint && npm run build` → 통과.
브라우저(`npm run dev`, Playwright): UI가 아직 없으므로 URL 해시로 효과를 켠다. `browser_evaluate`로 현재 해시를 디코드(base64url JSON)해 `effects.grain = { enabled: true, amount: 80, size: 1, color: false }`, `effects.blur = { enabled: true, radius: 4 }`로 바꿔 다시 인코딩한 뒤 그 URL로 이동한다. 확인: (a) 캔버스 지문이 효과 없을 때와 다르다 (b) 3×3 뷰에서 경계 양쪽 픽셀이 연속(그레인은 타일마다 같은 무늬, 블러는 경계에서 끊김 없음) (c) 콘솔 오류 0 (d) 빈 URL로 접속하면 드롭다운이 Zigzag. 스크린샷은 Task 7에서.

```bash
git add src/render src/ui/Preview.tsx src/ui/ExportDialog.tsx src/App.tsx
git commit -m "feat(render): 타일 렌더 후 효과 체인 적용, 미리보기·내보내기 연결"
```

---

### Task 6: Effects 패널

**Files:**
- Create: `src/ui/EffectsPanel.tsx`
- Modify: `src/ui/ParamControl.tsx`, `src/ui/ControlPanel.tsx`, `src/App.tsx`, `src/styles.css`

**Interfaces:**
- Produces:
  ```ts
  // ui/ParamControl.tsx — props 변경
  interface Props { def; value; onChange; onRandomize; lockable?: boolean /* 기본 true */; locked?: boolean; onToggleLock?(): void }
  // ui/EffectsPanel.tsx
  export function EffectsPanel(props: { effects: EffectsState; onParamChange(id: string, key: string, value: ParamValue): void; onRandomizeParam(id: string, key: string): void })
  // ui/ControlPanel.tsx — prop 추가 `effectsOn: number`
  ```

- [ ] **Step 1: ParamControl에 lockable**

`Props`를 `locked?: boolean`, `onToggleLock?(): void`, `lockable?: boolean`로 바꾸고 함수 시그니처를 `({ def, value, locked = false, onChange, onToggleLock = () => {}, onRandomize, lockable = true }: Props)`로. `HeadProps`에 `lockable: boolean` 추가, `ControlHead`는 `{lockable ? <LockButton … /> : null}`. `head` 객체에 `lockable` 포함. `cls`는 `lockable && locked`일 때만 `locked`.

- [ ] **Step 2: EffectsPanel**

`src/ui/EffectsPanel.tsx`
```tsx
import type { ParamValue } from '../core/params'
import { bool, defaultParams } from '../core/params'
import type { EffectsState } from '../core/state'
import { EFFECTS } from '../post'
import { ParamControl } from './ParamControl'

interface Props {
  effects: EffectsState
  onParamChange(id: string, key: string, value: ParamValue): void
  onRandomizeParam(id: string, key: string): void
}

export function EffectsPanel({ effects, onParamChange, onRandomizeParam }: Props) {
  return (
    <section className="panel-section">
      <h2>Effects</h2>
      <div className="info">Applied top to bottom</div>
      {EFFECTS.map((def) => {
        const p = effects[def.id] ?? defaultParams(def.params)
        const enabled = bool(p, 'enabled')
        return (
          <div key={def.id} className={`effect${enabled ? ' on' : ''}`}>
            <label className="effect-head">
              <input type="checkbox" checked={enabled} onChange={(e) => onParamChange(def.id, 'enabled', e.target.checked)} />
              <span>{def.name}</span>
            </label>
            {enabled ? (
              <div className="effect-body">
                {def.params
                  .filter((d) => d.key !== 'enabled')
                  .map((d) => (
                    <ParamControl
                      key={d.key}
                      def={d}
                      value={p[d.key] ?? d.default}
                      lockable={false}
                      onChange={(v) => onParamChange(def.id, d.key, v)}
                      onRandomize={() => onRandomizeParam(def.id, d.key)}
                    />
                  ))}
              </div>
            ) : null}
          </div>
        )
      })}
    </section>
  )
}
```

- [ ] **Step 3: ControlPanel·App·CSS**

`ControlPanel`: `effectsOn: number` prop 추가, Output 섹션에 `<div className="info">Effects: {effectsOn} on</div>`.

`App.tsx`: import에 `bool`(core/params), `EFFECTS`(./post — `effectInfos`와 같은 줄), `EffectsPanel` 추가. `randomizeParam` 아래에 핸들러 두 개와 켜진 효과 수:
```tsx
  // 후처리 값: 잠금·Randomize와 무관하므로 locks를 건드리지 않는다
  const setEffectParam = (id: string, key: string, value: ParamValue) =>
    setPattern((p) => ({ ...p, effects: { ...p.effects, [id]: { ...p.effects[id], [key]: value } } }))
  const randomizeEffectParam = (id: string, key: string) =>
    setPattern((p) => {
      const def = EFFECTS.find((e) => e.id === id)?.params.find((d) => d.key === key)
      if (!def) return p
      return { ...p, effects: { ...p.effects, [id]: { ...p.effects[id], [key]: randomParamValue(def, mulberry32(randomSeed())) } } }
    })
  const effectsOn = EFFECTS.filter((e) => bool(pattern.effects[e.id] ?? {}, 'enabled')).length
```
`<ControlPanel … effectsOn={effectsOn}>` 안에서 `<PalettePanel …/>` 다음에:
```tsx
          <EffectsPanel effects={pattern.effects} onParamChange={setEffectParam} onRandomizeParam={randomizeEffectParam} />
```

`styles.css` 추가:
```css
/* effects */
.effect { margin-bottom: 6px; }
.effect-head { display: flex; align-items: center; gap: 8px; cursor: pointer; padding: 4px 0; }
.effect-head input { margin: 0; }
.effect.on .effect-head span { color: var(--text); }
.effect-head span { color: var(--muted); }
.effect-body { margin: 2px 0 6px 6px; padding-left: 12px; border-left: 2px solid var(--border); }
```

- [ ] **Step 4: 검증·브라우저·커밋**

Run: `npm test && npm run lint && npm run build` → 통과.
브라우저: (a) Effects 섹션에 6개 효과가 pixelate, blur, posterize, dither, halftone, grain 순으로 보이고 기본은 모두 꺼짐 (b) Grain 체크 → amount/size/color 컨트롤이 펼쳐지고 🎲만 있고 🔒 없음 (c) 값을 바꾸면 미리보기가 즉시 바뀐다 (d) 상단 Randomize를 눌러도 effects 값·켜짐 상태가 그대로(URL 해시 디코드로 확인) (e) 개별 🎲로 amount가 바뀐다 (f) Output에 "Effects: 1 on" (g) 새로고침 후 유지 (h) 패널에 가로 스크롤 없음. 콘솔 오류 0.

```bash
git add src/ui src/App.tsx src/styles.css
git commit -m "feat(ui): Effects 패널 — 효과별 켜기·값 컨트롤(개별 🎲), Output에 효과 수"
```

---

### Task 7: 검증, 스크린샷, README, 재배포

**Files:**
- Modify: `README.md`, `docs/superpowers/specs/2026-09-16-jacquard-design.md`(9절 배포 줄 한 줄)
- Create: `docs/screenshots/effects-grain-blur.png`, `docs/screenshots/effects-halftone.png`

- [ ] **Step 1: 브라우저 검증**

1440×1024, 새 컨텍스트: (1) 빈 URL → Zigzag + Missoni Blue (2) 효과 6종 각각 켜고 시각 확인(Blur 흐림, Grain 입자, Pixelate 모자이크, Posterize 계단, Dither 점 패턴, Halftone 점) (3) Blur 6 + Grain 40을 켠 3×3 뷰에서 경계 좌우 픽셀이 연속 (4) 내보내기: Posterize levels 2 켜고 PNG 타일 내보내기 → 저장 파일을 읽어 고유 색 수가 8 이하 (5) Copy link → 새 탭에서 효과 상태 복원 (6) Randomize·Unlock all이 effects 불변 (7) 배율 1과 4에서 Grain size 2의 입자가 같은 비율로 보인다(픽셀 블록 크기 2 vs 8).

- [ ] **Step 2: 스크린샷**

`docs/screenshots/effects-grain-blur.png`: Zigzag + Missoni Blue, Blur radius 2, Grain amount 45 size 2, Fill 뷰, Effects 섹션이 보이도록 패널 스크롤. `docs/screenshots/effects-halftone.png`: Gradient Bars + Boogie 프리셋(Unlock all 후), Halftone cell 8 ink. 둘 다 라이트 테마 1440×1024.

- [ ] **Step 3: README (영문·한국어 동일)**

- `## What is Jacquard?` 첫 문단에 "It opens with the Zigzag generator" 한 문장, 둘째 문단에 후처리 한 문장(타일 단위로 적용되어 미리보기와 내보내기가 같고 이음새가 유지된다).
- `## Screenshots`에 행 추가: `Effects — grain + blur` / `Effects — halftone`.
- `## Features` 불릿 추가: **Post-processing effects** — six raster effects applied to the tile in a fixed order (pixelate → blur → posterize → dither → halftone → grain); sizes are in tile units so exports match the preview; blur wraps around the tile edge so repeats stay seamless; grain is seeded and deterministic.
- `## Controls` 표: `Effects section` 행(체크박스로 켜고, 값은 슬라이더·선택, 🎲로 그 값만 무작위; Randomize는 효과를 건드리지 않음).
- `## How a tile is built`에 후처리 단계 한 줄.
- `## Known limitations`: 효과는 래스터 전용(향후 SVG 내보내기에서는 Blur·Grain만 필터로 대응 가능), 순서 디더링만(오차 확산 없음), 블러 반지름 64px 상한, Pixelate·Halftone 격자는 타일 원점 기준이라 타일 크기의 약수를 권장.
- 한국어 절 동일하게. 프로젝트 구조 트리에 `src/post/` 추가. 테스트 수는 실제 `npm test` 결과로.

- [ ] **Step 4: 재배포·커밋**

Run: `npm test && npm run lint && npm run build` → 통과. `npm run deploy` → 라이브에서 Zigzag 첫 화면, Effects 패널, Grain 동작 확인. 설계서(v1) 9절에 `- v1.2 배포: 2026-MM-DD (후처리 6종, 기본 생성기 Zigzag)` 한 줄.

```bash
git add README.md docs/screenshots docs/superpowers/specs/2026-09-16-jacquard-design.md
git commit -m "docs: v1.2 README·스크린샷(후처리), 배포 기록"
```

---

## 자체 검토 결과 (계획 작성자)

- 스펙 §3(파이프라인) → Task 5. §4(효과 정의·순서) → Task 1(골격) + 2·3·4. §4.1~4.6 매개변수 표와 각 Task의 `params`가 일치. §5(상태) → Task 1. §6(렌더러·내보내기) → Task 5. §7(UI) → Task 6. §8(기본 생성기) → Task 1 + Task 7 README. §9(검증) → 각 Task 테스트 + Task 7. §10 순서 = Task 1~7.
- 타입 일관성: `EffectsState`·`EffectInfo`는 `core/state.ts`에 정의하고 `post/index.ts`가 `import type`으로 가져온다(post → core 방향만). `PostOptions`는 `render/canvas.ts`에 정의하고 Preview·ExportDialog·App이 가져온다. `ParamControl`의 `locked`/`onToggleLock`을 선택 prop으로 바꾸므로 `ControlPanel`의 기존 호출은 그대로 동작한다.
- Task 5에서 App 핸들러 두 개를 미리 넣으면 미사용 변수로 빌드가 실패하므로 Task 6으로 미뤘다(계획서에 명시).
- 블러 테스트의 참조 구현은 별도 함수로 테스트 파일 안에 두어 최적화 구현의 회귀를 잡는다.
