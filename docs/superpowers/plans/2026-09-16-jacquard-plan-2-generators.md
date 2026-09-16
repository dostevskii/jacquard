# Jacquard 구현 계획 2부 — 생성기 7종

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 1부에서 만든 레지스트리에 `plaid`, `zigzag`, `motif`, `rings`, `gradientBars`, `isoCubes`, `triangles` 생성기를 순서대로 추가해 설계서의 8종을 완성한다.

**Architecture:** 각 생성기는 `GeneratorDef` 객체 하나를 export하는 파일이다. `generate()`는 매개변수·팔레트·rng만 받아 반복 타일 1장의 `Scene`을 돌려준다. 타일 경계를 넘는 도형은 `tileWrap`으로 감는다. 레지스트리 `GENERATORS` 배열과 공통 테스트의 `CASES` 배열에 한 줄씩 추가하면 UI 드롭다운과 공통 테스트가 자동으로 생성기를 인식한다.

**Tech Stack:** TypeScript, Vitest. 새 의존성 없음.

**Spec:** `docs/superpowers/specs/2026-09-16-jacquard-design.md` 5.2~5.8절. 실행자는 해당 절과 4.4절(`tileWrap` 규약)을 먼저 읽는다.

**선행 조건:** 1부(`2026-09-16-jacquard-plan-1-foundation.md`)가 모두 완료되어 `npm test`, `npm run lint`, `npm run build`가 통과하는 상태.

## Global Constraints

- 1부의 Global Constraints가 그대로 적용된다(런타임 의존성 추가 금지, `import type`, DOM 참조 금지, `palette[0]` = 배경, 각 Task 종료 시 test·lint·build 통과 후 커밋).
- 생성기 파일은 `src/generators/<id>.ts`, 테스트는 `src/generators/<id>.test.ts`. 테스트 헬퍼는 `./testUtils`에서 import한다.
- 모든 생성기는 `GenContext`의 `rng`만으로 무작위성을 얻는다. `Math.random` 금지.
- 공통 테스트(`generators.test.ts`)는 "등록된 모든 생성기는 CASES에 있어야 한다"를 검사한다. 레지스트리에 추가하면서 CASES 행을 빠뜨리면 실패한다.
- 드롭다운 순서는 `GENERATORS` 배열 순서다. 최종 순서: stripes, plaid, zigzag, motif, rings, gradientBars, isoCubes, triangles.
- 브라우저 육안 검증 스크린샷은 `docs/screenshots/0N-<id>.png`로 저장한다(N은 2부터).

---

## 1부에서 쓸 수 있는 인터페이스 (요약)

```ts
// core/prng.ts
interface Rng { next(): number; int(min: number, max: number): number; pick<T>(items: readonly T[]): T; shuffle<T>(items: readonly T[]): T[] }
// core/scene.ts
type Paint = { type: 'solid'; color: string } | { type: 'linear'; x1: number; y1: number; x2: number; y2: number; stops: { offset: number; color: string }[] }
type Shape = { kind: 'rect'; x: number; y: number; w: number; h: number; fill: Paint } | { kind: 'polygon'; points: number[]; fill: Paint }
interface Scene { width: number; height: number; background: string; shapes: Shape[] }
function tileWrap(shapes: Shape[], width: number, height: number): Shape[]
function clipShapeToRect(s: Shape, x0: number, y0: number, x1: number, y1: number): Shape | null
function reflectShape(s: Shape, axis: 'x' | 'y', size: number): Shape
function polygonArea(points: number[]): number
function shapeBounds(s: Shape): { x0: number; y0: number; x1: number; y1: number }
// core/params.ts
function num(p: Params, key: string): number;  function str(p: Params, key: string): string;  function bool(p: Params, key: string): boolean
// core/color.ts
function mix(a: string, b: string, t?: number): string
// generators/util.ts
function fg(palette: string[], i: number): string            // palette[1..] 순환
function pickFg(palette: string[], rng: Rng, avoidIndex?: number): number   // 전경 인덱스(0부터)
function rect(x: number, y: number, w: number, h: number, color: string): Shape
function poly(points: number[], color: string): Shape
// generators/types.ts
interface GenContext { params: Params; palette: string[]; rng: Rng }
interface GeneratorDef { id: string; name: string; family: 'grid' | 'gradient' | 'tessellation'; minColors: number; params: ParamDef[]; generate(ctx: GenContext): Scene }
// generators/testUtils.ts
const PALETTE8: string[];  function run(id: string, overrides?: Params, palette?: string[], seed?: number): Scene;  function colorsOf(scene: Scene): string[]
```

---

### Task 11: `plaid` — 타탄·격자 (grid)

**Files:**
- Create: `src/generators/plaid.ts`
- Modify: `src/generators/index.ts` (import 1줄, 배열 항목 1개), `src/generators/generators.test.ts` (CASES 행 1개)
- Test: `src/generators/plaid.test.ts`

**Interfaces:**
- Produces: `export const plaid: GeneratorDef` (id `'plaid'`, family `'grid'`, minColors 3)
- 매개변수: `cell`(2..32, 8), `sett`(2..8, 4), `maxStripe`(1..8, 4), `symmetric`(true), `sameSett`(true), `blend`(mix | weave | alternate, mix)

- [ ] **Step 1: 테스트 작성**

`src/generators/plaid.test.ts`
```ts
import { describe, it, expect } from 'vitest'
import { run, PALETTE8, colorsOf } from './testUtils'

describe('plaid', () => {
  it('tile is square when sameSett is on and is a multiple of cell', () => {
    const s = run('plaid', { cell: 10, sameSett: true })
    expect(s.width).toBe(s.height)
    expect(s.width % 10).toBe(0)
  })

  it('symmetric sett mirrors around the pivot stripe (cyclic palindrome)', () => {
    const n = 4
    const s = run('plaid', { cell: 10, sett: n, symmetric: true, blend: 'mix', sameSett: true })
    // 첫 weft 줄(y === 0)의 rect 폭 순서 = warp 세트 순서
    const widths = s.shapes
      .filter((sh) => sh.kind === 'rect' && sh.y === 0)
      .map((sh) => (sh.kind === 'rect' ? sh.w : 0))
    expect(widths).toHaveLength(2 * n - 2)
    for (let k = 1; k <= n - 2; k++) expect(widths[n - 1 - k]).toBe(widths[n - 1 + k])
  })

  it('non-symmetric sett has exactly sett stripes', () => {
    const s = run('plaid', { cell: 10, sett: 5, symmetric: false, blend: 'mix', sameSett: true })
    const row0 = s.shapes.filter((sh) => sh.kind === 'rect' && sh.y === 0)
    expect(row0).toHaveLength(5)
  })

  it('weave and alternate modes only use palette colors; mix mode blends', () => {
    for (const c of colorsOf(run('plaid', { blend: 'weave' }))) expect(PALETTE8).toContain(c)
    for (const c of colorsOf(run('plaid', { blend: 'alternate' }))) expect(PALETTE8).toContain(c)
    expect(colorsOf(run('plaid', { blend: 'mix' })).some((c) => !PALETTE8.includes(c))).toBe(true)
  })

  it('covers the tile exactly in every blend mode', () => {
    for (const blend of ['mix', 'weave', 'alternate']) {
      const s = run('plaid', { blend })
      const area = s.shapes.reduce((a, sh) => a + (sh.kind === 'rect' ? sh.w * sh.h : 0), 0)
      expect(area).toBeCloseTo(s.width * s.height)
    }
  })
})
```

`src/generators/generators.test.ts`의 `CASES`에 추가:
```ts
  { id: 'plaid', rngParams: { blend: 'weave' }, mixedColors: true },
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/generators`
Expected: FAIL — plaid 테스트는 `unknown generator plaid`, 공통 테스트의 CASES 검사도 실패

- [ ] **Step 3: 구현**

`src/generators/plaid.ts`
```ts
import type { GeneratorDef } from './types'
import type { Shape } from '../core/scene'
import { num, str, bool } from '../core/params'
import { mix } from '../core/color'
import { fg, pickFg, rect } from './util'

interface Stripe {
  w: number
  color: string
}

export const plaid: GeneratorDef = {
  id: 'plaid',
  name: 'Plaid',
  family: 'grid',
  minColors: 3,
  params: [
    { type: 'range', key: 'cell', label: 'Cell size', min: 2, max: 32, step: 1, default: 8 },
    { type: 'range', key: 'sett', label: 'Stripes per half sett', min: 2, max: 8, step: 1, default: 4 },
    { type: 'range', key: 'maxStripe', label: 'Max stripe width', min: 1, max: 8, step: 1, default: 4 },
    { type: 'toggle', key: 'symmetric', label: 'Symmetric sett', default: true },
    { type: 'toggle', key: 'sameSett', label: 'Same sett for weft', default: true },
    {
      type: 'select', key: 'blend', label: 'Crossing', default: 'mix',
      options: [
        { value: 'mix', label: 'Mix' },
        { value: 'weave', label: 'Weave' },
        { value: 'alternate', label: 'Alternate' },
      ],
    },
  ],
  generate({ params, palette, rng }) {
    const cell = num(params, 'cell')
    const sett = num(params, 'sett')
    const maxStripe = num(params, 'maxStripe')
    const symmetric = bool(params, 'symmetric')
    const sameSett = bool(params, 'sameSett')
    const blend = str(params, 'blend')

    const makeSett = (): Stripe[] => {
      const half: Stripe[] = []
      let prev: number | undefined
      for (let i = 0; i < sett; i++) {
        const ci = pickFg(palette, rng, prev)
        prev = ci
        half.push({ w: rng.int(1, maxStripe), color: fg(palette, ci) })
      }
      if (!symmetric) return half
      // 양 끝(pivot) 줄은 한 번만 두고 가운데를 거울 복사한다: s1..sn, s(n-1)..s2
      return half.concat(half.slice(1, -1).reverse())
    }

    const warp = makeSett()
    const weft = sameSett ? warp : makeSett()
    const total = (s: Stripe[]) => s.reduce((a, b) => a + b.w, 0)
    const width = total(warp) * cell
    const height = total(weft) * cell

    const shapes: Shape[] = []
    let y = 0
    for (let j = 0; j < weft.length; j++) {
      const wf = weft[j]
      const h = wf.w * cell
      let x = 0
      for (let i = 0; i < warp.length; i++) {
        const wp = warp[i]
        const w = wp.w * cell
        if (wp.color === wf.color) {
          shapes.push(rect(x, y, w, h, wp.color))
        } else if (blend === 'mix') {
          shapes.push(rect(x, y, w, h, mix(wp.color, wf.color)))
        } else if (blend === 'alternate') {
          shapes.push(rect(x, y, w, h, (i + j) % 2 === 0 ? wp.color : wf.color))
        } else {
          // weave: 1 cell 체커. 전역 셀 좌표로 판정해 줄 경계에서도 체커가 이어진다
          for (let cy = 0; cy < wf.w; cy++) {
            for (let cx = 0; cx < wp.w; cx++) {
              const gx = x / cell + cx
              const gy = y / cell + cy
              shapes.push(rect(x + cx * cell, y + cy * cell, cell, cell, (gx + gy) % 2 === 0 ? wp.color : wf.color))
            }
          }
        }
        x += w
      }
      y += h
    }
    // 모든 도형이 타일 안에 정확히 놓이므로 tileWrap 불필요
    return { width, height, background: palette[0], shapes }
  },
}
```

`src/generators/index.ts` — import와 배열에 추가
```ts
import { plaid } from './plaid'
// ...
export const GENERATORS: GeneratorDef[] = [stripes, plaid]
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/generators`
Expected: PASS (plaid 공통 10개 + 전용 5개 추가)

- [ ] **Step 5: 브라우저 확인 후 커밋**

Run: `npm run dev` 상태에서 드롭다운에서 Plaid 선택 → Crossing 세 모드를 바꿔 보고 3 × 3 뷰에서 경계가 이어지는지 확인 → `docs/screenshots/02-plaid.png` 저장

```bash
npm test && npm run lint && npm run build
git add src/generators docs/screenshots
git commit -m "feat(generators): plaid 타탄·격자 생성기"
```

---

### Task 12: `zigzag` — 셰브런 (grid)

**Files:**
- Create: `src/generators/zigzag.ts`
- Modify: `src/generators/index.ts`, `src/generators/generators.test.ts`
- Test: `src/generators/zigzag.test.ts`

**Interfaces:**
- Produces: `export const zigzag: GeneratorDef` (id `'zigzag'`, family `'grid'`, minColors 3)
- 매개변수: `cell`(2..32, 6), `wavelength`(4..64 step 2, 16), `amplitude`(1..32, 6; 0도 허용하도록 min 0), `bandHeight`(1..16, 3), `bands`(2..12, 6), `colorMode`(sequence | random)

- [ ] **Step 1: 테스트 작성**

`src/generators/zigzag.test.ts`
```ts
import { describe, it, expect } from 'vitest'
import { run, PALETTE8 } from './testUtils'

describe('zigzag', () => {
  it('tile size = wavelength × cell by bands × bandHeight × cell', () => {
    const s = run('zigzag', { cell: 5, wavelength: 12, bands: 4, bandHeight: 3 })
    expect(s.width).toBe(60)
    expect(s.height).toBe(60)
  })

  it('with zero amplitude every column is plain horizontal bands', () => {
    const s = run('zigzag', { cell: 5, wavelength: 8, bands: 3, bandHeight: 2, amplitude: 0 })
    expect(s.shapes).toHaveLength(8 * 3)
    const col0 = s.shapes.filter((sh) => sh.kind === 'rect' && sh.x === 0)
    expect(col0.map((sh) => (sh.kind === 'rect' ? sh.y : -1)).sort((a, b) => a - b)).toEqual([0, 10, 20])
  })

  it('the peak column is shifted by the amplitude', () => {
    const s = run('zigzag', { cell: 5, wavelength: 8, bands: 3, bandHeight: 2, amplitude: 2, colorMode: 'sequence' })
    const colorAt = (x: number, y: number) => {
      const r = s.shapes.find((sh) => sh.kind === 'rect' && sh.x === x && y >= sh.y && y < sh.y + sh.h)
      return r && r.fill.type === 'solid' ? r.fill.color : null
    }
    // x=0 열의 맨 위는 띠 0. 반 파장(x=4셀=20px)에서 오프셋 2 = 띠 두께이므로 띠 1이 맨 위
    expect(colorAt(0, 0)).toBe(PALETTE8[1])
    expect(colorAt(20, 0)).toBe(PALETTE8[2])
  })

  it('covers the tile exactly', () => {
    const s = run('zigzag')
    const area = s.shapes.reduce((a, sh) => a + (sh.kind === 'rect' ? sh.w * sh.h : 0), 0)
    expect(area).toBeCloseTo(s.width * s.height)
  })
})
```

`generators.test.ts`의 `CASES`에 추가:
```ts
  { id: 'zigzag', rngParams: { colorMode: 'random' } },
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/generators`
Expected: FAIL — `unknown generator zigzag`

- [ ] **Step 3: 구현**

`src/generators/zigzag.ts`
```ts
import type { GeneratorDef } from './types'
import type { Shape } from '../core/scene'
import { num, str } from '../core/params'
import { fg, pickFg, rect } from './util'

/** 삼각파: 0 → 1 → 0, 주기 1 */
function tri(t: number): number {
  const f = t - Math.floor(t)
  return f < 0.5 ? f * 2 : 2 - f * 2
}

export const zigzag: GeneratorDef = {
  id: 'zigzag',
  name: 'Zigzag',
  family: 'grid',
  minColors: 3,
  params: [
    { type: 'range', key: 'cell', label: 'Cell size', min: 2, max: 32, step: 1, default: 6 },
    { type: 'range', key: 'wavelength', label: 'Wavelength', min: 4, max: 64, step: 2, default: 16 },
    { type: 'range', key: 'amplitude', label: 'Amplitude', min: 0, max: 32, step: 1, default: 6 },
    { type: 'range', key: 'bandHeight', label: 'Band height', min: 1, max: 16, step: 1, default: 3 },
    { type: 'range', key: 'bands', label: 'Bands', min: 2, max: 12, step: 1, default: 6 },
    {
      type: 'select', key: 'colorMode', label: 'Colors', default: 'sequence',
      options: [
        { value: 'sequence', label: 'Sequence' },
        { value: 'random', label: 'Random' },
      ],
    },
  ],
  generate({ params, palette, rng }) {
    const cell = num(params, 'cell')
    const wl = num(params, 'wavelength')
    const amp = num(params, 'amplitude')
    const bandH = num(params, 'bandHeight')
    const bands = num(params, 'bands')
    const mode = str(params, 'colorMode')

    const period = bands * bandH // 세로 주기(cell)
    const colors: string[] = []
    let prev: number | undefined
    for (let i = 0; i < bands; i++) {
      const ci = mode === 'random' ? pickFg(palette, rng, prev) : i
      prev = ci
      colors.push(fg(palette, ci))
    }

    const shapes: Shape[] = []
    for (let x = 0; x < wl; x++) {
      const off = Math.round(amp * tri(x / wl))
      let runStart = 0
      let runBand = -1
      for (let y = 0; y <= period; y++) {
        const band = y < period ? (((Math.floor((y + off) / bandH) % bands) + bands) % bands) : -2
        if (band !== runBand) {
          if (runBand >= 0) shapes.push(rect(x * cell, runStart * cell, cell, (y - runStart) * cell, colors[runBand]))
          runStart = y
          runBand = band
        }
      }
    }
    // 가로 주기 = wavelength, 세로 주기 = bands × bandHeight 이므로 타일이 곧 주기. tileWrap 불필요
    return { width: wl * cell, height: period * cell, background: palette[0], shapes }
  },
}
```

`src/generators/index.ts`: `import { zigzag } from './zigzag'`, 배열 `[stripes, plaid, zigzag]`

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/generators`
Expected: PASS

- [ ] **Step 5: 브라우저 확인 후 커밋**

Zigzag 선택, Missoni Blue 프리셋(3부 전까지는 URL 해시로 팔레트를 바꾸거나 기본 팔레트 그대로 확인), 3 × 3 경계 확인 → `docs/screenshots/03-zigzag.png`

```bash
npm test && npm run lint && npm run build
git add src/generators docs/screenshots
git commit -m "feat(generators): zigzag 셰브런 생성기"
```

---

### Task 13: `motif` — 페어아일 모티프 (grid)

**Files:**
- Create: `src/generators/motif.ts`
- Modify: `src/generators/index.ts`, `src/generators/generators.test.ts`
- Test: `src/generators/motif.test.ts`

**Interfaces:**
- Produces: `export const motif: GeneratorDef` (id `'motif'`, family `'grid'`, minColors 3)
- 매개변수: `cell`(4..32, 10), `size`(7..31 step 2, 15), `density`(0.1..0.6 step 0.05, 0.3), `symmetry`(quad | oct), `smooth`(0..2, 1), `spacing`(0..6, 2), `bandRows`(0..4, 2), `stagger`(false)

- [ ] **Step 1: 테스트 작성**

`src/generators/motif.test.ts`
```ts
import { describe, it, expect } from 'vitest'
import type { Scene } from '../core/scene'
import { run, PALETTE8 } from './testUtils'

/** 모티프 색 rect를 size × size 불리언 격자로 되돌린다 (spacing 0, bandRows 0, stagger false 전제) */
function motifGrid(size: number, cell: number, scene: Scene, color: string): boolean[][] {
  const g = Array.from({ length: size }, () => Array<boolean>(size).fill(false))
  for (const sh of scene.shapes) {
    if (sh.kind !== 'rect' || sh.fill.type !== 'solid' || sh.fill.color !== color) continue
    const x = Math.round(sh.x / cell)
    const y = Math.round(sh.y / cell)
    if (x < size && y < size) g[y][x] = true
  }
  return g
}

describe('motif', () => {
  it('tile size follows size, spacing, bandRows and stagger', () => {
    expect(run('motif', { cell: 10, size: 9, spacing: 2, bandRows: 3, stagger: false })).toMatchObject({ width: 110, height: 140 })
    expect(run('motif', { cell: 10, size: 9, spacing: 2, bandRows: 3, stagger: true })).toMatchObject({ width: 110, height: 280 })
  })

  it('quad symmetry mirrors horizontally and vertically', () => {
    const size = 11, cell = 10
    const s = run('motif', { cell, size, spacing: 0, bandRows: 0, stagger: false, symmetry: 'quad', density: 0.4 })
    const g = motifGrid(size, cell, s, PALETTE8[1])
    expect(g.flat().some(Boolean)).toBe(true)
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        expect(g[y][x]).toBe(g[y][size - 1 - x])
        expect(g[y][x]).toBe(g[size - 1 - y][x])
      }
    }
  })

  it('oct symmetry also mirrors across the diagonal', () => {
    const size = 9, cell = 10
    const s = run('motif', { cell, size, spacing: 0, bandRows: 0, stagger: false, symmetry: 'oct', density: 0.4 })
    const g = motifGrid(size, cell, s, PALETTE8[1])
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) expect(g[y][x]).toBe(g[x][y])
  })

  it('smoothing never removes filled cells', () => {
    const size = 11, cell = 10
    const base = motifGrid(size, cell, run('motif', { cell, size, spacing: 0, bandRows: 0, smooth: 0, density: 0.3 }), PALETTE8[1])
    const smoothed = motifGrid(size, cell, run('motif', { cell, size, spacing: 0, bandRows: 0, smooth: 2, density: 0.3 }), PALETTE8[1])
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (base[y][x]) expect(smoothed[y][x]).toBe(true)
  })

  it('band rows use two alternating colors across the full width', () => {
    const s = run('motif', { cell: 10, size: 7, spacing: 0, bandRows: 2, stagger: false })
    const band = s.shapes.filter((sh) => sh.kind === 'rect' && sh.y >= 70)
    expect(band).toHaveLength(7 * 2)
    const colors = new Set(band.map((sh) => (sh.fill.type === 'solid' ? sh.fill.color : '')))
    expect(colors).toEqual(new Set([PALETTE8[2], PALETTE8[3]]))
  })
})
```

`generators.test.ts`의 `CASES`에 추가:
```ts
  { id: 'motif', rngParams: { density: 0.5 } },
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/generators`
Expected: FAIL — `unknown generator motif`

- [ ] **Step 3: 구현**

`src/generators/motif.ts`
```ts
import type { GeneratorDef } from './types'
import type { Shape } from '../core/scene'
import { tileWrap } from '../core/scene'
import { num, str, bool } from '../core/params'
import type { Rng } from '../core/prng'
import { fg, rect } from './util'

/** size × size 대칭 모티프. 사분면(oct는 팔분면)만 rng로 채우고 나머지는 거울 복사 */
function buildMotif(size: number, density: number, symmetry: string, smooth: number, rng: Rng): boolean[][] {
  const grid: boolean[][] = Array.from({ length: size }, () => Array<boolean>(size).fill(false))
  const half = (size + 1) / 2 // 중심 행·열 포함
  for (let y = 0; y < half; y++) {
    for (let x = 0; x < half; x++) {
      if (symmetry === 'oct' && x > y) continue
      grid[y][x] = rng.next() < density
    }
  }
  if (symmetry === 'oct') {
    for (let y = 0; y < half; y++) for (let x = y + 1; x < half; x++) grid[y][x] = grid[x][y]
  }
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const sx = x < half ? x : size - 1 - x
      const sy = y < half ? y : size - 1 - y
      grid[y][x] = grid[sy][sx]
    }
  }
  for (let pass = 0; pass < smooth; pass++) {
    const next = grid.map((row) => row.slice())
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (grid[y][x]) continue
        let n = 0
        if (y > 0 && grid[y - 1][x]) n++
        if (y < size - 1 && grid[y + 1][x]) n++
        if (x > 0 && grid[y][x - 1]) n++
        if (x < size - 1 && grid[y][x + 1]) n++
        if (n >= 2) next[y][x] = true
      }
    }
    for (let y = 0; y < size; y++) grid[y] = next[y]
  }
  return grid
}

export const motif: GeneratorDef = {
  id: 'motif',
  name: 'Motif',
  family: 'grid',
  minColors: 3,
  params: [
    { type: 'range', key: 'cell', label: 'Cell size', min: 4, max: 32, step: 1, default: 10 },
    { type: 'range', key: 'size', label: 'Motif size', min: 7, max: 31, step: 2, default: 15 },
    { type: 'range', key: 'density', label: 'Density', min: 0.1, max: 0.6, step: 0.05, default: 0.3 },
    {
      type: 'select', key: 'symmetry', label: 'Symmetry', default: 'quad',
      options: [
        { value: 'quad', label: '4-way' },
        { value: 'oct', label: '8-way' },
      ],
    },
    { type: 'range', key: 'smooth', label: 'Smoothing', min: 0, max: 2, step: 1, default: 1 },
    { type: 'range', key: 'spacing', label: 'Spacing', min: 0, max: 6, step: 1, default: 2 },
    { type: 'range', key: 'bandRows', label: 'Band rows', min: 0, max: 4, step: 1, default: 2 },
    { type: 'toggle', key: 'stagger', label: 'Stagger rows', default: false },
  ],
  generate({ params, palette, rng }) {
    const cell = num(params, 'cell')
    const size = num(params, 'size')
    const density = num(params, 'density')
    const symmetry = str(params, 'symmetry')
    const smooth = num(params, 'smooth')
    const spacing = num(params, 'spacing')
    const bandRows = num(params, 'bandRows')
    const stagger = bool(params, 'stagger')

    const grid = buildMotif(size, density, symmetry, smooth, rng)
    const unitW = (size + spacing) * cell
    const rowH = (size + spacing + bandRows) * cell
    const rowsInTile = stagger ? 2 : 1
    const width = unitW
    const height = rowH * rowsInTile
    const motifColor = palette[1]
    const bandA = fg(palette, 1)
    const bandB = fg(palette, 2)

    const shapes: Shape[] = []
    for (let r = 0; r < rowsInTile; r++) {
      const oy = r * rowH
      const ox = stagger && r === 1 ? unitW / 2 : 0
      const mx = ox + (spacing * cell) / 2
      const my = oy + (spacing * cell) / 2
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          if (grid[y][x]) shapes.push(rect(mx + x * cell, my + y * cell, cell, cell, motifColor))
        }
      }
      if (bandRows > 0) {
        const by = oy + (size + spacing) * cell
        const across = size + spacing
        for (let j = 0; j < bandRows; j++) {
          for (let i = 0; i < across; i++) {
            shapes.push(rect(i * cell, by + j * cell, cell, cell, (i + j) % 2 === 0 ? bandA : bandB))
          }
        }
      }
    }
    // stagger가 켜지면 둘째 행 모티프가 오른쪽 경계를 넘으므로 감는다
    return { width, height, background: palette[0], shapes: tileWrap(shapes, width, height) }
  },
}
```

`src/generators/index.ts`: `import { motif } from './motif'`, 배열 `[stripes, plaid, zigzag, motif]`

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/generators`
Expected: PASS

- [ ] **Step 5: 브라우저 확인 후 커밋**

Motif 선택, Stagger 켜고 3 × 3 경계 확인, 8-way 대칭 확인 → `docs/screenshots/04-motif.png`

```bash
npm test && npm run lint && npm run build
git add src/generators docs/screenshots
git commit -m "feat(generators): motif 페어아일 모티프 생성기"
```

---

### Task 14: `rings` — 동심 사각 타일 (grid)

**Files:**
- Create: `src/generators/rings.ts`
- Modify: `src/generators/index.ts`, `src/generators/generators.test.ts`
- Test: `src/generators/rings.test.ts`

**Interfaces:**
- Produces: `export const rings: GeneratorDef` (id `'rings'`, family `'grid'`, minColors 3)
- 매개변수: `cell`(4..40, 20), `cols`(6..40, 16), `rows`(6..40, 12), `grout`(0..4 step 0.5, 2), `maxRing`(1..4, 2), `center`(solid | checker | stripes, checker)

- [ ] **Step 1: 테스트 작성**

`src/generators/rings.test.ts`
```ts
import { describe, it, expect } from 'vitest'
import { run, PALETTE8, colorsOf } from './testUtils'

describe('rings', () => {
  it('tile is cols × rows cells with one rect per cell', () => {
    const s = run('rings', { cell: 10, cols: 8, rows: 6 })
    expect(s.width).toBe(80)
    expect(s.height).toBe(60)
    expect(s.shapes).toHaveLength(48)
  })

  it('grout shrinks each cell on all sides', () => {
    const s = run('rings', { cell: 10, grout: 2 })
    for (const sh of s.shapes) {
      expect(sh.kind === 'rect' && sh.w).toBe(8)
      expect(sh.kind === 'rect' && sh.h).toBe(8)
      expect(sh.kind === 'rect' && (sh.x - 1) % 10).toBe(0)
    }
  })

  it('the outer ring is one color all the way around', () => {
    const cell = 10, cols = 10, rows = 8
    const s = run('rings', { cell, cols, rows, grout: 0 })
    const at = (i: number, j: number) => {
      const r = s.shapes.find((sh) => sh.kind === 'rect' && Math.round(sh.x / cell) === i && Math.round(sh.y / cell) === j)
      return r && r.fill.type === 'solid' ? r.fill.color : ''
    }
    const c = at(0, 0)
    expect(PALETTE8.slice(1)).toContain(c)
    for (let i = 0; i < cols; i++) {
      expect(at(i, 0)).toBe(c)
      expect(at(i, rows - 1)).toBe(c)
    }
    for (let j = 0; j < rows; j++) {
      expect(at(0, j)).toBe(c)
      expect(at(cols - 1, j)).toBe(c)
    }
  })

  it('every center mode only uses palette colors', () => {
    for (const center of ['solid', 'checker', 'stripes']) {
      for (const c of colorsOf(run('rings', { center }))) expect(PALETTE8).toContain(c)
    }
  })
})
```

`generators.test.ts`의 `CASES`에 추가:
```ts
  { id: 'rings', rngParams: { maxRing: 4 } },
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/generators`
Expected: FAIL — `unknown generator rings`

- [ ] **Step 3: 구현**

`src/generators/rings.ts`
```ts
import type { GeneratorDef } from './types'
import type { Shape } from '../core/scene'
import { num, str } from '../core/params'
import { fg, pickFg, rect } from './util'

interface Ring {
  from: number
  to: number
  color: string
}

export const rings: GeneratorDef = {
  id: 'rings',
  name: 'Rings',
  family: 'grid',
  minColors: 3,
  params: [
    { type: 'range', key: 'cell', label: 'Cell size', min: 4, max: 40, step: 1, default: 20 },
    { type: 'range', key: 'cols', label: 'Columns', min: 6, max: 40, step: 1, default: 16 },
    { type: 'range', key: 'rows', label: 'Rows', min: 6, max: 40, step: 1, default: 12 },
    { type: 'range', key: 'grout', label: 'Grout', min: 0, max: 4, step: 0.5, default: 2 },
    { type: 'range', key: 'maxRing', label: 'Max ring width', min: 1, max: 4, step: 1, default: 2 },
    {
      type: 'select', key: 'center', label: 'Center', default: 'checker',
      options: [
        { value: 'solid', label: 'Solid' },
        { value: 'checker', label: 'Checker' },
        { value: 'stripes', label: 'Stripes' },
      ],
    },
  ],
  generate({ params, palette, rng }) {
    const cell = num(params, 'cell')
    const cols = num(params, 'cols')
    const rows = num(params, 'rows')
    const grout = Math.min(num(params, 'grout'), cell - 1)
    const maxRing = num(params, 'maxRing')
    const center = str(params, 'center')

    // 바깥에서 안쪽으로 링 두께 시퀀스. 깊이 2 이상 들어간 뒤에는 35% 확률로 멈추고 나머지를 중심부로 남긴다
    const maxDepth = Math.floor(Math.min(cols, rows) / 2)
    const ringList: Ring[] = []
    let depth = 0
    let prev: number | undefined
    while (depth < maxDepth) {
      const t = rng.int(1, maxRing)
      const ci = pickFg(palette, rng, prev)
      prev = ci
      ringList.push({ from: depth, to: depth + t, color: fg(palette, ci) })
      depth += t
      if (depth >= 2 && rng.next() < 0.35) break
    }
    const last = prev ?? 0
    const c1 = fg(palette, last + 1)
    const c2 = fg(palette, last + 2)

    const shapes: Shape[] = []
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const d = Math.min(i, j, cols - 1 - i, rows - 1 - j)
        const ring = ringList.find((r) => d >= r.from && d < r.to)
        let color: string
        if (ring) color = ring.color
        else if (center === 'solid') color = c1
        else if (center === 'checker') color = (i + j) % 2 === 0 ? c1 : c2
        else color = j % 2 === 0 ? c1 : c2
        shapes.push(rect(i * cell + grout / 2, j * cell + grout / 2, cell - grout, cell - grout, color))
      }
    }
    // 타일 경계가 곧 바깥 링이므로 tileWrap 불필요
    return { width: cols * cell, height: rows * cell, background: palette[0], shapes }
  },
}
```

`src/generators/index.ts`: `import { rings } from './rings'`, 배열 `[stripes, plaid, zigzag, motif, rings]`

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/generators`
Expected: PASS

- [ ] **Step 5: 브라우저 확인 후 커밋**

Rings 선택, Grout를 0과 4로 바꿔 줄눈 확인, 시드를 바꿔 링 구성이 달라지는지 확인 → `docs/screenshots/05-rings.png`

```bash
npm test && npm run lint && npm run build
git add src/generators docs/screenshots
git commit -m "feat(generators): rings 동심 사각 타일 생성기"
```

---

### Task 15: `gradientBars` — 그라데이션 바 (gradient)

**Files:**
- Create: `src/generators/gradientBars.ts`
- Modify: `src/generators/index.ts`, `src/generators/generators.test.ts`
- Test: `src/generators/gradientBars.test.ts`

**Interfaces:**
- Consumes: `clipShapeToRect`, `reflectShape`, `tileWrap` (core/scene)
- Produces: `export const gradientBars: GeneratorDef` (id `'gradientBars'`, family `'gradient'`, minColors 3)
- 매개변수: `columns`(2..64, 12), `barWidth`(8..200, 60), `length`(200..2000 step 10, 800), `direction`(vertical | horizontal), `bands`(1..12, 1), `stagger`(0..1 step 0.05, 0.5), `step`(-1..1 step 0.05, 0), `shape`(linear | symmetric), `colorMode`(pairs | random), `mirrorX`(false), `mirrorY`(false)

- [ ] **Step 1: 테스트 작성**

`src/generators/gradientBars.test.ts`
```ts
import { describe, it, expect } from 'vitest'
import { shapeBounds } from '../core/scene'
import { run } from './testUtils'

describe('gradientBars', () => {
  it('tile size follows direction', () => {
    expect(run('gradientBars', { columns: 4, barWidth: 50, length: 300, direction: 'vertical' })).toMatchObject({ width: 200, height: 300 })
    expect(run('gradientBars', { columns: 4, barWidth: 50, length: 300, direction: 'horizontal' })).toMatchObject({ width: 300, height: 200 })
  })

  it('every fill is a linear gradient along the bar axis', () => {
    const v = run('gradientBars', { direction: 'vertical' })
    for (const sh of v.shapes) {
      expect(sh.fill.type).toBe('linear')
      if (sh.fill.type === 'linear') expect(sh.fill.x1).toBe(sh.fill.x2)
    }
    const h = run('gradientBars', { direction: 'horizontal' })
    for (const sh of h.shapes) if (sh.fill.type === 'linear') expect(sh.fill.y1).toBe(sh.fill.y2)
  })

  it('stagger shifts odd columns and wraps them', () => {
    const s = run('gradientBars', { columns: 2, barWidth: 50, length: 100, bands: 2, stagger: 0.5, step: 0, mirrorX: false, mirrorY: false })
    const ys = (x: number) =>
      s.shapes.filter((sh) => sh.kind === 'rect' && sh.x === x).map((sh) => (sh.kind === 'rect' ? sh.y : -1)).sort((a, b) => a - b)
    expect(ys(0)).toEqual([0, 50])
    expect(ys(50)).toEqual([0, 25, 75])
  })

  it('symmetric shape has three stops A-B-A', () => {
    const s = run('gradientBars', { shape: 'symmetric', colorMode: 'pairs' })
    const f = s.shapes[0].fill
    expect(f.type).toBe('linear')
    if (f.type === 'linear') {
      expect(f.stops).toHaveLength(3)
      expect(f.stops[0].color).toBe(f.stops[2].color)
      expect(f.stops[1].color).not.toBe(f.stops[0].color)
    }
  })

  it('mirrorX makes the tile left-right symmetric', () => {
    const s = run('gradientBars', { columns: 6, barWidth: 50, length: 200, bands: 1, mirrorX: true, mirrorY: false })
    const key = (a: number, b: number, c: number, d: number) => [a, b, c, d].map((v) => v.toFixed(6)).join(',')
    const set = new Set(s.shapes.map((sh) => { const b = shapeBounds(sh); return key(b.x0, b.x1, b.y0, b.y1) }))
    for (const sh of s.shapes) {
      const b = shapeBounds(sh)
      expect(set.has(key(s.width - b.x1, s.width - b.x0, b.y0, b.y1))).toBe(true)
    }
  })

  it('covers the tile exactly', () => {
    const s = run('gradientBars')
    const area = s.shapes.reduce((a, sh) => a + (sh.kind === 'rect' ? sh.w * sh.h : 0), 0)
    expect(area).toBeCloseTo(s.width * s.height)
  })
})
```

`generators.test.ts`의 `CASES`에 추가:
```ts
  { id: 'gradientBars', rngParams: { colorMode: 'random' } },
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/generators`
Expected: FAIL — `unknown generator gradientBars`

- [ ] **Step 3: 구현**

`src/generators/gradientBars.ts`
```ts
import type { GeneratorDef } from './types'
import type { Shape } from '../core/scene'
import { clipShapeToRect, reflectShape, tileWrap } from '../core/scene'
import { num, str, bool } from '../core/params'
import { fg, pickFg } from './util'

/** 왼쪽(또는 위) 절반만 남기고 거울 복사해 좌우(상하) 대칭을 만든다 */
function mirrorHalf(shapes: Shape[], w: number, h: number, axis: 'x' | 'y'): Shape[] {
  const kept: Shape[] = []
  for (const s of shapes) {
    const c = axis === 'x' ? clipShapeToRect(s, 0, 0, w / 2, h) : clipShapeToRect(s, 0, 0, w, h / 2)
    if (c) kept.push(c)
  }
  return kept.concat(kept.map((s) => reflectShape(s, axis, axis === 'x' ? w : h)))
}

export const gradientBars: GeneratorDef = {
  id: 'gradientBars',
  name: 'Gradient Bars',
  family: 'gradient',
  minColors: 3,
  params: [
    { type: 'range', key: 'columns', label: 'Columns', min: 2, max: 64, step: 1, default: 12 },
    { type: 'range', key: 'barWidth', label: 'Bar width', min: 8, max: 200, step: 1, default: 60 },
    { type: 'range', key: 'length', label: 'Bar length', min: 200, max: 2000, step: 10, default: 800 },
    {
      type: 'select', key: 'direction', label: 'Direction', default: 'vertical',
      options: [
        { value: 'vertical', label: 'Vertical' },
        { value: 'horizontal', label: 'Horizontal' },
      ],
    },
    { type: 'range', key: 'bands', label: 'Segments', min: 1, max: 12, step: 1, default: 1 },
    { type: 'range', key: 'stagger', label: 'Stagger', min: 0, max: 1, step: 0.05, default: 0.5 },
    { type: 'range', key: 'step', label: 'Step per column', min: -1, max: 1, step: 0.05, default: 0 },
    {
      type: 'select', key: 'shape', label: 'Gradient', default: 'linear',
      options: [
        { value: 'linear', label: 'A → B' },
        { value: 'symmetric', label: 'A → B → A' },
      ],
    },
    {
      type: 'select', key: 'colorMode', label: 'Colors', default: 'pairs',
      options: [
        { value: 'pairs', label: 'Pairs' },
        { value: 'random', label: 'Random' },
      ],
    },
    { type: 'toggle', key: 'mirrorX', label: 'Mirror horizontally', default: false },
    { type: 'toggle', key: 'mirrorY', label: 'Mirror vertically', default: false },
  ],
  generate({ params, palette, rng }) {
    const columns = num(params, 'columns')
    const barW = num(params, 'barWidth')
    const length = num(params, 'length')
    const dir = str(params, 'direction')
    const bands = num(params, 'bands')
    const stagger = num(params, 'stagger')
    const step = num(params, 'step')
    const shape = str(params, 'shape')
    const mode = str(params, 'colorMode')
    const mirrorX = bool(params, 'mirrorX')
    const mirrorY = bool(params, 'mirrorY')

    const segLen = length / bands
    const shapes: Shape[] = []
    for (let i = 0; i < columns; i++) {
      let a: string
      let b: string
      if (mode === 'random') {
        const ai = pickFg(palette, rng)
        const bi = pickFg(palette, rng, ai)
        a = fg(palette, ai)
        b = fg(palette, bi)
      } else {
        a = fg(palette, 2 * i)
        b = fg(palette, 2 * i + 1)
      }
      const phase = (i % 2) * stagger + i * step
      const shift = (phase - Math.floor(phase)) * segLen
      const stops =
        shape === 'symmetric'
          ? [{ offset: 0, color: a }, { offset: 0.5, color: b }, { offset: 1, color: a }]
          : [{ offset: 0, color: a }, { offset: 1, color: b }]
      const u0 = i * barW
      for (let k = 0; k < bands; k++) {
        const v0 = k * segLen + shift
        if (dir === 'vertical') {
          shapes.push({
            kind: 'rect', x: u0, y: v0, w: barW, h: segLen,
            fill: { type: 'linear', x1: u0, y1: v0, x2: u0, y2: v0 + segLen, stops },
          })
        } else {
          shapes.push({
            kind: 'rect', x: v0, y: u0, w: segLen, h: barW,
            fill: { type: 'linear', x1: v0, y1: u0, x2: v0 + segLen, y2: u0, stops },
          })
        }
      }
    }
    const width = dir === 'vertical' ? columns * barW : length
    const height = dir === 'vertical' ? length : columns * barW
    let out = tileWrap(shapes, width, height)
    if (mirrorX) out = mirrorHalf(out, width, height, 'x')
    if (mirrorY) out = mirrorHalf(out, width, height, 'y')
    return { width, height, background: palette[0], shapes: out }
  },
}
```

`src/generators/index.ts`: `import { gradientBars } from './gradientBars'`, 배열 `[stripes, plaid, zigzag, motif, rings, gradientBars]`

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/generators`
Expected: PASS

- [ ] **Step 5: 브라우저 확인 후 커밋**

Gradient Bars 선택. 확인 항목: 기본값(참고 이미지 4의 직조감), Segments 4 + Step 0.25(이미지 5의 계단), Mirror vertically + A→B→A(이미지 6~8) 각각에서 그라데이션이 보이고 3 × 3 경계가 이어진다 → `docs/screenshots/06-gradient-bars.png`

```bash
npm test && npm run lint && npm run build
git add src/generators docs/screenshots
git commit -m "feat(generators): gradientBars 그라데이션 바 생성기"
```

---

### Task 16: `isoCubes` — 등각 큐브 (tessellation)

**Files:**
- Create: `src/generators/isoCubes.ts`
- Modify: `src/generators/index.ts`, `src/generators/generators.test.ts`
- Test: `src/generators/isoCubes.test.ts`

**Interfaces:**
- Produces: `export const isoCubes: GeneratorDef` (id `'isoCubes'`, family `'tessellation'`, minColors 4)
- 매개변수: `size`(10..120, 40), `cols`(1..8, 2), `rows`(1..8, 2), `gap`(0..8, 0), `shuffle`(false)

- [ ] **Step 1: 테스트 작성**

`src/generators/isoCubes.test.ts`
```ts
import { describe, it, expect } from 'vitest'
import { polygonArea } from '../core/scene'
import { run, PALETTE8, colorsOf } from './testUtils'

const polyArea = (s: ReturnType<typeof run>) =>
  s.shapes.reduce((a, sh) => a + (sh.kind === 'polygon' ? Math.abs(polygonArea(sh.points)) : 0), 0)

describe('isoCubes', () => {
  it('tile size = cols × √3 × size by rows × 3 × size', () => {
    const s = run('isoCubes', { size: 40, cols: 2, rows: 1 })
    expect(s.width).toBeCloseTo(2 * Math.sqrt(3) * 40)
    expect(s.height).toBeCloseTo(120)
  })

  it('only polygons, three faces per cube before wrapping', () => {
    const s = run('isoCubes', { size: 40, cols: 2, rows: 1, gap: 0 })
    expect(s.shapes.every((sh) => sh.kind === 'polygon')).toBe(true)
    // 2열 × (1행 쌍 = 2행) = 4 큐브 × 3면 = 12개 이상 (경계에서 잘린 조각 포함)
    expect(s.shapes.length).toBeGreaterThanOrEqual(12)
  })

  it('polygons cover the tile exactly when gap is 0', () => {
    const s = run('isoCubes', { gap: 0 })
    expect(polyArea(s)).toBeCloseTo(s.width * s.height, 3)
  })

  it('gap leaves background showing', () => {
    const s = run('isoCubes', { gap: 4 })
    expect(polyArea(s)).toBeLessThan(s.width * s.height * 0.95)
  })

  it('without shuffle the three faces use palette[1..3]', () => {
    const s = run('isoCubes', { shuffle: false })
    expect(new Set(colorsOf(s))).toEqual(new Set([PALETTE8[1], PALETTE8[2], PALETTE8[3]]))
  })
})
```

`generators.test.ts`의 `CASES`에 추가:
```ts
  { id: 'isoCubes', rngParams: { shuffle: true } },
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/generators`
Expected: FAIL — `unknown generator isoCubes`

- [ ] **Step 3: 구현**

`src/generators/isoCubes.ts`
```ts
import type { GeneratorDef } from './types'
import type { Shape } from '../core/scene'
import { tileWrap } from '../core/scene'
import { num, bool } from '../core/params'
import { fg, poly } from './util'

const SQ3 = Math.sqrt(3)

/** 다각형을 무게중심 기준으로 k배 축소한다 (gap 표현) */
function shrink(points: number[], k: number): number[] {
  if (k >= 1) return points
  const n = points.length / 2
  let cx = 0
  let cy = 0
  for (let i = 0; i < n; i++) {
    cx += points[2 * i]
    cy += points[2 * i + 1]
  }
  cx /= n
  cy /= n
  return points.map((v, i) => (i % 2 === 0 ? cx + (v - cx) * k : cy + (v - cy) * k))
}

export const isoCubes: GeneratorDef = {
  id: 'isoCubes',
  name: 'Iso Cubes',
  family: 'tessellation',
  minColors: 4,
  params: [
    { type: 'range', key: 'size', label: 'Cube size', min: 10, max: 120, step: 1, default: 40 },
    { type: 'range', key: 'cols', label: 'Columns per tile', min: 1, max: 8, step: 1, default: 2 },
    { type: 'range', key: 'rows', label: 'Row pairs per tile', min: 1, max: 8, step: 1, default: 2 },
    { type: 'range', key: 'gap', label: 'Gap', min: 0, max: 8, step: 1, default: 0 },
    { type: 'toggle', key: 'shuffle', label: 'Shuffle face colors', default: false },
  ],
  generate({ params, palette, rng }) {
    const s = num(params, 'size')
    const cols = num(params, 'cols')
    const rows = num(params, 'rows')
    const gap = num(params, 'gap')
    const shuffle = bool(params, 'shuffle')

    const width = cols * SQ3 * s
    const height = rows * 3 * s
    const base = [fg(palette, 0), fg(palette, 1), fg(palette, 2)]
    const k = Math.max(0.2, 1 - gap / s)
    const hw = (SQ3 / 2) * s // 육각형 반폭

    const shapes: Shape[] = []
    for (let r = 0; r < rows * 2; r++) {
      const cy = r * 1.5 * s
      const xOff = r % 2 === 1 ? hw : 0
      for (let c = 0; c < cols; c++) {
        const cx = c * SQ3 * s + xOff
        const colors = shuffle ? rng.shuffle(base) : base
        // 육각형 정점: T(위) UR LR B(아래) LL UL, 중심 C
        const T = [cx, cy - s]
        const UR = [cx + hw, cy - s / 2]
        const LR = [cx + hw, cy + s / 2]
        const B = [cx, cy + s]
        const LL = [cx - hw, cy + s / 2]
        const UL = [cx - hw, cy - s / 2]
        const C = [cx, cy]
        shapes.push(poly(shrink([...T, ...UR, ...C, ...UL], k), colors[0]))   // 윗면
        shapes.push(poly(shrink([...UL, ...C, ...B, ...LL], k), colors[1]))   // 왼면
        shapes.push(poly(shrink([...C, ...UR, ...LR, ...B], k), colors[2]))   // 오른면
      }
    }
    return { width, height, background: palette[0], shapes: tileWrap(shapes, width, height) }
  },
}
```

`src/generators/index.ts`: `import { isoCubes } from './isoCubes'`, 배열 `[stripes, plaid, zigzag, motif, rings, gradientBars, isoCubes]`

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/generators`
Expected: PASS. 면적 테스트가 미세하게 어긋나면(1e-3 초과) `tileWrap`의 클리핑이 아닌 육각 배치(`cy = r × 1.5s`, 홀수 행 `xOff = hw`)를 먼저 의심한다.

- [ ] **Step 5: 브라우저 확인 후 커밋**

Iso Cubes 선택, Neon Op 팔레트 느낌으로 확인(3부 전이면 기본 팔레트), Gap 3, Shuffle 켜기, 3 × 3 경계에서 큐브가 이어지는지 확인 → `docs/screenshots/07-iso-cubes.png`

```bash
npm test && npm run lint && npm run build
git add src/generators docs/screenshots
git commit -m "feat(generators): isoCubes 등각 큐브 생성기"
```

---

### Task 17: `triangles` — 삼각·마름모 (tessellation)

**Files:**
- Create: `src/generators/triangles.ts`
- Modify: `src/generators/index.ts`, `src/generators/generators.test.ts`
- Test: `src/generators/triangles.test.ts`

**Interfaces:**
- Produces: `export const triangles: GeneratorDef` (id `'triangles'`, family `'tessellation'`, minColors 3)
- 매개변수: `size`(10..120, 40), `cols`(2..16, 4), `rows`(2..16 step 2, 2), `rule`(checker | stripes | random | rhombus), `orientation`(horizontal | vertical)

- [ ] **Step 1: 테스트 작성**

`src/generators/triangles.test.ts`
```ts
import { describe, it, expect } from 'vitest'
import { polygonArea } from '../core/scene'
import { run, PALETTE8, colorsOf } from './testUtils'

const polyArea = (s: ReturnType<typeof run>) =>
  s.shapes.reduce((a, sh) => a + (sh.kind === 'polygon' ? Math.abs(polygonArea(sh.points)) : 0), 0)

describe('triangles', () => {
  it('tile size = cols × size by rows × √3/2 × size, swapped when vertical', () => {
    const h = run('triangles', { size: 40, cols: 4, rows: 2, orientation: 'horizontal' })
    expect(h.width).toBeCloseTo(160)
    expect(h.height).toBeCloseTo(2 * (Math.sqrt(3) / 2) * 40)
    const v = run('triangles', { size: 40, cols: 4, rows: 2, orientation: 'vertical' })
    expect(v.width).toBeCloseTo(h.height)
    expect(v.height).toBeCloseTo(h.width)
  })

  it('covers the tile exactly in both orientations', () => {
    for (const orientation of ['horizontal', 'vertical']) {
      const s = run('triangles', { orientation })
      expect(polyArea(s)).toBeCloseTo(s.width * s.height, 3)
    }
  })

  it('checker uses exactly two foreground colors', () => {
    expect(new Set(colorsOf(run('triangles', { rule: 'checker' })))).toEqual(new Set([PALETTE8[1], PALETTE8[2]]))
  })

  it('stripes colors by row', () => {
    expect(new Set(colorsOf(run('triangles', { rule: 'stripes', rows: 2 })))).toEqual(new Set([PALETTE8[1], PALETTE8[2]]))
    expect(new Set(colorsOf(run('triangles', { rule: 'stripes', rows: 4 }))).size).toBe(4)
  })

  it('rhombus gives each up/down pair one color', () => {
    const s = run('triangles', { rule: 'rhombus', cols: 3, rows: 2, size: 40 })
    expect(new Set(colorsOf(s)).size).toBeGreaterThanOrEqual(3)
  })
})
```

`generators.test.ts`의 `CASES`에 추가:
```ts
  { id: 'triangles', rngParams: { rule: 'random' } },
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/generators`
Expected: FAIL — `unknown generator triangles`

- [ ] **Step 3: 구현**

`src/generators/triangles.ts`
```ts
import type { GeneratorDef } from './types'
import type { Paint, Shape } from '../core/scene'
import { tileWrap } from '../core/scene'
import type { Rng } from '../core/prng'
import { num, str } from '../core/params'
import { fg, pickFg, poly } from './util'

const SQ3 = Math.sqrt(3)

function colorFor(rule: string, palette: string[], rng: Rng, r: number, k: number, up: boolean): string {
  if (rule === 'checker') return fg(palette, up ? 0 : 1)
  if (rule === 'stripes') return fg(palette, r)
  if (rule === 'random') return fg(palette, pickFg(palette, rng))
  // rhombus: 같은 k의 ▲▼ 쌍이 같은 색, 행 쌍마다 한 칸씩 밀려 대각선 느낌
  return fg(palette, k + Math.floor(r / 2))
}

function transposePaint(p: Paint): Paint {
  if (p.type === 'solid') return p
  return { ...p, x1: p.y1, y1: p.x1, x2: p.y2, y2: p.x2 }
}

/** (x, y) → (y, x). 가로 타일을 세로 타일로 바꾼다 */
function transposeShape(s: Shape): Shape {
  if (s.kind === 'rect') return { ...s, x: s.y, y: s.x, w: s.h, h: s.w, fill: transposePaint(s.fill) }
  const pts = s.points.slice()
  for (let i = 0; i < pts.length; i += 2) {
    const t = pts[i]
    pts[i] = pts[i + 1]
    pts[i + 1] = t
  }
  return { ...s, points: pts, fill: transposePaint(s.fill) }
}

export const triangles: GeneratorDef = {
  id: 'triangles',
  name: 'Triangles',
  family: 'tessellation',
  minColors: 3,
  params: [
    { type: 'range', key: 'size', label: 'Triangle size', min: 10, max: 120, step: 1, default: 40 },
    { type: 'range', key: 'cols', label: 'Columns per tile', min: 2, max: 16, step: 1, default: 4 },
    { type: 'range', key: 'rows', label: 'Rows per tile', min: 2, max: 16, step: 2, default: 2 },
    {
      type: 'select', key: 'rule', label: 'Coloring', default: 'checker',
      options: [
        { value: 'checker', label: 'Checker' },
        { value: 'stripes', label: 'Stripes' },
        { value: 'random', label: 'Random' },
        { value: 'rhombus', label: 'Rhombus' },
      ],
    },
    {
      type: 'select', key: 'orientation', label: 'Orientation', default: 'horizontal',
      options: [
        { value: 'horizontal', label: 'Horizontal' },
        { value: 'vertical', label: 'Vertical' },
      ],
    },
  ],
  generate({ params, palette, rng }) {
    const s = num(params, 'size')
    const cols = num(params, 'cols')
    const rows = num(params, 'rows')
    const rule = str(params, 'rule')
    const orientation = str(params, 'orientation')

    const h = (SQ3 / 2) * s
    const shapes: Shape[] = []
    for (let r = 0; r < rows; r++) {
      const y0 = r * h
      const y1 = y0 + h
      const off = r % 2 === 1 ? s / 2 : 0
      for (let k = 0; k < cols; k++) {
        const x = k * s + off
        shapes.push(poly([x, y1, x + s, y1, x + s / 2, y0], colorFor(rule, palette, rng, r, k, true)))              // ▲
        shapes.push(poly([x + s / 2, y0, x + 1.5 * s, y0, x + s, y1], colorFor(rule, palette, rng, r, k, false)))  // ▼
      }
    }
    const width = cols * s
    const height = rows * h
    const wrapped = tileWrap(shapes, width, height)
    if (orientation === 'vertical') {
      return { width: height, height: width, background: palette[0], shapes: wrapped.map(transposeShape) }
    }
    return { width, height, background: palette[0], shapes: wrapped }
  },
}
```

`src/generators/index.ts`: `import { triangles } from './triangles'`, 배열 `[stripes, plaid, zigzag, motif, rings, gradientBars, isoCubes, triangles]`

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/generators`
Expected: PASS. 공통 테스트 `registry › every registered generator has a test case`가 8종 모두 통과해야 한다.

- [ ] **Step 5: 전체 검증, 브라우저 확인, 커밋·푸시**

Run: `npm test && npm run lint && npm run build`
Expected: 모두 통과

브라우저: 드롭다운에 8종이 stripes, plaid, zigzag, motif, rings, gradientBars, isoCubes, triangles 순으로 보인다. Triangles의 네 가지 Coloring과 Vertical을 확인 → `docs/screenshots/08-triangles.png`

```bash
git add src/generators docs/screenshots
git commit -m "feat(generators): triangles 삼각·마름모 생성기 — 8종 완성"
git push origin main
```

---

## 자체 검토 결과 (계획 작성자)

- 설계서 5.2~5.8 매개변수 표와 각 Task의 `params` 배열을 대조했다. 차이: `zigzag.amplitude`의 min을 0으로 낮춰(설계서는 1) 진폭 0 테스트와 수평 줄무늬 사용을 허용했고, `plaid.blend`의 세 번째 옵션은 설계서와 함께 `alternate`로 통일했다.
- 모든 생성기가 `GenContext.rng` 외의 난수원을 쓰지 않는다. `motif`는 density가 rng 호출 횟수에 영향을 주지 않으므로 시드가 같으면 같은 결과가 나온다.
- 타일 경계 처리: `plaid`·`zigzag`·`rings`는 구조적으로 타일 안에 놓이고, `stripes`·`motif`·`gradientBars`·`isoCubes`·`triangles`는 `tileWrap`을 호출한다. 각 파일에 그 이유를 주석으로 남겼다.
- 면적 보존 테스트(plaid·zigzag·gradientBars·isoCubes·triangles)가 `tileWrap`의 클리핑 정확성을 생성기 수준에서 한 번 더 검증한다.
