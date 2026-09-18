# Jacquard v1.3 구현 계획 — Warp 효과 4종, Glyphs 생성기, 그레인 px, 보류 4건, jsdom 하네스

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 후처리 체인 맨 앞에 Warp 효과 그룹(Bands·Wave·Fold·Shade)을 넣어 반복 패턴을 2차 변조하고, 픽셀 글리프 생성기 Glyphs를 추가하며, 그레인을 출력 px 단위로 바꾸고, v1.2 보류 4건과 jsdom UI 테스트 하네스를 처리한다.

**Architecture:** Warp는 `src/post/resample.ts`의 감기(wrap) 리샘플러 위에 얹는 순수 픽셀 효과로, 기존 `EffectDef`/`applyEffects`를 그대로 쓴다(`group` 필드만 추가). Glyphs는 g×g 불리언 격자에 원시 도형 8종을 그리고 대칭을 적용한 뒤 가로 런을 rect로 병합하는 순수 생성기다. UI 테스트는 Vitest + jsdom + Testing Library로 `src/ui/*.test.tsx`에서 돌린다.

**Tech Stack:** 기존(Vite 8, React 19, TypeScript 6, Vitest 5, oxlint) + devDependencies `jsdom`, `@testing-library/react`, `@testing-library/dom`. 런타임 의존성 변화 없음.

**Spec:** `docs/superpowers/specs/2026-09-18-jacquard-warp-glyphs-design.md` (선행 v1·v1.1·v1.2 설계서). 실행자는 §3~§7을 먼저 읽는다.

## Global Constraints

- 작업 폴더 `C:\Users\JohnHB\jacquard`, 브랜치 `main`. 시작 기준: 248 tests / 28 files, `npm run lint`·`npm run build` 통과. 매 Task 종료 시 세 가지 모두 유지.
- 런타임 의존성 추가 금지(Task 6의 devDependencies 3개만 허용). `verbatimModuleSyntax`·`erasableSyntaxOnly`: 타입은 `import type`, `enum`/`namespace` 금지. `noUnusedLocals/Parameters`.
- `src/core/*`, `src/post/*`, `src/generators/*`는 DOM 참조 금지. `core`는 `post`/`generators`를 import하지 않는다.
- 효과는 RGB만 바꾸고 알파는 255. 크기 매개변수는 타일 unit × `pxPerUnit` — **예외: Grain `size`는 출력 px**(Task 4).
- `EFFECTS` 고정 순서: bands → wave → fold → shade → pixelate → blur → posterize → dither → halftone → grain. Warp 4종은 `group: 'warp'`, 기존 6종은 `'texture'`.
- Wave·Shade의 `periods`는 정수. Bands 이동은 정수 px(nearest), Wave는 bilinear.
- 효과는 Randomize·잠금 대상이 아니다(개별 🎲만). Glyphs 매개변수는 다른 생성기처럼 Randomize 대상.
- oxlint: `react/rules-of-hooks` 오류, `react/only-export-components` 경고, `react(set-state-in-effect)` 경고 0. `.tsx` 컴포넌트 파일에서 컴포넌트 외 export 금지.
- UI 문구 영어. 각 Task 종료 시 `npm test && npm run lint && npm run build` 후 커밋. 커밋: 한국어 제목 + 빈 줄 + 실행 세션 attribution 트레일러. 구현자는 push·deploy 금지.
- Windows(Git Bash). 한글이 든 파일은 heredoc 대신 파일 쓰기 도구로.

---

## 파일 구조

| 파일 | 책임 |
|---|---|
| `src/post/types.ts` | `EffectGroup`, `EffectDef.group` |
| `src/post/resample.ts` (+test) | 감기 리샘플러 nearest/bilinear |
| `src/post/wave.ts`, `bands.ts`, `fold.ts`, `shade.ts` (+각 test) | Warp 4종 |
| `src/post/index.ts` (+test) | 순서·그룹 |
| `src/post/grain.ts` (+test) | 출력 px 단위 |
| `src/post/halftone.ts` (+test), `pixelate.test.ts` | 부분 셀 반지름, 반올림·color 테스트 |
| `src/core/state.ts` (+test) | `encodeState(state, effectDefs?)` 기본값 생략 |
| `src/ui/ParamControl.tsx`, `EffectsPanel.tsx`, `styles.css` | `namePrefix`, 그룹 소제목 |
| `src/ui/EffectsPanel.test.tsx`, `ParamControl.test.tsx`, `ControlPanel.test.tsx` | jsdom UI 테스트 |
| `vite.config.ts`, `package.json` | 테스트 include, devDependencies |
| `src/generators/glyphs.ts` (+test), `src/generators/index.ts`, `generators.test.ts` | 새 생성기 |
| `src/App.tsx` | `encodeState(pattern, effectInfos())` |
| `README.md`, `docs/screenshots/*.png` | 문서 |

---

### Task 1: 리샘플러, 효과 그룹, 패널 소제목

**Files:**
- Create: `src/post/resample.ts`, `src/post/resample.test.ts`
- Modify: `src/post/types.ts`, `src/post/index.ts`, `src/post/index.test.ts`, 기존 효과 6파일(`group: 'texture'` 한 줄씩), `src/ui/EffectsPanel.tsx`, `src/styles.css`

**Interfaces:**
- Produces:
  ```ts
  // post/types.ts
  export type EffectGroup = 'warp' | 'texture'
  export interface EffectDef { id; name; group: EffectGroup; params; apply }
  // post/resample.ts
  export type SampleMode = 'nearest' | 'bilinear'
  export function resample(img: RasterImage, map: (x: number, y: number) => readonly [number, number], mode: SampleMode): void
  ```
- `EffectsPanel`은 `EFFECTS`를 `group`별로 묶어 `.group-title`("Warp", "Texture")을 붙인다. Task 1 시점에는 warp 그룹이 비어 있어 소제목이 렌더되지 않는다.

- [ ] **Step 1: 테스트 작성**

`src/post/resample.test.ts`
```ts
import { describe, it, expect } from 'vitest'
import { resample } from './resample'
import { makeImage, px, setPx, cloneImage } from './testUtils'

function ramp(w: number, h: number) {
  const img = makeImage(w, h)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) setPx(img, x, y, [(x * 37 + y * 11) % 256, (x * 5) % 256, (y * 9) % 256])
  return img
}

describe('resample', () => {
  it('nearest with an integer shift copies pixels exactly and wraps', () => {
    const src = ramp(8, 5)
    const img = cloneImage(src)
    resample(img, (x, y) => [x - 1, y + 2], 'nearest')
    for (let y = 0; y < 5; y++) for (let x = 0; x < 8; x++) expect(px(img, x, y)).toEqual(px(src, (x + 7) % 8, (y + 2) % 5))
  })
  it('wraps coordinates far outside the tile', () => {
    const src = ramp(6, 4)
    const img = cloneImage(src)
    resample(img, (x, y) => [x - 60, y + 12], 'nearest')
    expect(img.data).toEqual(src.data)
  })
  it('bilinear at a half-pixel offset averages neighbours', () => {
    const img = makeImage(4, 1)
    setPx(img, 0, 0, [0, 0, 0]); setPx(img, 1, 0, [100, 0, 0]); setPx(img, 2, 0, [200, 0, 0]); setPx(img, 3, 0, [0, 0, 0])
    resample(img, (x, y) => [x + 0.5, y], 'bilinear')
    expect([px(img, 0, 0)[0], px(img, 1, 0)[0], px(img, 2, 0)[0], px(img, 3, 0)[0]]).toEqual([50, 150, 100, 0])
  })
  it('bilinear at integer coordinates is exact and alpha stays 255', () => {
    const src = ramp(7, 3)
    const img = cloneImage(src)
    resample(img, (x, y) => [x, y], 'bilinear')
    expect(img.data).toEqual(src.data)
    for (let i = 3; i < img.data.length; i += 4) expect(img.data[i]).toBe(255)
  })
})
```

`src/post/index.test.ts`: `fake()`에 `group: 'texture'` 추가. 순서 단언을 최종 10종으로 바꾸되 Task 1 시점에는 아직 4종이 없으므로 **이 Task에서는** 다음처럼 둔다:
```ts
    expect(EFFECTS.filter((e) => e.group === 'texture').map((e) => e.id)).toEqual(['pixelate', 'blur', 'posterize', 'dither', 'halftone', 'grain'])
    for (const e of EFFECTS) expect(['warp', 'texture']).toContain(e.group)
```
(Task 3에서 전체 순서 단언으로 되돌린다.)

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/post/resample.test.ts src/post/index.test.ts` → FAIL (`Cannot find module './resample'`, `group` 타입 오류)

- [ ] **Step 3: 구현**

`src/post/types.ts` — `EffectDef`에 `group` 추가:
```ts
export type EffectGroup = 'warp' | 'texture'

export interface EffectDef {
  id: string
  name: string
  /** warp: 타일을 재배열·변형(체인 앞), texture: 픽셀을 다듬음(체인 뒤) */
  group: EffectGroup
  /** 첫 항목은 항상 enabledParam() */
  params: ParamDef[]
  /** 제자리(in-place) 수정. 알파는 255 유지 */
  apply(img: RasterImage, params: Params, ctx: EffectContext): void
}
```
기존 6개 효과(`pixelate.ts`, `blur.ts`, `posterize.ts`, `dither.ts`, `halftone.ts`, `grain.ts`)의 객체 리터럴에 `name` 다음 줄로 `group: 'texture',` 추가.

`src/post/resample.ts`
```ts
import type { RasterImage } from './types'

export type SampleMode = 'nearest' | 'bilinear'

const mod = (i: number, n: number) => ((i % n) + n) % n

/**
 * 출력 픽셀 (x, y)마다 map이 준 원본 좌표(px, 실수 가능)를 타일 주기로 감아 샘플링해 제자리 수정한다.
 * nearest는 정수 이동을 정확히 복사하고, bilinear는 곡선 변위를 매끈하게 한다. 알파는 255
 */
export function resample(img: RasterImage, map: (x: number, y: number) => readonly [number, number], mode: SampleMode): void {
  const { width: w, height: h, data } = img
  const src = new Uint8ClampedArray(data)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [sx, sy] = map(x, y)
      const o = (y * w + x) * 4
      if (mode === 'nearest') {
        const i = (mod(Math.round(sy), h) * w + mod(Math.round(sx), w)) * 4
        data[o] = src[i]
        data[o + 1] = src[i + 1]
        data[o + 2] = src[i + 2]
      } else {
        const x0 = Math.floor(sx), y0 = Math.floor(sy)
        const fx = sx - x0, fy = sy - y0
        const xa = mod(x0, w), xb = mod(x0 + 1, w), ya = mod(y0, h), yb = mod(y0 + 1, h)
        const i00 = (ya * w + xa) * 4, i10 = (ya * w + xb) * 4, i01 = (yb * w + xa) * 4, i11 = (yb * w + xb) * 4
        for (let c = 0; c < 3; c++) {
          const top = src[i00 + c] * (1 - fx) + src[i10 + c] * fx
          const bottom = src[i01 + c] * (1 - fx) + src[i11 + c] * fx
          data[o + c] = top * (1 - fy) + bottom * fy
        }
      }
      data[o + 3] = 255
    }
  }
}
```

`src/post/index.ts` — 순서 주석을 바꾸고 배열은 그대로(Task 2·3에서 앞에 채움):
```ts
// 적용 순서는 고정이다: warp(재배열 → 굽힘 → 대칭 → 명암) → texture(해상도 → 색 단순화 → 망점 → 결)
export const EFFECTS: EffectDef[] = [pixelate, blur, posterize, dither, halftone, grain]
```

`src/ui/EffectsPanel.tsx` — 그룹 소제목:
```tsx
import type { ParamValue } from '../core/params'
import { bool, defaultParams } from '../core/params'
import type { EffectsState } from '../core/state'
import type { EffectGroup } from '../post/types'
import { EFFECTS } from '../post'
import { ParamControl } from './ParamControl'

interface Props {
  effects: EffectsState
  onParamChange(id: string, key: string, value: ParamValue): void
  onRandomizeParam(id: string, key: string): void
}

const GROUPS: { id: EffectGroup; title: string }[] = [
  { id: 'warp', title: 'Warp' },
  { id: 'texture', title: 'Texture' },
]

export function EffectsPanel({ effects, onParamChange, onRandomizeParam }: Props) {
  return (
    <section className="panel-section">
      <h2>Effects</h2>
      <div className="info">Applied top to bottom</div>
      {GROUPS.map((group) => {
        const defs = EFFECTS.filter((e) => e.group === group.id)
        if (defs.length === 0) return null
        return (
          <div key={group.id} className="effect-group">
            <div className="group-title">{group.title}</div>
            {defs.map((def) => {
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
          </div>
        )
      })}
    </section>
  )
}
```

`src/styles.css` — `/* effects */` 블록 끝에:
```css
.effect-group { margin-bottom: 8px; }
.group-title { font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); margin: 8px 0 4px; }
```

- [ ] **Step 4: 통과 확인·커밋**

Run: `npx vitest run src/post` → PASS. `npm test && npm run lint && npm run build` → 통과.

```bash
git add src/post src/ui/EffectsPanel.tsx src/styles.css
git commit -m "feat(post): 감기 리샘플러, 효과 그룹(warp/texture), Effects 패널 소제목"
```

---

### Task 2: Wave, Bands

**Files:**
- Create: `src/post/wave.ts`, `wave.test.ts`, `src/post/bands.ts`, `bands.test.ts`
- Modify: `src/post/index.ts` — import 추가, `EFFECTS = [bands, wave, pixelate, blur, posterize, dither, halftone, grain]`

**Interfaces:**
- Consumes: `resample`, `enabledParam`, `num`/`str`, `grainNoise`(grain.ts)
- Produces: `export const wave: EffectDef` (id `'wave'`, group warp), `export const bands: EffectDef` (id `'bands'`), `export function bandBounds(length: number, n: number, taper: number): number[]`

- [ ] **Step 1: 테스트 작성**

`src/post/wave.test.ts`
```ts
import { describe, it, expect } from 'vitest'
import { wave } from './wave'
import { makeImage, px, setPx, cloneImage, CTX } from './testUtils'

const run = (img: ReturnType<typeof makeImage>, p: Record<string, number | string>, pxPerUnit = 1) =>
  wave.apply(img, { enabled: true, axis: 'y', periods: 1, amplitude: 8, phase: 0, ...p }, { ...CTX, pxPerUnit })

function pattern(w: number, h: number) {
  const img = makeImage(w, h)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) setPx(img, x, y, [(x * 7 + y * 13) % 256, (x * 3) % 256, (y * 5) % 256])
  return img
}

describe('wave', () => {
  it('amplitude 0 leaves the image unchanged', () => {
    const src = pattern(16, 8)
    const img = cloneImage(src)
    run(img, { amplitude: 0 })
    expect(img.data).toEqual(src.data)
  })
  it('a uniform image stays uniform', () => {
    const img = makeImage(16, 16, [40, 90, 200])
    run(img, {})
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) expect(px(img, x, y)).toEqual([40, 90, 200, 255])
  })
  it('displaces a horizontal line by A·sin along x', () => {
    const img = makeImage(64, 32)
    for (let x = 0; x < 64; x++) setPx(img, x, 16, [255, 255, 255])
    run(img, { amplitude: 4 })
    for (let x = 0; x < 64; x++) {
      let best = 0, bestY = -1
      for (let y = 0; y < 32; y++) { const v = px(img, x, y)[0]; if (v > best) { best = v; bestY = y } }
      const expected = 16 + 4 * Math.sin((2 * Math.PI * x) / 64)
      expect(Math.abs(bestY - expected)).toBeLessThanOrEqual(1)
    }
  })
  it('keeps the seam: two tiles side by side with periods 2 equal one tile with periods 1', () => {
    const one = pattern(32, 16)
    const two = makeImage(64, 16)
    for (let y = 0; y < 16; y++) for (let x = 0; x < 64; x++) setPx(two, x, y, px(one, x % 32, y).slice(0, 3) as [number, number, number])
    run(one, { periods: 1, amplitude: 5 })
    run(two, { periods: 2, amplitude: 5 })
    for (let y = 0; y < 16; y++) for (let x = 0; x < 64; x++) expect(px(two, x, y)).toEqual(px(one, x % 32, y))
  })
  it('axis x displaces a vertical line along y and scales amplitude with pxPerUnit', () => {
    const img = makeImage(32, 64)
    for (let y = 0; y < 64; y++) setPx(img, 16, y, [255, 255, 255])
    run(img, { axis: 'x', amplitude: 2 }, 2)
    for (let y = 0; y < 64; y++) {
      let best = 0, bestX = -1
      for (let x = 0; x < 32; x++) { const v = px(img, x, y)[0]; if (v > best) { best = v; bestX = x } }
      const expected = 16 + 4 * Math.sin((2 * Math.PI * y) / 64)
      expect(Math.abs(bestX - expected)).toBeLessThanOrEqual(1)
    }
    for (let i = 3; i < img.data.length; i += 4) expect(img.data[i]).toBe(255)
  })
})
```

`src/post/bands.test.ts`
```ts
import { describe, it, expect } from 'vitest'
import { bands, bandBounds } from './bands'
import { makeImage, px, setPx, cloneImage, CTX } from './testUtils'

const run = (img: ReturnType<typeof makeImage>, p: Record<string, number | string>, seed = 7) =>
  bands.apply(img, { enabled: true, axis: 'rows', bands: 4, shift: 3, offset: 'alternate', taper: 0, ...p }, { ...CTX, seed })

function vline(w: number, h: number) {
  const img = makeImage(w, h)
  for (let y = 0; y < h; y++) setPx(img, 0, y, [255, 255, 255])
  return img
}

describe('bandBounds', () => {
  it('splits evenly without taper', () => {
    expect(bandBounds(16, 4, 0)).toEqual([0, 4, 8, 12, 16])
  })
  it('thins the centre bands with taper and keeps the total', () => {
    const b = bandBounds(100, 8, 1)
    const heights = b.slice(1).map((v, i) => v - b[i])
    expect(heights.reduce((a, c) => a + c, 0)).toBe(100)
    expect(b[0]).toBe(0)
    for (let i = 1; i < 4; i++) expect(heights[i]).toBeLessThanOrEqual(heights[i - 1])
    expect(heights[3]).toBeLessThan(heights[0])
    expect(heights[4]).toBeLessThan(heights[7])
  })
})

describe('bands', () => {
  it('shift 0 leaves the image unchanged', () => {
    const src = vline(16, 16)
    const img = cloneImage(src)
    run(img, { shift: 0 })
    expect(img.data).toEqual(src.data)
  })
  it('alternate shifts every other band', () => {
    const img = vline(16, 16)
    run(img, {})
    for (let y = 0; y < 16; y++) {
      const band = Math.floor(y / 4)
      const at = band % 2 === 1 ? 3 : 0
      expect(px(img, at, y)[0]).toBe(255)
      expect(px(img, at === 0 ? 3 : 0, y)[0]).toBe(0)
    }
  })
  it('progressive shifts band i by i·shift, wrapping', () => {
    const img = vline(16, 16)
    run(img, { offset: 'progressive', shift: 5 })
    for (let y = 0; y < 16; y++) expect(px(img, (Math.floor(y / 4) * 5) % 16, y)[0]).toBe(255)
  })
  it('random offsets are deterministic per seed and differ across seeds', () => {
    const a = vline(32, 32), b = vline(32, 32), c = vline(32, 32)
    run(a, { offset: 'random', bands: 8 }, 7)
    run(b, { offset: 'random', bands: 8 }, 7)
    run(c, { offset: 'random', bands: 8 }, 8)
    expect(a.data).toEqual(b.data)
    expect(a.data).not.toEqual(c.data)
  })
  it('vertical bands shift along y', () => {
    const img = makeImage(16, 16)
    for (let x = 0; x < 16; x++) setPx(img, x, 0, [255, 255, 255])
    run(img, { axis: 'cols' })
    for (let x = 0; x < 16; x++) {
      const band = Math.floor(x / 4)
      expect(px(img, x, band % 2 === 1 ? 3 : 0)[0]).toBe(255)
    }
    for (let i = 3; i < img.data.length; i += 4) expect(img.data[i]).toBe(255)
  })
  it('scales the shift with pxPerUnit', () => {
    const img = vline(16, 8)
    bands.apply(img, { enabled: true, axis: 'rows', bands: 2, shift: 2, offset: 'alternate', taper: 0 }, { ...CTX, pxPerUnit: 2 })
    expect(px(img, 4, 6)[0]).toBe(255)
    expect(px(img, 0, 6)[0]).toBe(0)
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/post/wave.test.ts src/post/bands.test.ts` → FAIL `Cannot find module`

- [ ] **Step 3: 구현**

`src/post/wave.ts`
```ts
import type { EffectDef } from './types'
import { enabledParam } from './types'
import { num, str } from '../core/params'
import { resample } from './resample'

export const wave: EffectDef = {
  id: 'wave',
  name: 'Wave',
  group: 'warp',
  params: [
    enabledParam(),
    { type: 'select', key: 'axis', label: 'Displace', default: 'y', options: [{ value: 'y', label: 'Up–down' }, { value: 'x', label: 'Left–right' }] },
    { type: 'range', key: 'periods', label: 'Periods', min: 1, max: 8, step: 1, default: 1 },
    { type: 'range', key: 'amplitude', label: 'Amplitude', min: 0, max: 64, step: 1, default: 8 },
    { type: 'range', key: 'phase', label: 'Phase', min: 0, max: 1, step: 0.05, default: 0 },
  ],
  apply(img, params, ctx) {
    const A = num(params, 'amplitude') * ctx.pxPerUnit
    if (A < 0.5) return
    const periods = num(params, 'periods')
    const phase = num(params, 'phase')
    const { width: w, height: h } = img
    if (str(params, 'axis') === 'y') {
      // 열마다 세로 변위. 타일이 세로로 주기적이므로 감기가 정확하고, periods가 정수라 가로 이음새도 유지된다
      const dy = new Float64Array(w)
      for (let x = 0; x < w; x++) dy[x] = A * Math.sin(2 * Math.PI * ((periods * x) / w + phase))
      resample(img, (x, y) => [x, y - dy[x]], 'bilinear')
    } else {
      const dx = new Float64Array(h)
      for (let y = 0; y < h; y++) dx[y] = A * Math.sin(2 * Math.PI * ((periods * y) / h + phase))
      resample(img, (x, y) => [x - dx[y], y], 'bilinear')
    }
  },
}
```

`src/post/bands.ts`
```ts
import type { EffectDef } from './types'
import { enabledParam } from './types'
import { num, str } from '../core/params'
import { resample } from './resample'
import { grainNoise } from './grain'

/** 띠 경계 b_0..b_N (px). taper가 클수록 중앙 띠가 얇아진다(최소 가장자리의 15 %) */
export function bandBounds(length: number, n: number, taper: number): number[] {
  const weights: number[] = []
  for (let i = 0; i < n; i++) weights.push(1 - 0.85 * taper * (1 - Math.abs((2 * (i + 0.5)) / n - 1)))
  const total = weights.reduce((a, b) => a + b, 0)
  const bounds = [0]
  let acc = 0
  for (let i = 0; i < n - 1; i++) {
    acc += weights[i]
    bounds.push(Math.round((length * acc) / total))
  }
  bounds.push(length)
  return bounds
}

export const bands: EffectDef = {
  id: 'bands',
  name: 'Bands',
  group: 'warp',
  params: [
    enabledParam(),
    { type: 'select', key: 'axis', label: 'Bands', default: 'rows', options: [{ value: 'rows', label: 'Horizontal' }, { value: 'cols', label: 'Vertical' }] },
    { type: 'range', key: 'bands', label: 'Count', min: 2, max: 24, step: 1, default: 8 },
    { type: 'range', key: 'shift', label: 'Shift', min: 0, max: 256, step: 1, default: 8 },
    {
      type: 'select', key: 'offset', label: 'Offset', default: 'alternate',
      options: [{ value: 'alternate', label: 'Alternate' }, { value: 'progressive', label: 'Progressive' }, { value: 'random', label: 'Random' }],
    },
    { type: 'range', key: 'taper', label: 'Taper', min: 0, max: 1, step: 0.05, default: 0 },
  ],
  apply(img, params, ctx) {
    const n = num(params, 'bands')
    const S = Math.round(num(params, 'shift') * ctx.pxPerUnit)
    const offset = str(params, 'offset')
    const rows = str(params, 'axis') === 'rows'
    const { width: w, height: h } = img
    const along = rows ? w : h   // 이동 방향 길이(감기 주기)
    const across = rows ? h : w  // 띠가 쌓이는 방향 길이
    const bounds = bandBounds(across, n, num(params, 'taper'))
    const shifts = new Int32Array(n)
    for (let i = 0; i < n; i++) {
      if (offset === 'alternate') shifts[i] = (i % 2) * S
      else if (offset === 'progressive') shifts[i] = i * S
      else shifts[i] = Math.floor(((grainNoise(i, 0, ctx.seed) + 1) / 2) * along)
    }
    if (shifts.every((s) => s % along === 0)) return
    const bandOf = new Int32Array(across)
    for (let i = 0; i < n; i++) for (let p = bounds[i]; p < bounds[i + 1]; p++) bandOf[p] = i
    if (rows) resample(img, (x, y) => [x - shifts[bandOf[y]], y], 'nearest')
    else resample(img, (x, y) => [x, y - shifts[bandOf[x]]], 'nearest')
  },
}
```

`src/post/index.ts`: `import { bands } from './bands'`, `import { wave } from './wave'`, `EFFECTS = [bands, wave, pixelate, blur, posterize, dither, halftone, grain]`.

- [ ] **Step 4: 통과 확인·커밋**

Run: `npx vitest run src/post` → PASS. `npm test && npm run lint && npm run build` → 통과.

```bash
git add src/post
git commit -m "feat(post): Wave(사인 변위)·Bands(구간별 위상 이동·taper) 워프 효과"
```

---

### Task 3: Fold, Shade, 최종 순서

**Files:**
- Create: `src/post/fold.ts`, `fold.test.ts`, `src/post/shade.ts`, `shade.test.ts`
- Modify: `src/post/index.ts` — 최종 `EFFECTS = [bands, wave, fold, shade, pixelate, blur, posterize, dither, halftone, grain]`; `src/post/index.test.ts` — 순서 단언을 전체 10종으로

**Interfaces:**
- Produces: `export const fold: EffectDef` (id `'fold'`), `export const shade: EffectDef` (id `'shade'`)

- [ ] **Step 1: 테스트 작성**

`src/post/fold.test.ts`
```ts
import { describe, it, expect } from 'vitest'
import { fold } from './fold'
import { makeImage, px, setPx, cloneImage, CTX } from './testUtils'

function pattern(w: number, h: number) {
  const img = makeImage(w, h)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) setPx(img, x, y, [(x * 29 + y * 7) % 256, (x * 3) % 256, (y * 5) % 256])
  return img
}
const run = (img: ReturnType<typeof makeImage>, mode: string) => fold.apply(img, { enabled: true, mode }, CTX)

describe('fold', () => {
  it('horizontal keeps the left half and mirrors it to the right', () => {
    const src = pattern(8, 4)
    const img = cloneImage(src)
    run(img, 'horizontal')
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      expect(px(img, x, y)).toEqual(px(src, x, y))
      expect(px(img, 7 - x, y)).toEqual(px(src, x, y))
    }
  })
  it('keeps the centre column of an odd width', () => {
    const src = pattern(5, 3)
    const img = cloneImage(src)
    run(img, 'horizontal')
    for (let y = 0; y < 3; y++) {
      expect(px(img, 2, y)).toEqual(px(src, 2, y))
      expect(px(img, 4, y)).toEqual(px(src, 0, y))
    }
  })
  it('vertical mirrors top to bottom', () => {
    const src = pattern(6, 6)
    const img = cloneImage(src)
    run(img, 'vertical')
    for (let y = 0; y < 3; y++) for (let x = 0; x < 6; x++) expect(px(img, x, 5 - y)).toEqual(px(src, x, y))
  })
  it('both gives four-way symmetry and alpha 255', () => {
    const img = pattern(8, 6)
    run(img, 'both')
    for (let y = 0; y < 6; y++) for (let x = 0; x < 8; x++) {
      expect(px(img, x, y)).toEqual(px(img, 7 - x, y))
      expect(px(img, x, y)).toEqual(px(img, x, 5 - y))
    }
    for (let i = 3; i < img.data.length; i += 4) expect(img.data[i]).toBe(255)
  })
})
```

`src/post/shade.test.ts`
```ts
import { describe, it, expect } from 'vitest'
import { shade } from './shade'
import { makeImage, px, cloneImage, CTX } from './testUtils'

const run = (img: ReturnType<typeof makeImage>, p: Record<string, number | string>) =>
  shade.apply(img, { enabled: true, axis: 'y', periods: 1, strength: 100, phase: 0, to: 'dark', ...p }, CTX)

describe('shade', () => {
  it('strength 0 leaves the image unchanged', () => {
    const src = makeImage(4, 8, [200, 100, 50])
    const img = cloneImage(src)
    run(img, { strength: 0 })
    expect(img.data).toEqual(src.data)
  })
  it('dark: untouched at the edge, black at the centre, seamless top to bottom', () => {
    const img = makeImage(8, 64, [200, 200, 200])
    run(img, {})
    expect(px(img, 0, 0)[0]).toBe(200)
    expect(px(img, 0, 63)[0]).toBe(200)
    expect(px(img, 0, 31)[0]).toBe(0)
    expect(px(img, 0, 32)[0]).toBe(0)
    expect(Math.abs(px(img, 0, 0)[0] - px(img, 0, 63)[0])).toBeLessThanOrEqual(2)
    expect(px(img, 0, 16)[0]).toBeLessThan(200)
    expect(px(img, 0, 16)[0]).toBeGreaterThan(0)
  })
  it('light: mixes towards white at the centre', () => {
    const img = makeImage(8, 64, [200, 100, 50])
    run(img, { to: 'light' })
    expect(px(img, 0, 31)).toEqual([255, 255, 255, 255])
    expect(px(img, 0, 0)).toEqual([200, 100, 50, 255])
  })
  it('periods 2 darkens twice and strength 50 halves the effect', () => {
    const img = makeImage(4, 64, [200, 200, 200])
    run(img, { periods: 2, strength: 50 })
    expect(px(img, 0, 15)[0]).toBe(100)
    expect(px(img, 0, 47)[0]).toBe(100)
    expect(px(img, 0, 31)[0]).toBe(200)
  })
  it('axis x shades along x', () => {
    const img = makeImage(64, 4, [200, 200, 200])
    run(img, { axis: 'x' })
    expect(px(img, 0, 0)[0]).toBe(200)
    expect(px(img, 31, 0)[0]).toBe(0)
    for (let i = 3; i < img.data.length; i += 4) expect(img.data[i]).toBe(255)
  })
})
```
(검증: h = 64, t = (y + 0.5)/64. y = 31, 32 → cos(2π·0.492) ≈ cos(2π·0.508) ≈ −0.9988 → f ≈ 0.0006 → 200·f → 0. y = 0 → f ≈ 0.9994 → 200. periods 2·strength 50: y = 15 → t = 0.242, cos(2π·0.484) ≈ −0.995 → f = 1 − 0.5·0.9975 ≈ 0.501 → 100; y = 31 → t = 0.492, cos(2π·0.984) ≈ 0.995 → f ≈ 0.9988 → 200.)

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/post/fold.test.ts src/post/shade.test.ts` → FAIL `Cannot find module`

- [ ] **Step 3: 구현**

`src/post/fold.ts`
```ts
import type { EffectDef } from './types'
import { enabledParam } from './types'
import { str } from '../core/params'
import { resample } from './resample'

export const fold: EffectDef = {
  id: 'fold',
  name: 'Fold',
  group: 'warp',
  params: [
    enabledParam(),
    {
      type: 'select', key: 'mode', label: 'Mirror', default: 'horizontal',
      options: [{ value: 'horizontal', label: 'Left → right' }, { value: 'vertical', label: 'Top → bottom' }, { value: 'both', label: 'Both' }],
    },
  ],
  apply(img, params) {
    const mode = str(params, 'mode')
    const { width: w, height: h } = img
    const hx = Math.ceil(w / 2), hy = Math.ceil(h / 2)
    const mx = mode !== 'vertical', my = mode !== 'horizontal'
    // 절반을 반대편에 복사한다. 결과 타일이 대칭이므로 반복 이음새가 유지된다
    resample(img, (x, y) => [mx && x >= hx ? w - 1 - x : x, my && y >= hy ? h - 1 - y : y], 'nearest')
  },
}
```

`src/post/shade.ts`
```ts
import type { EffectDef } from './types'
import { enabledParam } from './types'
import { num, str } from '../core/params'

export const shade: EffectDef = {
  id: 'shade',
  name: 'Shade',
  group: 'warp',
  params: [
    enabledParam(),
    { type: 'select', key: 'axis', label: 'Along', default: 'y', options: [{ value: 'y', label: 'Up–down' }, { value: 'x', label: 'Left–right' }] },
    { type: 'range', key: 'periods', label: 'Periods', min: 1, max: 8, step: 1, default: 1 },
    { type: 'range', key: 'strength', label: 'Strength', min: 0, max: 100, step: 1, default: 60 },
    { type: 'range', key: 'phase', label: 'Phase', min: 0, max: 1, step: 0.05, default: 0 },
    { type: 'select', key: 'to', label: 'Towards', default: 'dark', options: [{ value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }] },
  ],
  apply(img, params) {
    const s = num(params, 'strength') / 100
    if (s <= 0) return
    const periods = num(params, 'periods')
    const phase = num(params, 'phase')
    const alongY = str(params, 'axis') === 'y'
    const light = str(params, 'to') === 'light'
    const { width: w, height: h, data } = img
    const len = alongY ? h : w
    // f = 1 − s·(0.5 − 0.5·cos(2π(periods·t + phase))): t = 0에서 1(변화 없음), 반주기에서 1 − s
    const f = new Float64Array(len)
    for (let p = 0; p < len; p++) f[p] = 1 - s * (0.5 - 0.5 * Math.cos(2 * Math.PI * ((periods * (p + 0.5)) / len + phase)))
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const k = f[alongY ? y : x]
        const i = (y * w + x) * 4
        for (let c = 0; c < 3; c++) data[i + c] = light ? data[i + c] + (255 - data[i + c]) * (1 - k) : data[i + c] * k
      }
    }
  },
}
```

`src/post/index.ts`: import `fold`, `shade`; `EFFECTS = [bands, wave, fold, shade, pixelate, blur, posterize, dither, halftone, grain]`.
`src/post/index.test.ts`: Task 1의 두 줄을 다음으로 교체:
```ts
    expect(EFFECTS.map((e) => e.id)).toEqual(['bands', 'wave', 'fold', 'shade', 'pixelate', 'blur', 'posterize', 'dither', 'halftone', 'grain'])
    expect(EFFECTS.map((e) => e.group)).toEqual(['warp', 'warp', 'warp', 'warp', 'texture', 'texture', 'texture', 'texture', 'texture', 'texture'])
```

- [ ] **Step 4: 통과 확인·커밋**

Run: `npx vitest run src/post` → PASS. `npm test && npm run lint && npm run build` → 통과.

```bash
git add src/post
git commit -m "feat(post): Fold(거울)·Shade(명암 변조) — 워프 4종 완성, 체인 순서 확정"
```

---

### Task 4: Grain 출력 px, 하프톤 부분 셀, 반올림·color 테스트

**Files:**
- Modify: `src/post/grain.ts`, `src/post/grain.test.ts`, `src/post/halftone.ts`, `src/post/halftone.test.ts`, `src/post/pixelate.test.ts`

- [ ] **Step 1: 테스트 작성**

`src/post/grain.test.ts` — `scales grain size with pxPerUnit` 테스트를 다음으로 교체:
```ts
  it('size is in output pixels and ignores pxPerUnit', () => {
    const img = run(60, 2, false, 7, 2)
    for (let by = 0; by < 16; by++) for (let bx = 0; bx < 16; bx++) {
      const v = px(img, bx * 2, by * 2)[0]
      expect(px(img, bx * 2 + 1, by * 2)[0]).toBe(v)
      expect(px(img, bx * 2, by * 2 + 1)[0]).toBe(v)
      expect(px(img, bx * 2 + 1, by * 2 + 1)[0]).toBe(v)
    }
    const distinct = new Set<number>()
    for (let by = 0; by < 16; by++) for (let bx = 0; bx < 16; bx++) distinct.add(px(img, bx * 2, by * 2)[0])
    expect(distinct.size).toBeGreaterThan(50)
  })
```

`src/post/halftone.test.ts` — 추가:
```ts
  it('partial edge cells get the same coverage as full cells', () => {
    const img = makeImage(20, 12, [128, 128, 128])
    halftone.apply(img, { enabled: true, cell: 8, mode: 'ink' }, CTX)
    const frac = (x0: number, y0: number, w: number, h: number) => {
      let n = 0
      for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (px(img, x, y)[0] === INK[0]) n++
      return n / (w * h)
    }
    const full = frac(0, 0, 8, 8)
    expect(full).toBeGreaterThan(0.5)
    expect(full).toBeLessThan(0.95)
    expect(Math.abs(frac(16, 0, 4, 8) - full)).toBeLessThanOrEqual(0.2)
    expect(Math.abs(frac(0, 8, 8, 4) - full)).toBeLessThanOrEqual(0.2)
    expect(Math.abs(frac(16, 8, 4, 4) - full)).toBeLessThanOrEqual(0.2)
  })
  it('color mode paints the dot in the cell mean of a two-colour cell', () => {
    const img = makeImage(8, 8, [200, 40, 40])
    for (let y = 4; y < 8; y++) for (let x = 0; x < 8; x++) setPx(img, x, y, [100, 200, 60])
    halftone.apply(img, { enabled: true, cell: 8, mode: 'color' }, CTX)
    expect(px(img, 4, 4).slice(0, 3)).toEqual([150, 120, 50])
  })
```
(`setPx`를 import에 추가.)

`src/post/pixelate.test.ts` — 추가:
```ts
  it('block averages round half to even like Uint8ClampedArray', () => {
    const img = makeImage(4, 1)
    setPx(img, 0, 0, [2, 0, 0]); setPx(img, 1, 0, [3, 0, 0]); setPx(img, 2, 0, [3, 0, 0]); setPx(img, 3, 0, [4, 0, 0])
    pixelate.apply(img, { enabled: true, block: 2 }, CTX)
    expect(px(img, 0, 0)[0]).toBe(2)
    expect(px(img, 2, 0)[0]).toBe(4)
  })
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/post/grain.test.ts src/post/halftone.test.ts src/post/pixelate.test.ts` → grain·halftone 부분 셀 테스트 FAIL, 나머지 PASS

- [ ] **Step 3: 구현**

`src/post/grain.ts`: 라벨 `'Grain size (px)'`, 그리고
```ts
    // 출력 픽셀 단위 — 필름 그레인은 배율과 무관하게 픽셀 크기로 보여야 한다(크기가 unit이 아닌 유일한 효과)
    const s = Math.max(1, Math.round(num(params, 'size')))
```
(`ctx`는 시드에 계속 쓰인다.)

`src/post/halftone.ts` — 반지름·중심 계산을 교체:
```ts
        const cw = x1 - bx, ch = y1 - by
        const a = 1 - luma(R, G, B)                                   // 잉크 면적 비율
        // 실제 셀 크기의 반대각선 기준: a = 1이면 셀 모서리까지 덮고, 가장자리 부분 셀도 같은 비율로 덮는다
        const radius = 0.5 * Math.sqrt(cw * cw + ch * ch) * Math.sqrt(a)
        const cx = bx + cw / 2, cy = by + ch / 2
```

- [ ] **Step 4: 통과 확인·커밋**

Run: `npx vitest run src/post` → PASS. `npm test && npm run lint && npm run build` → 통과.

```bash
git add src/post
git commit -m "fix(post): 그레인 크기를 출력 px로, 하프톤 부분 셀 반지름 보정, 반올림·color 테스트"
```

---

### Task 5: 해시 기본값 생략, 접근성 이름 접두사

**Files:**
- Modify: `src/core/state.ts`, `src/core/state.test.ts`, `src/App.tsx`, `src/ui/ParamControl.tsx`, `src/ui/EffectsPanel.tsx`

**Interfaces:**
- Produces: `encodeState(state: PatternState, effectDefs?: EffectInfo[]): string`; `ParamControl` prop `namePrefix?: string`

- [ ] **Step 1: 테스트 작성**

`src/core/state.test.ts` — 상단에 디코더 헬퍼, 그리고 테스트 추가:
```ts
const decodeJson = (hash: string): Record<string, unknown> => {
  const b64 = hash.replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4))
  return JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))))
}

describe('encodeState with effect definitions', () => {
  const base: PatternState = { generator: 'a', seed: 9, params: { cell: 16, mode: 'x' }, palette: ['#000000', '#ffffff', '#ff0000'], locks: emptyLocks(), effects: { ...FX_DEFAULT } }
  it('omits effects that equal their defaults, and the key when nothing is left', () => {
    expect('effects' in decodeJson(encodeState(base, FX_DEFS))).toBe(false)
    expect('effects' in decodeJson(encodeState(base))).toBe(true)
  })
  it('keeps only changed effects and drops unknown ids', () => {
    const state = { ...base, effects: { fx: { enabled: true, amount: 3 }, zzz: { enabled: true } } }
    expect(decodeJson(encodeState(state, FX_DEFS)).effects).toEqual({ fx: { enabled: true, amount: 3 } })
  })
  it('round-trips through decodeState to the full state', () => {
    const state = { ...base, effects: { fx: { enabled: true, amount: 8 } } }
    expect(decodeState(encodeState(state, FX_DEFS), resolve, defaults)).toEqual(state)
    expect(decodeState(encodeState(base, FX_DEFS), resolve, defaults)).toEqual(base)
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/core/state.test.ts` → FAIL (`effects` 키가 남아 있음)

- [ ] **Step 3: 구현**

`src/core/state.ts` — import에 `defaultParams`와 `type Params` 추가, `encodeState` 교체:
```ts
function sameParams(a: Params, b: Params): boolean {
  const ka = Object.keys(a), kb = Object.keys(b)
  return ka.length === kb.length && ka.every((k) => a[k] === b[k])
}

/** effectDefs가 주어지면 기본값과 같은 효과와 정의에 없는 id는 해시에서 뺀다(링크 길이). decodeState가 기본값을 복원한다 */
export function encodeState(state: PatternState, effectDefs?: EffectInfo[]): string {
  if (!effectDefs) return toBase64Url(JSON.stringify(state))
  const effects: EffectsState = {}
  for (const def of effectDefs) {
    const p = state.effects[def.id]
    if (p && !sameParams(p, defaultParams(def.params))) effects[def.id] = p
  }
  const out: Record<string, unknown> = { generator: state.generator, seed: state.seed, params: state.params, palette: state.palette, locks: state.locks }
  if (Object.keys(effects).length > 0) out.effects = effects
  return toBase64Url(JSON.stringify(out))
}
```
`src/App.tsx`: `encodeState(pattern)` → `encodeState(pattern, effectInfos())` (`effectInfos`는 이미 import됨).

`src/ui/ParamControl.tsx` — `Props`에 `/** 접근성 이름 접두사(예: 효과 이름). 보이는 라벨은 그대로 */ namePrefix?: string`, `HeadProps`에 `name: string`. `ControlHead`는 `DiceButton title={\`Randomize ${name}\`}`, `LockButton label={name}`. `ParamControl`:
```ts
export function ParamControl({ def, value, locked = false, onChange, onToggleLock = () => {}, onRandomize, lockable = true, namePrefix }: Props) {
  const name = namePrefix ? `${namePrefix} ${def.label}` : def.label
  const cls = `control${lockable && locked ? ' locked' : ''}`
  const head = { label: def.label, name, locked, lockable, onToggleLock, onRandomize }
```
range의 `aria-label={name}`, `NumberField label={name}`, select의 `aria-label={name}`, toggle checkbox `aria-label={name}`.

`src/ui/EffectsPanel.tsx`: `ParamControl`에 `namePrefix={def.name}` 추가.

- [ ] **Step 4: 통과 확인·브라우저·커밋**

Run: `npm test && npm run lint && npm run build` → 통과. 브라우저(`npx vite --port 5175 --strictPort`): 기본 상태에서 Copy link 길이가 v1.2보다 약 230자 짧고, 효과 하나를 켜면 그 항목만 해시에 들어가며, 새로고침 후 복원된다. Posterize·Dither를 켜고 슬라이더의 aria-label이 "Posterize Levels"/"Dither Levels"인지 확인.

```bash
git add src/core src/App.tsx src/ui
git commit -m "feat(state,ui): 해시에서 기본값 효과 생략, 효과 컨트롤 접근성 이름 접두사"
```

---

### Task 6: jsdom UI 테스트 하네스

**Files:**
- Modify: `package.json`(devDependencies), `vite.config.ts`
- Create: `src/ui/EffectsPanel.test.tsx`, `src/ui/ParamControl.test.tsx`, `src/ui/ControlPanel.test.tsx`

- [ ] **Step 1: 의존성·설정**

```bash
npm install -D jsdom @testing-library/react @testing-library/dom
```
`vite.config.ts`: `include: ['src/**/*.test.{ts,tsx}']` (환경 기본값은 node 유지).

- [ ] **Step 2: 테스트 작성**

`src/ui/EffectsPanel.test.tsx`
```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { EffectsPanel } from './EffectsPanel'
import { EFFECTS, defaultEffects } from '../post'

afterEach(cleanup)

const allOn = () => {
  const e = defaultEffects()
  for (const id of Object.keys(e)) e[id] = { ...e[id], enabled: true }
  return e
}
const labelsOf = (selector: string) => [...document.querySelectorAll(selector)].map((n) => n.getAttribute('aria-label'))

describe('EffectsPanel', () => {
  it('lists the groups and the effects in registry order', () => {
    render(<EffectsPanel effects={defaultEffects()} onParamChange={() => {}} onRandomizeParam={() => {}} />)
    expect([...document.querySelectorAll('.group-title')].map((n) => n.textContent)).toEqual(['Warp', 'Texture'])
    expect([...document.querySelectorAll('.effect-head span')].map((n) => n.textContent)).toEqual(EFFECTS.map((e) => e.name))
    expect(document.querySelectorAll('.effect-body').length).toBe(0)
  })
  it('ticking an effect reports enabled=true', () => {
    const onParamChange = vi.fn()
    render(<EffectsPanel effects={defaultEffects()} onParamChange={onParamChange} onRandomizeParam={() => {}} />)
    fireEvent.click(screen.getByLabelText('Grain'))
    expect(onParamChange).toHaveBeenCalledWith('grain', 'enabled', true)
  })
  it('shows controls without lock buttons and with unique names when everything is on', () => {
    render(<EffectsPanel effects={allOn()} onParamChange={() => {}} onRandomizeParam={() => {}} />)
    expect(document.querySelectorAll('.effect-body').length).toBe(EFFECTS.length)
    expect(document.querySelectorAll('button.lock').length).toBe(0)
    const sliders = labelsOf('input[type=range]')
    expect(new Set(sliders).size).toBe(sliders.length)
    const dice = labelsOf('button.dice')
    expect(new Set(dice).size).toBe(dice.length)
    expect(sliders).toContain('Posterize Levels')
    expect(sliders).toContain('Dither Levels')
  })
})
```

`src/ui/ParamControl.test.tsx`
```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import type { ParamDef } from '../core/params'
import { ParamControl } from './ParamControl'

afterEach(cleanup)
const RANGE: ParamDef = { type: 'range', key: 'cell', label: 'Cell size', min: 2, max: 32, step: 2, default: 6 }
const SELECT: ParamDef = { type: 'select', key: 'mode', label: 'Mode', options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }], default: 'a' }

describe('ParamControl', () => {
  it('renders a lock button by default and none when lockable is false', () => {
    const { unmount } = render(<ParamControl def={RANGE} value={6} onChange={() => {}} onRandomize={() => {}} />)
    expect(document.querySelector('button.lock')).not.toBeNull()
    unmount()
    render(<ParamControl def={RANGE} value={6} lockable={false} onChange={() => {}} onRandomize={() => {}} />)
    expect(document.querySelector('button.lock')).toBeNull()
  })
  it('does not commit on blur without an edit, and snaps a typed value on Enter', () => {
    const onChange = vi.fn()
    render(<ParamControl def={RANGE} value={6} onChange={onChange} onRandomize={() => {}} />)
    const field = document.querySelector('input.num') as HTMLInputElement
    fireEvent.blur(field)
    expect(onChange).not.toHaveBeenCalled()
    fireEvent.change(field, { target: { value: '7.3' } })
    fireEvent.keyDown(field, { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith(8)
  })
  it('prefixes accessible names with namePrefix but keeps the visible label', () => {
    render(<ParamControl def={RANGE} value={6} lockable={false} namePrefix="Grain" onChange={() => {}} onRandomize={() => {}} />)
    expect(screen.getByRole('slider', { name: 'Grain Cell size' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Randomize Grain Cell size' })).toBeTruthy()
    expect(screen.getByText('Cell size')).toBeTruthy()
  })
  it('renders a segmented control for a short select', () => {
    const onChange = vi.fn()
    render(<ParamControl def={SELECT} value="a" onChange={onChange} onRandomize={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'B' }))
    expect(onChange).toHaveBeenCalledWith('b')
  })
})
```

`src/ui/ControlPanel.test.tsx`
```tsx
// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { ControlPanel } from './ControlPanel'
import { getGenerator } from '../generators'
import { defaultParams } from '../core/params'

afterEach(cleanup)

describe('ControlPanel', () => {
  it('renders a control per parameter and the output summary', () => {
    const g = getGenerator('zigzag')!
    const scene = { width: 96, height: 108, background: '#000000', shapes: [] }
    render(
      <ControlPanel
        generator={g}
        params={defaultParams(g.params)}
        lockedKeys={[]}
        onParamChange={() => {}}
        onToggleLock={() => {}}
        onRandomizeParam={() => {}}
        scene={scene}
        tilePx={{ w: 192, h: 216 }}
        effectsOn={2}
      />,
    )
    expect(document.querySelectorAll('.control').length).toBe(g.params.length)
    expect(screen.getByText('Effects: 2 on')).toBeTruthy()
    expect(screen.getByText('Tile: 96 × 108 units')).toBeTruthy()
  })
})
```

- [ ] **Step 3: 통과 확인·커밋**

Run: `npx vitest run src/ui` → PASS(3 파일). `npm test && npm run lint && npm run build` → 통과(빌드는 `tsc -b`가 테스트 파일도 타입 검사하므로 `@testing-library/react` 타입이 잡혀야 한다). oxlint가 `.test.tsx`에서 경고를 내면 규칙에 맞게 고친다(테스트 파일은 컴포넌트를 export하지 않는다).

```bash
git add package.json package-lock.json vite.config.ts src/ui
git commit -m "test(ui): jsdom + Testing Library 하네스, Effects·ParamControl·ControlPanel 테스트"
```

---

### Task 7: Glyphs 생성기

**Files:**
- Create: `src/generators/glyphs.ts`, `src/generators/glyphs.test.ts`
- Modify: `src/generators/index.ts`(등록), `src/generators/generators.test.ts`(CASES 행)

**Interfaces:**
- Consumes: `GeneratorDef`/`GenContext`, `Rng`, `mulberry32`, `fg`/`pickFg`/`rect`, `num`/`str`
- Produces: `export const glyphs: GeneratorDef` (id `'glyphs'`), `export function buildGlyph(g, density, symmetry, shapes, rng): boolean[][]`, `export function drawPrimitive(grid, kind, density, rng): void`, `export function applySymmetry(grid, sym): void`

- [ ] **Step 1: 테스트 작성**

`src/generators/glyphs.test.ts`
```ts
import { describe, it, expect } from 'vitest'
import { mulberry32 } from '../core/prng'
import { fg } from './util'
import { buildGlyph, applySymmetry, drawPrimitive } from './glyphs'
import { PALETTE8, run, colorsOf } from './testUtils'

/** cell 1·gutter 0·1×1로 생성한 Scene을 g×g 점유 격자로 되돌린다 */
function occupancy(g: number, seed: number, overrides: Record<string, number | string> = {}): boolean[][] {
  const s = run('glyphs', { cell: 1, gutter: 0, across: 1, down: 1, grid: g, ...overrides }, PALETTE8, seed)
  const grid = Array.from({ length: g }, () => Array<boolean>(g).fill(false))
  for (const sh of s.shapes) {
    if (sh.kind !== 'rect') throw new Error('rect only')
    for (let x = sh.x; x < sh.x + sh.w; x++) grid[sh.y][x] = true
  }
  return grid
}
const ratio = (grid: boolean[][]) => grid.flat().filter(Boolean).length / (grid.length * grid.length)

describe('glyph grammar', () => {
  it('every primitive draws something inside the grid', () => {
    for (const kind of ['bands', 'bars', 'checker', 'dots', 'step', 'loop', 'center', 'scatter'] as const) {
      const grid = Array.from({ length: 8 }, () => Array<boolean>(8).fill(false))
      drawPrimitive(grid, kind, 0.6, mulberry32(3))
      expect(ratio(grid)).toBeGreaterThan(0)
    }
  })
  it('applySymmetry mirrors and rotates', () => {
    const grid = Array.from({ length: 6 }, () => Array<boolean>(6).fill(false))
    grid[0][0] = true
    applySymmetry(grid, 'quad')
    expect(grid[0][5] && grid[5][0] && grid[5][5]).toBe(true)
    const r = Array.from({ length: 5 }, () => Array<boolean>(5).fill(false))
    r[1][0] = true
    applySymmetry(r, 'rot180')
    expect(r[3][4]).toBe(true)
  })
  it('never yields an empty or a solid glyph', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const rr = ratio(buildGlyph(8, 0.45, 'auto', 'all', mulberry32(seed)))
      expect(rr).toBeGreaterThanOrEqual(0.02)
      expect(rr).toBeLessThanOrEqual(0.95)
    }
  })
})

describe('glyphs generator', () => {
  it('tile size follows across·(grid+gutter)·cell', () => {
    const s = run('glyphs', { cell: 4, grid: 8, across: 3, down: 2, gutter: 2 })
    expect(s.width).toBe(120)
    expect(s.height).toBe(80)
  })
  it('keeps every rect inside its glyph slot', () => {
    const s = run('glyphs', { cell: 3, grid: 8, across: 4, down: 2, gutter: 2 }, PALETTE8, 5)
    const slot = 10 * 3, inset = 1 * 3
    for (const sh of s.shapes) {
      if (sh.kind !== 'rect') throw new Error('rect only')
      const c = Math.floor(sh.x / slot), r = Math.floor(sh.y / slot)
      expect(sh.x).toBeGreaterThanOrEqual(c * slot + inset)
      expect(sh.x + sh.w).toBeLessThanOrEqual(c * slot + inset + 8 * 3)
      expect(sh.y).toBeGreaterThanOrEqual(r * slot + inset)
      expect(sh.y + sh.h).toBeLessThanOrEqual(r * slot + inset + 8 * 3)
    }
  })
  it('symmetry mirror makes each glyph left–right symmetric', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const grid = occupancy(8, seed, { symmetry: 'mirror' })
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) expect(grid[y][x]).toBe(grid[y][7 - x])
    }
  })
  it('mono uses one colour and sequence cycles the foreground colours per glyph', () => {
    expect(new Set(colorsOf(run('glyphs', { colorMode: 'mono' })))).toEqual(new Set([PALETTE8[1]]))
    const s = run('glyphs', { colorMode: 'sequence', across: 4, down: 1, cell: 2, grid: 8, gutter: 2 })
    for (const sh of s.shapes) {
      if (sh.kind !== 'rect' || sh.fill.type !== 'solid') throw new Error('solid rect only')
      const k = Math.floor(sh.x / 20)
      expect(sh.fill.color).toBe(fg(PALETTE8, k))
    }
  })
  it('every shape family and symmetry option generates', () => {
    for (const shapes of ['all', 'lines', 'dots', 'checker', 'wave']) for (const symmetry of ['auto', 'none', 'mirror', 'quad'])
      for (let seed = 1; seed <= 5; seed++) expect(run('glyphs', { shapes, symmetry }, PALETTE8, seed).shapes.length).toBeGreaterThan(0)
  })
})
```

`src/generators/generators.test.ts`: CASES에 `{ id: 'glyphs', rngParams: { density: 0.5 } }` 추가(rings 다음).

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/generators` → FAIL (`Cannot find module './glyphs'`, registry 테스트)

- [ ] **Step 3: 구현**

`src/generators/glyphs.ts`
```ts
import type { GeneratorDef } from './types'
import type { Shape } from '../core/scene'
import { num, str } from '../core/params'
import type { Rng } from '../core/prng'
import { mulberry32 } from '../core/prng'
import { fg, pickFg, rect } from './util'

type Grid = boolean[][]
export type Primitive = 'bands' | 'bars' | 'checker' | 'dots' | 'step' | 'loop' | 'center' | 'scatter'
export type Symmetry = 'none' | 'mirror-x' | 'mirror-y' | 'quad' | 'rot180'

const POOLS: Record<string, Primitive[]> = {
  all: ['bands', 'bars', 'checker', 'dots', 'step', 'loop', 'center', 'scatter'],
  lines: ['bands', 'bars', 'loop'],
  dots: ['dots', 'scatter', 'center'],
  checker: ['checker', 'center'],
  wave: ['step', 'bands'],
}

const makeGrid = (g: number): Grid => Array.from({ length: g }, () => Array<boolean>(g).fill(false))

function fillRatio(grid: Grid): number {
  let n = 0
  for (const row of grid) for (const v of row) if (v) n++
  return n / (grid.length * grid.length)
}

function set(grid: Grid, x: number, y: number): void {
  const g = grid.length
  if (x >= 0 && y >= 0 && x < g && y < g) grid[y][x] = true
}

/** 원시 도형 하나를 grid에 그린다. density가 클수록 굵고 촘촘하다 */
export function drawPrimitive(grid: Grid, kind: Primitive, density: number, rng: Rng): void {
  const g = grid.length
  const thick = rng.next() < density ? 2 : 1
  if (kind === 'bands') {
    const count = rng.int(1, 3)
    const dashed = rng.next() < 0.4
    const dash = rng.int(1, 3), gap = rng.int(1, 2)
    for (let i = 0; i < count; i++) {
      const y0 = Math.round(((i + 0.5) * g) / count - thick / 2)
      for (let t = 0; t < thick; t++) for (let x = 0; x < g; x++) if (!dashed || x % (dash + gap) < dash) set(grid, x, y0 + t)
    }
  } else if (kind === 'bars') {
    const count = rng.int(1, 4)
    for (let i = 0; i < count; i++) {
      const x0 = Math.round(((i + 0.5) * g) / count - thick / 2)
      for (let t = 0; t < thick; t++) for (let y = 0; y < g; y++) set(grid, x0 + t, y)
    }
  } else if (kind === 'checker') {
    const block = rng.int(1, 2)
    const span = rng.next() < 0.5 ? g : rng.int(Math.floor(g / 2), g)
    const o = Math.floor((g - span) / 2)
    const phase = rng.int(0, 1)
    for (let y = 0; y < span; y++) for (let x = 0; x < span; x++) if ((Math.floor(x / block) + Math.floor(y / block) + phase) % 2 === 0) set(grid, o + x, o + y)
  } else if (kind === 'dots') {
    const pitch = rng.int(2, 4), size = rng.int(1, 2)
    const span = rng.next() < 0.5 ? g : rng.int(Math.floor(g / 2), g)
    const o = Math.floor((g - span) / 2)
    const off = rng.int(0, pitch - 1)
    for (let y = off; y < span; y += pitch) for (let x = off; x < span; x += pitch)
      for (let dy = 0; dy < size; dy++) for (let dx = 0; dx < size; dx++) set(grid, o + x + dx, o + y + dy)
  } else if (kind === 'step') {
    const lines = rng.int(1, 3)
    const zigzag = rng.next() < 0.5
    for (let i = 0; i < lines; i++) {
      let y = Math.round(((i + 0.5) * g) / lines)
      let dir = rng.next() < 0.5 ? 1 : -1
      const runLen = rng.int(2, 4)
      for (let x = 0; x < g; x++) {
        set(grid, x, y)
        if ((x + 1) % runLen === 0) {
          y += dir
          if (zigzag) dir = -dir
        }
      }
    }
  } else if (kind === 'loop') {
    const m = rng.int(1, Math.max(1, Math.floor(g / 4)))
    const cut = rng.next() < 0.5
    for (let x = m; x < g - m; x++) { set(grid, x, m); set(grid, x, g - 1 - m) }
    for (let y = m; y < g - m; y++) { set(grid, m, y); set(grid, g - 1 - m, y) }
    if (cut) for (const [x, y] of [[m, m], [g - 1 - m, m], [m, g - 1 - m], [g - 1 - m, g - 1 - m]]) grid[y][x] = false
  } else if (kind === 'center') {
    const size = rng.int(2, 4)
    const o = Math.floor((g - size) / 2)
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) set(grid, o + x, o + y)
  } else {
    for (let y = 0; y < g; y++) for (let x = 0; x < g; x++) if (rng.next() < density / 2) grid[y][x] = true
  }
}

export function applySymmetry(grid: Grid, sym: Symmetry): void {
  const g = grid.length
  const half = Math.floor(g / 2)
  if (sym === 'mirror-x' || sym === 'quad') for (let y = 0; y < g; y++) for (let x = 0; x < half; x++) grid[y][g - 1 - x] = grid[y][x]
  if (sym === 'mirror-y' || sym === 'quad') for (let y = 0; y < half; y++) grid[g - 1 - y] = grid[y].slice()
  if (sym === 'rot180') for (let y = 0; y < g; y++) for (let x = 0; x < g; x++) if (grid[g - 1 - y][g - 1 - x]) grid[y][x] = true
}

function pickSymmetry(mode: string, rng: Rng): Symmetry {
  if (mode === 'none') return 'none'
  if (mode === 'mirror') return 'mirror-x'
  if (mode === 'quad') return 'quad'
  const r = rng.next()
  if (r < 0.15) return 'none'
  if (r < 0.45) return 'mirror-x'
  if (r < 0.65) return 'mirror-y'
  if (r < 0.9) return 'quad'
  return 'rot180'
}

/** 원시 도형 1~2개 + 대칭. 빈 글리프나 꽉 찬 글리프는 만들지 않는다 */
export function buildGlyph(g: number, density: number, symmetry: string, shapes: string, rng: Rng): Grid {
  const pool = POOLS[shapes] ?? POOLS.all
  const sym = pickSymmetry(symmetry, rng)
  const layers: Grid[] = []
  const addLayer = () => {
    const layer = makeGrid(g)
    drawPrimitive(layer, rng.pick(pool), density, rng)
    layers.push(layer)
  }
  const compose = (ls: Grid[]): Grid => {
    const out = makeGrid(g)
    for (const l of ls) for (let y = 0; y < g; y++) for (let x = 0; x < g; x++) if (l[y][x]) out[y][x] = true
    applySymmetry(out, sym)
    return out
  }
  addLayer()
  if (rng.next() >= 0.6) addLayer()
  let out = compose(layers)
  let ratio = fillRatio(out)
  // 밀도 보정: 너무 차면 마지막 도형을 버리고, 너무 비면 하나 더 그린다(한 번만)
  if (ratio > density + 0.25 && layers.length > 1) {
    layers.pop()
    out = compose(layers)
    ratio = fillRatio(out)
  } else if (ratio < density - 0.25 && layers.length === 1) {
    addLayer()
    out = compose(layers)
    ratio = fillRatio(out)
  }
  if (ratio >= 0.1 && ratio < 0.5 && rng.next() < 0.15) {
    for (const row of out) for (let x = 0; x < g; x++) row[x] = !row[x]
    ratio = 1 - ratio
  }
  if (ratio === 0 || ratio === 1) {
    const c = makeGrid(g)
    drawPrimitive(c, 'center', density, rng)
    out = compose([c])
  }
  return out
}

export const glyphs: GeneratorDef = {
  id: 'glyphs',
  name: 'Glyphs',
  family: 'grid',
  minColors: 2,
  params: [
    { type: 'range', key: 'cell', label: 'Cell size', min: 2, max: 16, step: 1, default: 4 },
    { type: 'range', key: 'grid', label: 'Glyph size', min: 6, max: 16, step: 1, default: 8 },
    { type: 'range', key: 'across', label: 'Glyphs across', min: 1, max: 8, step: 1, default: 4 },
    { type: 'range', key: 'down', label: 'Glyphs down', min: 1, max: 8, step: 1, default: 2 },
    { type: 'range', key: 'gutter', label: 'Gutter', min: 0, max: 4, step: 1, default: 2 },
    { type: 'range', key: 'density', label: 'Density', min: 0.2, max: 0.8, step: 0.05, default: 0.45 },
    {
      type: 'select', key: 'symmetry', label: 'Symmetry', default: 'auto',
      options: [{ value: 'auto', label: 'Auto' }, { value: 'none', label: 'None' }, { value: 'mirror', label: 'Mirror' }, { value: 'quad', label: 'Quad' }],
    },
    {
      type: 'select', key: 'shapes', label: 'Shapes', default: 'all',
      options: [{ value: 'all', label: 'All' }, { value: 'lines', label: 'Lines' }, { value: 'dots', label: 'Dots' }, { value: 'checker', label: 'Checker' }, { value: 'wave', label: 'Wave' }],
    },
    {
      type: 'select', key: 'colorMode', label: 'Colors', default: 'mono',
      options: [{ value: 'mono', label: 'Mono' }, { value: 'sequence', label: 'Sequence' }, { value: 'random', label: 'Random' }],
    },
  ],
  generate({ params, palette, rng }) {
    const cell = num(params, 'cell'), g = num(params, 'grid')
    const across = num(params, 'across'), down = num(params, 'down'), gutter = num(params, 'gutter')
    const density = num(params, 'density'), symmetry = str(params, 'symmetry'), shapeSet = str(params, 'shapes'), colorMode = str(params, 'colorMode')
    const slot = g + gutter
    const inset = Math.floor(gutter / 2)
    // 글리프마다 하위 시드를 먼저 뽑아 결정성을 유지한다(같은 시드 → 같은 타일)
    const count = across * down
    const subSeeds: number[] = []
    for (let k = 0; k < count; k++) subSeeds.push(rng.int(0, 0x7fffffff))
    const shapes: Shape[] = []
    for (let r = 0; r < down; r++) {
      for (let c = 0; c < across; c++) {
        const k = r * across + c
        const sub = mulberry32(subSeeds[k])
        const grid = buildGlyph(g, density, symmetry, shapeSet, sub)
        const color = colorMode === 'mono' ? fg(palette, 0) : colorMode === 'sequence' ? fg(palette, k) : fg(palette, pickFg(palette, sub))
        const ox = (c * slot + inset) * cell, oy = (r * slot + inset) * cell
        for (let y = 0; y < g; y++) {
          let x = 0
          while (x < g) {
            if (!grid[y][x]) { x++; continue }
            let x1 = x
            while (x1 < g && grid[y][x1]) x1++
            shapes.push(rect(ox + x * cell, oy + y * cell, (x1 - x) * cell, cell, color))
            x = x1
          }
        }
      }
    }
    return { width: across * slot * cell, height: down * slot * cell, background: palette[0], shapes }
  },
}
```

`src/generators/index.ts`: `import { glyphs } from './glyphs'`, `GENERATORS = [stripes, plaid, zigzag, motif, rings, glyphs, gradientBars, isoCubes, triangles]`.

- [ ] **Step 4: 통과 확인·브라우저·커밋**

Run: `npx vitest run src/generators` → PASS. `npm test && npm run lint && npm run build` → 통과. 브라우저: 드롭다운에서 Glyphs 선택 → Randomize 10회 연타로 형태가 다양(선·점·체커·계단·고리)하고 빈 글리프가 없으며 3×3 이음새가 자연스러움. Zigzag에 Wave를 켠 상태에서 Glyphs로 바꿔도 효과가 유지되는지 확인.

```bash
git add src/generators
git commit -m "feat(generators): Glyphs — 원시 도형 8종·대칭 문법의 픽셀 글리프 타일"
```

---

### Task 8: 검증, 스크린샷, README (배포·설계서 배포 기록은 컨트롤러가 최종 리뷰 후)

**Files:**
- Modify: `README.md`
- Create: `docs/screenshots/effects-wave-zigzag.png`, `docs/screenshots/effects-bands-boogie.png`, `docs/screenshots/09-glyphs.png`

- [ ] **Step 1: 브라우저 검증** (1440×1024, 라이트 테마, `npx vite --port 5175 --strictPort`, 해시 변경 후에는 `about:blank` → URL)

1. 빈 URL → Zigzag, Effects 섹션에 Warp(Bands, Wave, Fold, Shade) / Texture(6종) 소제목·순서.
2. Zigzag + Wave(periods 1, amplitude 8): 행이 큰 사인곡선을 따라 굽고 3×3 경계 좌우·상하 픽셀 연속.
3. Gradient Bars + Boogie 프리셋(Unlock all) + Bands(8, shift 30, alternate, taper 0.8): 띠마다 막대가 어긋나고 중앙 띠가 얇다.
4. Gradient Bars + Fold(horizontal) + Shade(dark 80): 좌우 대칭·중앙 암부.
5. Grain size 1 at scale 4: 입자가 1 px(배율 1과 같은 픽셀 크기).
6. Glyphs: Randomize 10회 → 형태 다양, 내보내기 PNG 정상.
7. 기본 상태 Copy link 길이가 v1.2 라이브보다 짧다(약 230자); 효과 하나 켠 링크 새 탭 복원.
8. Randomize·Unlock all이 effects 불변. 콘솔 오류 0.

- [ ] **Step 2: 스크린샷** (절대 경로로 저장)

- `effects-wave-zigzag.png`: 2번 상태, Fill 뷰, Effects 섹션이 보이도록 패널 스크롤.
- `effects-bands-boogie.png`: 3번 상태.
- `09-glyphs.png`: Glyphs 기본값 + Bauhaus 프리셋(Unlock all), colorMode sequence.

- [ ] **Step 3: README (영문·한국어 동일)**

- `## What is Jacquard?`: 생성기 수 8 → 9(Glyphs), Warp 한 문장(반복 패턴을 사인 변위·구간 위상 이동·거울·명암으로 2차 변조).
- `## Screenshots`: 행 추가 — `Effects — wave on zigzag` / `Effects — bands (Boogie)`, `Glyphs — Bauhaus`.
- `## Features`: 생성기 표에 `| grid | **Glyphs** | Pixel glyphs — lines, bars, checkers, dots, steps and loops with symmetry, one sub-seed per glyph | Cell 2–16, glyph size 6–16, glyphs across/down 1–8, gutter 0–4, density 0.2–0.8, symmetry auto / none / mirror / quad, shapes all / lines / dots / checker / wave, colours mono / sequence / random |`. Post-processing 불릿을 두 그룹으로: **Warp** (bands → wave → fold → shade, 타일 unit·정수 주기로 이음새 유지) 와 **Texture** (기존 6종). Grain은 출력 px 단위임을 명시.
- `## Controls`: Effects 행에 Warp/Texture 소제목 설명.
- `## How a tile is built`: warp 단계 한 줄(리샘플링, 감기).
- `## Known limitations`: Grain 항목(출력 px, 미리보기 상한 시 k배 굵게 보임); 워프도 래스터 전용; Bands random은 시드에 묶임.
- 프로젝트 구조 트리에 `post/resample.ts wave.ts bands.ts fold.ts shade.ts`, `generators/glyphs.ts`, `ui/*.test.tsx` 추가. 테스트 수 4곳을 실제 `npm test` 값으로.
- 한국어 절 동일하게.

- [ ] **Step 4: 검증·커밋**

Run: `npm test && npm run lint && npm run build` → 통과.

```bash
git add README.md docs/screenshots
git commit -m "docs: v1.3 README·스크린샷(워프·Glyphs)"
```

---

## 자체 검토 결과 (계획 작성자)

- 스펙 커버리지: §3.1–3.2 → Task 1; §3.3–3.4 → Task 2; §3.5–3.6 → Task 3; §4 → Task 4; §5 → Task 7; §6.1·6.3 → Task 5; §6.2·6.4 → Task 4; §7 → Task 6; §9 UI → Task 1·5; §10 검증 → 각 Task 테스트 + Task 8; §11 순서 = Task 1~8.
- 스펙 보정 1건: §5.2의 하위 시드를 `seed ^ imul(...)`에서 "rng에서 글리프 수만큼 먼저 뽑기"로 바꿨다(`GenContext`에 `seed`가 없음). 결정성은 동일하게 유지되며 설계서도 같은 커밋에서 수정한다.
- 타입 일관성: `EffectGroup`은 `post/types.ts`에 정의하고 `EffectsPanel`이 `import type`으로 가져온다. `bandBounds`·`drawPrimitive`·`applySymmetry`·`buildGlyph`는 테스트가 쓰므로 export. `encodeState`의 두 번째 인자는 `EffectInfo[]`(core/state에 이미 있음).
- Task 1의 순서 단언은 중간 상태(warp 비어 있음)에 맞춰 두고 Task 3에서 최종 형태로 교체한다고 명시.
- 접근성 이름 고유성 테스트는 슬라이더끼리·주사위끼리로 한정한다(슬라이더와 숫자 필드가 같은 이름을 쓰는 v1.1 보류 항목은 범위 밖).
- 자리표시자 없음. 코드 블록의 수치는 손으로 검산함(Shade 64행 중앙·가장자리, 하프톤 부분 셀 커버리지 0.75 vs 0.81, NumberField 7.3 → 8).
