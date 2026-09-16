# Jacquard 구현 계획 1부 — 기반(스캐폴드·코어·렌더러·앱 골격)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Vite + React + TypeScript 프로젝트를 만들고, 시드 PRNG·색 변환·Scene IR·매개변수·상태·팔레트 코어 모듈과 Canvas 렌더러, 첫 생성기 `stripes`, 그리고 화면에 패턴이 보이는 앱 골격까지 완성한다.

**Architecture:** 생성기는 `(params, palette, rng) → Scene(반복 타일 1장)`을 반환하는 순수 함수다. Scene은 `rect`/`polygon` 도형과 `solid`/`linear` 페인트만 담는 IR이며, Canvas 2D 렌더러가 타일을 그리고 `createPattern`으로 반복해 채운다. UI는 React가 `PatternState` 하나를 들고 있고, 상태가 바뀌면 Scene을 다시 만들어 캔버스를 다시 그린다.

**Tech Stack:** Vite 8, React 19, TypeScript 6.x, Vitest 5, oxlint. 런타임 의존성은 react, react-dom만.

**Spec:** `docs/superpowers/specs/2026-09-16-jacquard-design.md` (이 계획은 설계서 3·4·5.1·7절을 구현한다. 실행자는 설계서를 먼저 읽는다.)

**이어지는 계획:** 2부 `2026-09-16-jacquard-plan-2-generators.md`(생성기 7종), 3부 `2026-09-16-jacquard-plan-3-palette-export-deploy.md`(팔레트 UI·내보내기·배포·README). 1부가 끝나야 2부를 시작할 수 있다.

## Global Constraints

- 작업 폴더는 `C:\Users\JohnHB\jacquard` (이미 git 저장소, main 브랜치, origin = github.com/dostevskii/jacquard 비공개). 모든 명령은 이 폴더에서 실행한다.
- 런타임 의존성은 `react`, `react-dom` 두 개만. 다른 런타임 패키지를 추가하지 않는다. node-canvas 등 네이티브 의존성 금지.
- TypeScript는 `~6.0.x`. `tsconfig.app.json`에 `verbatimModuleSyntax`, `erasableSyntaxOnly`가 켜져 있으므로 타입은 반드시 `import type`으로 가져오고, `enum`·`namespace`·생성자 매개변수 프로퍼티를 쓰지 않는다.
- 모든 코어·생성기 코드는 DOM을 참조하지 않는다(`document`, `window` 금지). DOM은 `src/render/*`와 `src/ui/*`에서만 쓴다.
- `palette[0]`은 항상 배경색. 전경색은 `palette[1..]`.
- 도형 좌표는 타일 안(허용 오차 `EPS = 1e-6`)에 있어야 한다.
- UI 문구는 영어. 코드 주석은 한국어 또는 영어 어느 쪽이든 되지만 실제 폴더명·개인 식별자를 예시에 쓰지 않는다.
- 각 Task 종료 시 `npm test`, `npm run lint`, `npm run build` 세 가지가 모두 통과한 뒤 커밋한다. 커밋 메시지는 한국어 요약 한 줄 + 빈 줄 + 실행 세션의 attribution 줄(시스템이 지시한 Co-Authored-By 등)로 끝낸다.
- Windows(Git Bash) 환경이다. 한글이 든 여러 줄 파일은 heredoc 대신 파일 쓰기 도구로 만든다.

---

## 파일 구조 (이 계획에서 만드는 파일)

| 파일 | 책임 |
|---|---|
| `package.json`, `vite.config.ts`, `tsconfig*.json`, `.oxlintrc.json`, `index.html`, `public/favicon.svg` | 빌드·테스트·린트 설정 |
| `src/main.tsx` | React 마운트 |
| `src/core/prng.ts` | mulberry32 시드 PRNG, `Rng` 인터페이스, `randomSeed` |
| `src/core/color.ts` | hex/rgb/hsl/hsv 변환, `parseHex`, `toHex`, `mix` |
| `src/core/scene.ts` | Scene/Shape/Paint 타입, `shapeBounds`, `clipPolygonToRect`, `clipShapeToRect`, `translateShape`, `reflectShape`, `tileWrap` |
| `src/core/params.ts` | `ParamDef`/`ParamValue`, `defaultParams`, `clampParams`, `num`/`str`/`bool` 읽기 헬퍼 |
| `src/core/palettes.ts` | 프리셋 팔레트 8종, `DEFAULT_PALETTE`, `ensurePaletteLength`, `randomPalette` |
| `src/core/state.ts` | `PatternState`, `encodeState`, `decodeState`, `normalizePalette` |
| `src/generators/types.ts` | `GenContext`, `GeneratorDef` |
| `src/generators/util.ts` | `fg`, `rect`, `poly` 도형 생성 헬퍼 |
| `src/generators/stripes.ts` | 첫 생성기 |
| `src/generators/index.ts` | 레지스트리 `GENERATORS`, `getGenerator`, `generateScene`, `DEFAULT_GENERATOR_ID` |
| `src/generators/testUtils.ts` | 테스트 전용 헬퍼 `PALETTE8`, `run`, `colorsOf` (vitest를 import하지 않음) |
| `src/generators/generators.test.ts` | 모든 생성기에 공통 적용되는 테이블 기반 테스트 (2부에서 행만 추가) |
| `src/render/canvas.ts` | `tilePixelSize`, `renderTile`, `renderFill` |
| `src/render/export.ts` | 출력 크기 계산·상한·파일명 (다운로드 함수는 3부) |
| `src/ui/TopBar.tsx`, `ControlPanel.tsx`, `ParamControl.tsx`, `Preview.tsx` | 앱 골격 UI |
| `src/App.tsx`, `src/styles.css` | 상태 소유, 레이아웃, 테마 |

---

### Task 1: 프로젝트 스캐폴드

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`, `.oxlintrc.json`, `index.html`, `public/favicon.svg`, `src/main.tsx`, `src/App.tsx`, `src/styles.css`

**Interfaces:**
- Produces: `npm run dev|build|lint|test` 스크립트. 이후 모든 Task가 이 스크립트로 검증한다.

- [ ] **Step 1: package.json 작성**

```json
{
  "name": "jacquard",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "lint": "oxlint",
    "test": "vitest run",
    "test:watch": "vitest",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^19.2.0",
    "react-dom": "^19.2.0"
  },
  "devDependencies": {
    "@types/node": "^24.0.0",
    "@types/react": "^19.2.0",
    "@types/react-dom": "^19.2.0",
    "@vitejs/plugin-react": "^6.1.0",
    "oxlint": "^1.79.0",
    "typescript": "~6.0.2",
    "vite": "^8.2.0",
    "vitest": "^5.0.0"
  }
}
```

- [ ] **Step 2: TypeScript·Vite·oxlint 설정 작성**

`tsconfig.json`
```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ]
}
```

`tsconfig.app.json`
```json
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.app.tsbuildinfo",
    "target": "es2023",
    "lib": ["ES2023", "DOM"],
    "module": "esnext",
    "types": ["vite/client"],
    "allowArbitraryExtensions": true,
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "erasableSyntaxOnly": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"]
}
```

`tsconfig.node.json`
```json
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.node.tsbuildinfo",
    "target": "es2023",
    "lib": ["ES2023"],
    "types": ["node"],
    "skipLibCheck": true,
    "module": "nodenext",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "moduleDetection": "force",
    "noEmit": true,
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "erasableSyntaxOnly": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["vite.config.ts"]
}
```

`vite.config.ts`
```ts
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    passWithNoTests: true,
  },
})
```

`.oxlintrc.json`
```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

- [ ] **Step 3: index.html, favicon, main.tsx, 임시 App, styles.css 작성**

`index.html`
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="Jacquard — parametric pattern generator for textile, tile and graphic design." />
    <title>Jacquard</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`public/favicon.svg`
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" fill="#141414"/>
  <rect x="4" y="4" width="8" height="8" fill="#e63b2e"/>
  <rect x="20" y="4" width="8" height="8" fill="#f2a91e"/>
  <rect x="12" y="12" width="8" height="8" fill="#6aa9dc"/>
  <rect x="4" y="20" width="8" height="8" fill="#f2a91e"/>
  <rect x="20" y="20" width="8" height="8" fill="#e63b2e"/>
</svg>
```

`src/main.tsx`
```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

`src/App.tsx` (Task 10에서 교체되는 임시 파일)
```tsx
export default function App() {
  return <div className="app">Jacquard</div>
}
```

`src/styles.css` (Task 10에서 확장)
```css
:root {
  color-scheme: dark;
  --bg: #141414;
  --panel: #1d1d1d;
  --border: #2c2c2c;
  --text: #ececec;
  --muted: #9a9a9a;
  --accent: #6aa9dc;
  font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  font-size: 13px;
}
* { box-sizing: border-box; }
html, body, #root { height: 100%; margin: 0; }
body { background: var(--bg); color: var(--text); }
```

- [ ] **Step 4: 설치·빌드·테스트·린트 실행**

Run: `npm install`
Expected: 오류 없이 종료. `vitest`와 `vite` peer 충돌(ERESOLVE)이 나면 `npm view vitest peerDependencies`로 vite 8을 지원하는 vitest major를 확인해 `package.json`의 `vitest` 버전을 그 값으로 바꾸고 다시 설치한다.

Run: `npm run build && npm test && npm run lint`
Expected: `dist/` 생성, vitest는 "No test files found" 상태로 통과(passWithNoTests), oxlint 경고 0개.

- [ ] **Step 5: 커밋**

```bash
git add -A
git commit -m "chore: Vite + React + TypeScript 스캐폴드, vitest·oxlint 설정"
```

---

### Task 2: 시드 PRNG (`core/prng.ts`)

**Files:**
- Create: `src/core/prng.ts`
- Test: `src/core/prng.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface Rng {
    next(): number                                   // [0, 1)
    int(min: number, max: number): number            // 정수, 양끝 포함
    pick<T>(items: readonly T[]): T
    shuffle<T>(items: readonly T[]): T[]             // 새 배열
  }
  export function mulberry32(seed: number): Rng
  export function randomSeed(): number               // 0 .. 2^32-1
  export const MAX_SEED = 0xffffffff
  ```

- [ ] **Step 1: 실패하는 테스트 작성**

`src/core/prng.test.ts`
```ts
import { describe, it, expect } from 'vitest'
import { mulberry32, randomSeed, MAX_SEED } from './prng'

describe('mulberry32', () => {
  it('produces the same sequence for the same seed', () => {
    const a = mulberry32(12345)
    const b = mulberry32(12345)
    const seqA = Array.from({ length: 20 }, () => a.next())
    const seqB = Array.from({ length: 20 }, () => b.next())
    expect(seqA).toEqual(seqB)
  })

  it('produces different sequences for different seeds', () => {
    const a = mulberry32(1)
    const b = mulberry32(2)
    const seqA = Array.from({ length: 5 }, () => a.next())
    const seqB = Array.from({ length: 5 }, () => b.next())
    expect(seqA).not.toEqual(seqB)
  })

  it('stays within [0, 1) and averages near 0.5', () => {
    const rng = mulberry32(7)
    let sum = 0
    for (let i = 0; i < 10000; i++) {
      const v = rng.next()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
      sum += v
    }
    const mean = sum / 10000
    expect(mean).toBeGreaterThan(0.45)
    expect(mean).toBeLessThan(0.55)
  })

  it('int() is inclusive on both ends and hits every value', () => {
    const rng = mulberry32(99)
    const seen = new Set<number>()
    for (let i = 0; i < 1000; i++) {
      const v = rng.int(3, 6)
      expect(Number.isInteger(v)).toBe(true)
      expect(v).toBeGreaterThanOrEqual(3)
      expect(v).toBeLessThanOrEqual(6)
      seen.add(v)
    }
    expect([...seen].sort()).toEqual([3, 4, 5, 6])
  })

  it('pick() returns an element and shuffle() keeps the multiset', () => {
    const rng = mulberry32(5)
    const items = ['a', 'b', 'c', 'd']
    expect(items).toContain(rng.pick(items))
    const shuffled = rng.shuffle(items)
    expect(shuffled).not.toBe(items)
    expect([...shuffled].sort()).toEqual([...items].sort())
  })
})

describe('randomSeed', () => {
  it('returns an integer in range', () => {
    for (let i = 0; i < 100; i++) {
      const s = randomSeed()
      expect(Number.isInteger(s)).toBe(true)
      expect(s).toBeGreaterThanOrEqual(0)
      expect(s).toBeLessThanOrEqual(MAX_SEED)
    }
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/core/prng.test.ts`
Expected: FAIL — `Cannot find module './prng'`

- [ ] **Step 3: 구현**

`src/core/prng.ts`
```ts
export interface Rng {
  next(): number
  int(min: number, max: number): number
  pick<T>(items: readonly T[]): T
  shuffle<T>(items: readonly T[]): T[]
}

export const MAX_SEED = 0xffffffff

/** mulberry32 — 32비트 상태의 빠른 결정적 PRNG */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0
  const next = (): number => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return {
    next,
    int(min, max) {
      return min + Math.floor(next() * (max - min + 1))
    },
    pick(items) {
      return items[Math.floor(next() * items.length)]
    },
    shuffle(items) {
      const out = items.slice()
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1))
        const tmp = out[i]
        out[i] = out[j]
        out[j] = tmp
      }
      return out
    },
  }
}

export function randomSeed(): number {
  return Math.floor(Math.random() * (MAX_SEED + 1))
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/core/prng.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/core/prng.ts src/core/prng.test.ts
git commit -m "feat(core): mulberry32 시드 PRNG"
```

---

### Task 3: 색 변환 (`core/color.ts`)

**Files:**
- Create: `src/core/color.ts`
- Test: `src/core/color.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type Rgb = { r: number; g: number; b: number }   // 0..255 (실수 허용, toHex에서 반올림)
  export type Hsl = { h: number; s: number; l: number }   // h 0..360, s/l 0..100
  export type Hsv = { h: number; s: number; v: number }   // HSB와 동일
  export function parseHex(input: string): Rgb | null
  export function toHex(rgb: Rgb): string                  // '#rrggbb' 소문자
  export function rgbToHsl(rgb: Rgb): Hsl
  export function hslToRgb(hsl: Hsl): Rgb
  export function rgbToHsv(rgb: Rgb): Hsv
  export function hsvToRgb(hsv: Hsv): Rgb
  export function mix(a: string, b: string, t?: number): string
  export function clamp(v: number, min: number, max: number): number
  ```
- 변환 함수는 반올림하지 않는다(실수 그대로). 반올림은 `toHex`와 UI 표시에서만 한다.

- [ ] **Step 1: 실패하는 테스트 작성**

`src/core/color.test.ts`
```ts
import { describe, it, expect } from 'vitest'
import { parseHex, toHex, rgbToHsl, hslToRgb, rgbToHsv, hsvToRgb, mix, clamp } from './color'

const SAMPLES = [
  '#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff', '#808080',
  '#e63b2e', '#f2a91e', '#6aa9dc', '#1e6fe6', '#7a1a1a', '#ffb3c1',
]

describe('parseHex / toHex', () => {
  it('accepts #rrggbb, rrggbb, #rgb, rgb', () => {
    expect(parseHex('#1e6fe6')).toEqual({ r: 30, g: 111, b: 230 })
    expect(parseHex('1e6fe6')).toEqual({ r: 30, g: 111, b: 230 })
    expect(parseHex('#abc')).toEqual({ r: 170, g: 187, b: 204 })
    expect(parseHex('ABC')).toEqual({ r: 170, g: 187, b: 204 })
    expect(parseHex('  #1E6FE6 ')).toEqual({ r: 30, g: 111, b: 230 })
  })
  it('rejects invalid input', () => {
    expect(parseHex('')).toBeNull()
    expect(parseHex('#12')).toBeNull()
    expect(parseHex('#12345')).toBeNull()
    expect(parseHex('#gggggg')).toBeNull()
    expect(parseHex('red')).toBeNull()
  })
  it('toHex rounds and pads', () => {
    expect(toHex({ r: 30, g: 111, b: 230 })).toBe('#1e6fe6')
    expect(toHex({ r: 0.4, g: 255, b: 7.6 })).toBe('#00ff08')
    expect(toHex({ r: -5, g: 300, b: 0 })).toBe('#00ff00')
  })
})

describe('round trips', () => {
  it('hex -> rgb -> hsl -> rgb -> hex', () => {
    for (const hex of SAMPLES) {
      const rgb = parseHex(hex)!
      expect(toHex(hslToRgb(rgbToHsl(rgb)))).toBe(hex)
    }
  })
  it('hex -> rgb -> hsv -> rgb -> hex', () => {
    for (const hex of SAMPLES) {
      const rgb = parseHex(hex)!
      expect(toHex(hsvToRgb(rgbToHsv(rgb)))).toBe(hex)
    }
  })
  it('known values', () => {
    expect(rgbToHsl({ r: 255, g: 0, b: 0 })).toEqual({ h: 0, s: 100, l: 50 })
    expect(rgbToHsv({ r: 0, g: 0, b: 255 })).toEqual({ h: 240, s: 100, v: 100 })
    const grey = rgbToHsl({ r: 128, g: 128, b: 128 })
    expect(grey.s).toBe(0)
    expect(grey.h).toBe(0)
  })
  it('hue wraps outside 0..360', () => {
    expect(toHex(hsvToRgb({ h: 360, s: 100, v: 100 }))).toBe('#ff0000')
    expect(toHex(hsvToRgb({ h: -120, s: 100, v: 100 }))).toBe('#0000ff')
    expect(toHex(hslToRgb({ h: 480, s: 100, l: 50 }))).toBe('#00ff00')
  })
})

describe('mix / clamp', () => {
  it('mixes at midpoint by default', () => {
    expect(mix('#000000', '#ffffff')).toBe('#808080')
    expect(mix('#ff0000', '#0000ff', 0)).toBe('#ff0000')
    expect(mix('#ff0000', '#0000ff', 1)).toBe('#0000ff')
  })
  it('clamp', () => {
    expect(clamp(5, 0, 3)).toBe(3)
    expect(clamp(-1, 0, 3)).toBe(0)
    expect(clamp(2, 0, 3)).toBe(2)
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/core/color.test.ts`
Expected: FAIL — `Cannot find module './color'`

- [ ] **Step 3: 구현**

`src/core/color.ts`
```ts
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
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/core/color.test.ts`
Expected: PASS. `known values`에서 부동소수점 때문에 `toEqual`이 실패하면(예: `s: 99.99999`) 해당 기대값을 `toBeCloseTo(100, 6)` 형태로 바꾼다. 왕복(round trip) 테스트는 바꾸지 않는다.

- [ ] **Step 5: 커밋**

```bash
git add src/core/color.ts src/core/color.test.ts
git commit -m "feat(core): hex/rgb/hsl/hsv 색 변환과 mix"
```

---

### Task 4: Scene IR와 타일 래핑 (`core/scene.ts`)

**Files:**
- Create: `src/core/scene.ts`
- Test: `src/core/scene.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export const EPS = 1e-6
  export type Paint =
    | { type: 'solid'; color: string }
    | { type: 'linear'; x1: number; y1: number; x2: number; y2: number; stops: { offset: number; color: string }[] }
  export type Shape =
    | { kind: 'rect'; x: number; y: number; w: number; h: number; fill: Paint }
    | { kind: 'polygon'; points: number[]; fill: Paint }
  export interface Scene { width: number; height: number; background: string; shapes: Shape[] }
  export interface Bounds { x0: number; y0: number; x1: number; y1: number }
  export function shapeBounds(s: Shape): Bounds
  export function polygonArea(points: number[]): number                       // 부호 있는 면적
  export function clipPolygonToRect(points: number[], x0: number, y0: number, x1: number, y1: number): number[] | null
  export function clipShapeToRect(s: Shape, x0: number, y0: number, x1: number, y1: number): Shape | null
  export function translateShape(s: Shape, dx: number, dy: number): Shape    // 페인트 좌표도 함께 이동
  export function reflectShape(s: Shape, axis: 'x' | 'y', size: number): Shape // x → size - x (axis x), y → size - y (axis y)
  export function tileWrap(shapes: Shape[], width: number, height: number): Shape[]
  ```

- [ ] **Step 1: 실패하는 테스트 작성**

`src/core/scene.test.ts`
```ts
import { describe, it, expect } from 'vitest'
import type { Shape } from './scene'
import {
  EPS, shapeBounds, polygonArea, clipPolygonToRect, clipShapeToRect,
  translateShape, reflectShape, tileWrap,
} from './scene'

const solid = (color = '#ff0000') => ({ type: 'solid' as const, color })
const rect = (x: number, y: number, w: number, h: number): Shape => ({ kind: 'rect', x, y, w, h, fill: solid() })
const rectArea = (s: Shape) => (s.kind === 'rect' ? s.w * s.h : Math.abs(polygonArea(s.points)))

describe('shapeBounds / polygonArea', () => {
  it('rect bounds', () => {
    expect(shapeBounds(rect(1, 2, 3, 4))).toEqual({ x0: 1, y0: 2, x1: 4, y1: 6 })
  })
  it('polygon bounds and area', () => {
    const tri: Shape = { kind: 'polygon', points: [0, 0, 4, 0, 0, 3], fill: solid() }
    expect(shapeBounds(tri)).toEqual({ x0: 0, y0: 0, x1: 4, y1: 3 })
    expect(Math.abs(polygonArea(tri.points))).toBeCloseTo(6)
  })
})

describe('clipPolygonToRect', () => {
  it('keeps a polygon fully inside', () => {
    const out = clipPolygonToRect([1, 1, 3, 1, 2, 3], 0, 0, 10, 10)!
    expect(Math.abs(polygonArea(out))).toBeCloseTo(2)
  })
  it('clips a triangle crossing the right edge', () => {
    const out = clipPolygonToRect([8, 0, 12, 0, 8, 4], 0, 0, 10, 10)!
    for (let i = 0; i < out.length; i += 2) {
      expect(out[i]).toBeGreaterThanOrEqual(-EPS)
      expect(out[i]).toBeLessThanOrEqual(10 + EPS)
    }
    // 원래 면적 8 중 x>10 부분(삼각형 면적 2)이 잘려 6이 남는다
    expect(Math.abs(polygonArea(out))).toBeCloseTo(6)
  })
  it('returns null when fully outside', () => {
    expect(clipPolygonToRect([20, 20, 30, 20, 20, 30], 0, 0, 10, 10)).toBeNull()
  })
})

describe('clipShapeToRect', () => {
  it('intersects rects', () => {
    expect(clipShapeToRect(rect(90, 5, 20, 10), 0, 0, 100, 100)).toEqual(rect(90, 5, 10, 10))
    expect(clipShapeToRect(rect(120, 5, 20, 10), 0, 0, 100, 100)).toBeNull()
  })
})

describe('translateShape / reflectShape', () => {
  it('translates rect and its gradient', () => {
    const s: Shape = {
      kind: 'rect', x: 0, y: 0, w: 10, h: 10,
      fill: { type: 'linear', x1: 0, y1: 0, x2: 0, y2: 10, stops: [{ offset: 0, color: '#000000' }, { offset: 1, color: '#ffffff' }] },
    }
    const t = translateShape(s, 5, -3)
    expect(t.kind === 'rect' && t.x).toBe(5)
    expect(t.kind === 'rect' && t.y).toBe(-3)
    expect(t.fill.type === 'linear' && t.fill.y1).toBe(-3)
    expect(t.fill.type === 'linear' && t.fill.y2).toBe(7)
  })
  it('reflects rect across x within width', () => {
    const r = reflectShape(rect(10, 0, 20, 5), 'x', 100)
    expect(r).toEqual(rect(70, 0, 20, 5))
  })
  it('reflects polygon and gradient across y', () => {
    const s: Shape = {
      kind: 'polygon', points: [0, 0, 10, 0, 0, 10],
      fill: { type: 'linear', x1: 0, y1: 0, x2: 0, y2: 10, stops: [] },
    }
    const r = reflectShape(s, 'y', 100)
    expect(r.kind === 'polygon' && r.points).toEqual([0, 100, 10, 100, 0, 90])
    expect(r.fill.type === 'linear' && r.fill.y1).toBe(100)
    expect(r.fill.type === 'linear' && r.fill.y2).toBe(90)
  })
})

describe('tileWrap', () => {
  it('leaves an inside shape untouched', () => {
    const s = rect(10, 10, 20, 20)
    expect(tileWrap([s], 100, 100)).toEqual([s])
  })
  it('splits a shape crossing the right edge into two pieces with the same total area', () => {
    const out = tileWrap([rect(90, 10, 20, 10)], 100, 100)
    expect(out).toHaveLength(2)
    const total = out.reduce((a, s) => a + rectArea(s), 0)
    expect(total).toBeCloseTo(200)
    for (const s of out) {
      const b = shapeBounds(s)
      expect(b.x0).toBeGreaterThanOrEqual(-EPS)
      expect(b.x1).toBeLessThanOrEqual(100 + EPS)
    }
    expect(out.some(s => s.kind === 'rect' && s.x === 0 && s.w === 10)).toBe(true)
  })
  it('splits a corner shape into four pieces', () => {
    const out = tileWrap([rect(95, 95, 10, 10)], 100, 100)
    expect(out).toHaveLength(4)
    expect(out.reduce((a, s) => a + rectArea(s), 0)).toBeCloseTo(100)
  })
  it('moves gradient coordinates with the wrapped piece', () => {
    const s: Shape = {
      kind: 'rect', x: 90, y: 0, w: 20, h: 10,
      fill: { type: 'linear', x1: 90, y1: 0, x2: 110, y2: 0, stops: [] },
    }
    const out = tileWrap([s], 100, 100)
    const wrapped = out.find(p => p.kind === 'rect' && p.x === 0)!
    expect(wrapped.fill.type === 'linear' && wrapped.fill.x1).toBe(-10)
    expect(wrapped.fill.type === 'linear' && wrapped.fill.x2).toBe(10)
  })
  it('wraps polygons too', () => {
    const tri: Shape = { kind: 'polygon', points: [95, 0, 105, 0, 100, 10], fill: solid() }
    const out = tileWrap([tri], 100, 100)
    expect(out).toHaveLength(2)
    expect(out.reduce((a, s) => a + rectArea(s), 0)).toBeCloseTo(50)
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/core/scene.test.ts`
Expected: FAIL — `Cannot find module './scene'`

- [ ] **Step 3: 구현**

`src/core/scene.ts`
```ts
export const EPS = 1e-6

export type Paint =
  | { type: 'solid'; color: string }
  | {
      type: 'linear'
      x1: number
      y1: number
      x2: number
      y2: number
      stops: { offset: number; color: string }[]
    }

export type Shape =
  | { kind: 'rect'; x: number; y: number; w: number; h: number; fill: Paint }
  | { kind: 'polygon'; points: number[]; fill: Paint }

export interface Scene {
  width: number
  height: number
  background: string
  shapes: Shape[]
}

export interface Bounds { x0: number; y0: number; x1: number; y1: number }

export function shapeBounds(s: Shape): Bounds {
  if (s.kind === 'rect') return { x0: s.x, y0: s.y, x1: s.x + s.w, y1: s.y + s.h }
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (let i = 0; i < s.points.length; i += 2) {
    const x = s.points[i], y = s.points[i + 1]
    if (x < x0) x0 = x
    if (x > x1) x1 = x
    if (y < y0) y0 = y
    if (y > y1) y1 = y
  }
  return { x0, y0, x1, y1 }
}

export function polygonArea(points: number[]): number {
  let a = 0
  const n = points.length / 2
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    a += points[2 * i] * points[2 * j + 1] - points[2 * j] * points[2 * i + 1]
  }
  return a / 2
}

type Inside = (x: number, y: number) => boolean
type Intersect = (ax: number, ay: number, bx: number, by: number) => [number, number]

function clipEdge(pts: number[], inside: Inside, intersect: Intersect): number[] {
  const out: number[] = []
  const n = pts.length / 2
  for (let i = 0; i < n; i++) {
    const ax = pts[2 * i], ay = pts[2 * i + 1]
    const j = (i + 1) % n
    const bx = pts[2 * j], by = pts[2 * j + 1]
    const ain = inside(ax, ay), bin = inside(bx, by)
    if (ain) {
      out.push(ax, ay)
      if (!bin) out.push(...intersect(ax, ay, bx, by))
    } else if (bin) {
      out.push(...intersect(ax, ay, bx, by))
    }
  }
  return out
}

/** Sutherland–Hodgman: 다각형을 축 정렬 사각형으로 자른다. 결과가 비거나 면적이 0이면 null */
export function clipPolygonToRect(points: number[], x0: number, y0: number, x1: number, y1: number): number[] | null {
  let pts = points
  pts = clipEdge(pts, (x) => x >= x0 - EPS, (ax, ay, bx, by) => [x0, ay + ((by - ay) * (x0 - ax)) / (bx - ax)])
  if (pts.length < 6) return null
  pts = clipEdge(pts, (x) => x <= x1 + EPS, (ax, ay, bx, by) => [x1, ay + ((by - ay) * (x1 - ax)) / (bx - ax)])
  if (pts.length < 6) return null
  pts = clipEdge(pts, (_x, y) => y >= y0 - EPS, (ax, ay, bx, by) => [ax + ((bx - ax) * (y0 - ay)) / (by - ay), y0])
  if (pts.length < 6) return null
  pts = clipEdge(pts, (_x, y) => y <= y1 + EPS, (ax, ay, bx, by) => [ax + ((bx - ax) * (y1 - ay)) / (by - ay), y1])
  if (pts.length < 6) return null
  if (Math.abs(polygonArea(pts)) < EPS) return null
  return pts
}

export function clipShapeToRect(s: Shape, x0: number, y0: number, x1: number, y1: number): Shape | null {
  if (s.kind === 'rect') {
    const nx0 = Math.max(x0, s.x), ny0 = Math.max(y0, s.y)
    const nx1 = Math.min(x1, s.x + s.w), ny1 = Math.min(y1, s.y + s.h)
    if (nx1 - nx0 <= EPS || ny1 - ny0 <= EPS) return null
    return { ...s, x: nx0, y: ny0, w: nx1 - nx0, h: ny1 - ny0 }
  }
  const pts = clipPolygonToRect(s.points, x0, y0, x1, y1)
  return pts ? { ...s, points: pts } : null
}

function translatePaint(p: Paint, dx: number, dy: number): Paint {
  if (p.type === 'solid') return p
  return { ...p, x1: p.x1 + dx, y1: p.y1 + dy, x2: p.x2 + dx, y2: p.y2 + dy }
}

export function translateShape(s: Shape, dx: number, dy: number): Shape {
  if (s.kind === 'rect') return { ...s, x: s.x + dx, y: s.y + dy, fill: translatePaint(s.fill, dx, dy) }
  const points = s.points.map((v, i) => (i % 2 === 0 ? v + dx : v + dy))
  return { ...s, points, fill: translatePaint(s.fill, dx, dy) }
}

function reflectPaint(p: Paint, axis: 'x' | 'y', size: number): Paint {
  if (p.type === 'solid') return p
  return axis === 'x'
    ? { ...p, x1: size - p.x1, x2: size - p.x2 }
    : { ...p, y1: size - p.y1, y2: size - p.y2 }
}

export function reflectShape(s: Shape, axis: 'x' | 'y', size: number): Shape {
  const fill = reflectPaint(s.fill, axis, size)
  if (s.kind === 'rect') {
    return axis === 'x'
      ? { ...s, x: size - (s.x + s.w), fill }
      : { ...s, y: size - (s.y + s.h), fill }
  }
  const points = s.points.map((v, i) => {
    const isX = i % 2 === 0
    if (axis === 'x') return isX ? size - v : v
    return isX ? v : size - v
  })
  return { ...s, points, fill }
}

/** 타일 경계를 넘는 도형을 반대편으로 감아 타일 안에서만 존재하도록 만든다 */
export function tileWrap(shapes: Shape[], width: number, height: number): Shape[] {
  const out: Shape[] = []
  for (const s of shapes) {
    const b = shapeBounds(s)
    if (b.x0 >= -EPS && b.y0 >= -EPS && b.x1 <= width + EPS && b.y1 <= height + EPS) {
      out.push(s)
      continue
    }
    for (const dx of [-width, 0, width]) {
      for (const dy of [-height, 0, height]) {
        const moved = dx === 0 && dy === 0 ? s : translateShape(s, dx, dy)
        const clipped = clipShapeToRect(moved, 0, 0, width, height)
        if (clipped) out.push(clipped)
      }
    }
  }
  return out
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/core/scene.test.ts`
Expected: PASS (13 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/core/scene.ts src/core/scene.test.ts
git commit -m "feat(core): Scene IR, 다각형 클리핑, tileWrap"
```

---

### Task 5: 매개변수 정의 (`core/params.ts`)

**Files:**
- Create: `src/core/params.ts`
- Test: `src/core/params.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type ParamValue = number | string | boolean
  export type ParamDef =
    | { type: 'range'; key: string; label: string; min: number; max: number; step: number; default: number }
    | { type: 'select'; key: string; label: string; options: { value: string; label: string }[]; default: string }
    | { type: 'toggle'; key: string; label: string; default: boolean }
  export type Params = Record<string, ParamValue>
  export function defaultParams(defs: ParamDef[]): Params
  export function clampParams(defs: ParamDef[], input: Record<string, unknown>): Params
  export function num(p: Params, key: string): number
  export function str(p: Params, key: string): string
  export function bool(p: Params, key: string): boolean
  ```

- [ ] **Step 1: 실패하는 테스트 작성**

`src/core/params.test.ts`
```ts
import { describe, it, expect } from 'vitest'
import type { ParamDef } from './params'
import { defaultParams, clampParams, num, str, bool } from './params'

const DEFS: ParamDef[] = [
  { type: 'range', key: 'cell', label: 'Cell', min: 4, max: 64, step: 2, default: 16 },
  { type: 'range', key: 'offset', label: 'Offset', min: 0, max: 1, step: 0.25, default: 0.5 },
  { type: 'select', key: 'mode', label: 'Mode', options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }], default: 'a' },
  { type: 'toggle', key: 'flag', label: 'Flag', default: true },
]

describe('defaultParams', () => {
  it('collects defaults', () => {
    expect(defaultParams(DEFS)).toEqual({ cell: 16, offset: 0.5, mode: 'a', flag: true })
  })
})

describe('clampParams', () => {
  it('fills missing keys with defaults', () => {
    expect(clampParams(DEFS, {})).toEqual(defaultParams(DEFS))
  })
  it('clamps and snaps ranges', () => {
    const out = clampParams(DEFS, { cell: 1000, offset: 0.3 })
    expect(out.cell).toBe(64)
    expect(out.offset).toBe(0.25)
    expect(clampParams(DEFS, { cell: -5 }).cell).toBe(4)
    expect(clampParams(DEFS, { cell: 7 }).cell).toBe(8)
  })
  it('rejects wrong types and unknown options', () => {
    const out = clampParams(DEFS, { cell: 'big', mode: 'zzz', flag: 'yes', extra: 1 })
    expect(out).toEqual(defaultParams(DEFS))
    expect('extra' in out).toBe(false)
  })
  it('accepts valid select and toggle', () => {
    const out = clampParams(DEFS, { mode: 'b', flag: false })
    expect(out.mode).toBe('b')
    expect(out.flag).toBe(false)
  })
  it('avoids floating point garbage after snapping', () => {
    const defs: ParamDef[] = [{ type: 'range', key: 'd', label: 'D', min: 0.1, max: 0.6, step: 0.05, default: 0.3 }]
    expect(clampParams(defs, { d: 0.35 }).d).toBe(0.35)
    expect(clampParams(defs, { d: 0.3 }).d).toBe(0.3)
  })
})

describe('readers', () => {
  it('cast values', () => {
    const p = defaultParams(DEFS)
    expect(num(p, 'cell')).toBe(16)
    expect(str(p, 'mode')).toBe('a')
    expect(bool(p, 'flag')).toBe(true)
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/core/params.test.ts`
Expected: FAIL — `Cannot find module './params'`

- [ ] **Step 3: 구현**

`src/core/params.ts`
```ts
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
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/core/params.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/core/params.ts src/core/params.test.ts
git commit -m "feat(core): 매개변수 정의, 기본값, 클램프"
```

---

### Task 6: 프리셋 팔레트 (`core/palettes.ts`)

**Files:**
- Create: `src/core/palettes.ts`
- Test: `src/core/palettes.test.ts`

**Interfaces:**
- Consumes: `hsvToRgb`, `toHex`, `parseHex` (Task 3)
- Produces:
  ```ts
  export interface PalettePreset { name: string; colors: string[] }
  export const PRESETS: PalettePreset[]                // 8종, 첫 색이 배경
  export const DEFAULT_PALETTE: string[]               // PRESETS[0].colors
  export const MAX_COLORS = 8
  export const MIN_COLORS = 2
  export function ensurePaletteLength(palette: string[], minColors: number): string[]
  export function randomPalette(count: number, random?: () => number): string[]
  ```

- [ ] **Step 1: 실패하는 테스트 작성**

`src/core/palettes.test.ts`
```ts
import { describe, it, expect } from 'vitest'
import { PRESETS, DEFAULT_PALETTE, MAX_COLORS, ensurePaletteLength, randomPalette } from './palettes'
import { parseHex } from './color'

describe('PRESETS', () => {
  it('has 8 presets of valid lowercase hex, 2..8 colors each', () => {
    expect(PRESETS).toHaveLength(8)
    for (const p of PRESETS) {
      expect(p.name.length).toBeGreaterThan(0)
      expect(p.colors.length).toBeGreaterThanOrEqual(2)
      expect(p.colors.length).toBeLessThanOrEqual(MAX_COLORS)
      for (const c of p.colors) {
        expect(c).toMatch(/^#[0-9a-f]{6}$/)
        expect(parseHex(c)).not.toBeNull()
      }
    }
    expect(DEFAULT_PALETTE).toEqual(PRESETS[0].colors)
  })
})

describe('ensurePaletteLength', () => {
  it('returns the same array when long enough', () => {
    const p = ['#000000', '#ffffff', '#ff0000']
    expect(ensurePaletteLength(p, 3)).toBe(p)
  })
  it('appends filler colors not already present', () => {
    const out = ensurePaletteLength(['#000000', '#ffffff'], 4)
    expect(out).toHaveLength(4)
    expect(out.slice(0, 2)).toEqual(['#000000', '#ffffff'])
    expect(new Set(out).size).toBe(4)
  })
})

describe('randomPalette', () => {
  it('returns count valid colors, deterministic for a fixed random source', () => {
    let i = 0
    const seq = [0.1, 0.7, 0.3, 0.9, 0.2, 0.5, 0.8, 0.4, 0.6, 0.05, 0.95, 0.33]
    const random = () => seq[i++ % seq.length]
    const a = randomPalette(5, random)
    i = 0
    const b = randomPalette(5, random)
    expect(a).toEqual(b)
    expect(a).toHaveLength(5)
    for (const c of a) expect(c).toMatch(/^#[0-9a-f]{6}$/)
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/core/palettes.test.ts`
Expected: FAIL — `Cannot find module './palettes'`

- [ ] **Step 3: 구현**

`src/core/palettes.ts`
```ts
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
  while (out.length < minColors) out.push(FILLER[out.length % FILLER.length])
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
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/core/palettes.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/core/palettes.ts src/core/palettes.test.ts
git commit -m "feat(core): 프리셋 팔레트 8종, 길이 보정, 랜덤 팔레트"
```

---

### Task 7: 패턴 상태와 URL 인코딩 (`core/state.ts`)

**Files:**
- Create: `src/core/state.ts`
- Test: `src/core/state.test.ts`

**Interfaces:**
- Consumes: `ParamDef`, `Params`, `defaultParams`, `clampParams` (Task 5); `ensurePaletteLength` (Task 6); `parseHex`, `toHex` (Task 3); `MAX_SEED` (Task 2)
- Produces:
  ```ts
  export interface PatternState { generator: string; seed: number; params: Params; palette: string[] }
  export interface GeneratorInfo { params: ParamDef[]; minColors: number }
  export type ResolveGenerator = (id: string) => GeneratorInfo | undefined
  export interface StateDefaults { generator: string; palette: string[] }
  export const DEFAULT_SEED = 1
  export function encodeState(state: PatternState): string                 // base64url, '#' 없음
  export function decodeState(hash: string, resolve: ResolveGenerator, defaults: StateDefaults): PatternState
  export function normalizePalette(input: unknown, minColors: number, fallback: string[]): string[]
  ```
- 생성기 레지스트리를 직접 import하지 않고 `resolve` 콜백으로 받는다(core → generators 의존 금지).

- [ ] **Step 1: 실패하는 테스트 작성**

`src/core/state.test.ts`
```ts
import { describe, it, expect } from 'vitest'
import type { ParamDef } from './params'
import type { PatternState, ResolveGenerator } from './state'
import { encodeState, decodeState, normalizePalette, DEFAULT_SEED } from './state'

const A_DEFS: ParamDef[] = [
  { type: 'range', key: 'cell', label: 'Cell', min: 4, max: 64, step: 2, default: 16 },
  { type: 'select', key: 'mode', label: 'Mode', options: [{ value: 'x', label: 'X' }, { value: 'y', label: 'Y' }], default: 'x' },
]
const B_DEFS: ParamDef[] = [{ type: 'toggle', key: 'flag', label: 'Flag', default: false }]

const resolve: ResolveGenerator = (id) =>
  id === 'a' ? { params: A_DEFS, minColors: 3 } : id === 'b' ? { params: B_DEFS, minColors: 2 } : undefined

const defaults = { generator: 'a', palette: ['#000000', '#ffffff', '#ff0000', '#00ff00'] }

describe('encode/decode', () => {
  it('round-trips a valid state', () => {
    const state: PatternState = { generator: 'b', seed: 4242, params: { flag: true }, palette: ['#111111', '#e63b2e'] }
    const hash = encodeState(state)
    expect(hash).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(decodeState('#' + hash, resolve, defaults)).toEqual(state)
    expect(decodeState(hash, resolve, defaults)).toEqual(state)
  })
  it('returns defaults for empty or garbage hash', () => {
    const base = decodeState('', resolve, defaults)
    expect(base).toEqual({ generator: 'a', seed: DEFAULT_SEED, params: { cell: 16, mode: 'x' }, palette: defaults.palette })
    expect(decodeState('#not-base64!!', resolve, defaults)).toEqual(base)
    expect(decodeState('#' + btoa('[1,2,3]'), resolve, defaults)).toEqual(base)
  })
  it('falls back to the default generator for unknown ids', () => {
    const hash = encodeState({ generator: 'zzz', seed: 5, params: {}, palette: ['#000000', '#ffffff'] })
    const out = decodeState(hash, resolve, defaults)
    expect(out.generator).toBe('a')
    expect(out.seed).toBe(5)
    expect(out.params).toEqual({ cell: 16, mode: 'x' })
  })
  it('clamps params and seed', () => {
    const hash = encodeState({ generator: 'a', seed: -3, params: { cell: 999, mode: 'nope' }, palette: ['#000000', '#ffffff', '#ff0000'] })
    const out = decodeState(hash, resolve, defaults)
    expect(out.seed).toBe(DEFAULT_SEED)
    expect(out.params).toEqual({ cell: 64, mode: 'x' })
  })
  it('normalizes the palette', () => {
    const hash = encodeState({ generator: 'a', seed: 1, params: {}, palette: ['#ABC', 'junk', '#ffffff'] })
    const out = decodeState(hash, resolve, defaults)
    expect(out.palette.slice(0, 2)).toEqual(['#aabbcc', '#ffffff'])
    expect(out.palette.length).toBeGreaterThanOrEqual(3)
  })
})

describe('normalizePalette', () => {
  it('drops invalid entries, lowercases, caps at 8, pads to minColors', () => {
    expect(normalizePalette(['#FFF', 'x', '#000000'], 2, ['#111111', '#222222'])).toEqual(['#ffffff', '#000000'])
    expect(normalizePalette('nope', 2, ['#111111', '#222222'])).toEqual(['#111111', '#222222'])
    expect(normalizePalette(['#000000'], 2, ['#111111', '#222222'])).toEqual(['#111111', '#222222'])
    const nine = Array.from({ length: 9 }, (_, i) => `#0000${i}${i}`)
    expect(normalizePalette(nine, 2, ['#111111', '#222222'])).toHaveLength(8)
    expect(normalizePalette(['#000000', '#ffffff'], 4, ['#111111', '#222222'])).toHaveLength(4)
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/core/state.test.ts`
Expected: FAIL — `Cannot find module './state'`

- [ ] **Step 3: 구현**

`src/core/state.ts`
```ts
import type { ParamDef, Params } from './params'
import { clampParams, defaultParams } from './params'
import { ensurePaletteLength, MAX_COLORS, MIN_COLORS } from './palettes'
import { parseHex, toHex } from './color'
import { MAX_SEED } from './prng'

export interface PatternState {
  generator: string
  seed: number
  params: Params
  palette: string[]
}

export interface GeneratorInfo {
  params: ParamDef[]
  minColors: number
}
export type ResolveGenerator = (id: string) => GeneratorInfo | undefined

export interface StateDefaults {
  generator: string
  palette: string[]
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

export function decodeState(hash: string, resolve: ResolveGenerator, defaults: StateDefaults): PatternState {
  const defaultInfo = resolve(defaults.generator)
  if (!defaultInfo) throw new Error(`Unknown default generator: ${defaults.generator}`)
  const base: PatternState = {
    generator: defaults.generator,
    seed: DEFAULT_SEED,
    params: defaultParams(defaultInfo.params),
    palette: ensurePaletteLength(defaults.palette, defaultInfo.minColors),
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
  return {
    generator,
    seed,
    params: clampParams(info.params, rawParams),
    palette: normalizePalette(obj.palette, info.minColors, defaults.palette),
  }
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/core/state.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/core/state.ts src/core/state.test.ts
git commit -m "feat(core): PatternState와 URL 해시 인코딩/디코딩"
```

---

### Task 8: 생성기 타입·레지스트리·공통 테스트·첫 생성기 `stripes`

**Files:**
- Create: `src/generators/types.ts`, `src/generators/util.ts`, `src/generators/stripes.ts`, `src/generators/index.ts`, `src/generators/testUtils.ts`
- Test: `src/generators/generators.test.ts`, `src/generators/stripes.test.ts`

**Interfaces:**
- Consumes: `Rng`, `mulberry32` (Task 2); `Scene`, `Shape`, `Paint`, `tileWrap`, `shapeBounds`, `EPS` (Task 4); `ParamDef`, `Params`, `defaultParams`, `clampParams`, `num/str/bool` (Task 5); `ensurePaletteLength`, `PRESETS` (Task 6); `PatternState` (Task 7)
- Produces:
  ```ts
  // generators/types.ts
  export interface GenContext { params: Params; palette: string[]; rng: Rng }
  export interface GeneratorDef {
    id: string; name: string; family: 'grid' | 'gradient' | 'tessellation'; minColors: number
    params: ParamDef[]; generate(ctx: GenContext): Scene
  }
  // generators/util.ts
  export function fg(palette: string[], i: number): string          // palette[1..] 순환 (음수 안전)
  export function rect(x: number, y: number, w: number, h: number, color: string): Shape
  export function poly(points: number[], color: string): Shape
  export function pickFg(palette: string[], rng: Rng, avoidIndex?: number): number  // 전경색 인덱스(0부터), avoidIndex와 다르게
  // generators/index.ts
  export const GENERATORS: GeneratorDef[]
  export const DEFAULT_GENERATOR_ID = 'stripes'
  export function getGenerator(id: string): GeneratorDef | undefined
  export function generateScene(state: PatternState): Scene
  ```
- `generators.test.ts`의 `CASES` 배열은 2부에서 생성기를 추가할 때마다 한 행씩 늘린다.
- 테스트 헬퍼는 `testUtils.ts`(`.test.ts`가 아님)에 둔다. `.test.ts` 파일에서 export한 것을 다른 테스트가 import하면 describe가 중복 등록되기 때문이다.
  ```ts
  // generators/testUtils.ts
  export const PALETTE8: string[]                       // 8색, [0]은 배경
  export function run(id: string, overrides?: Params, palette?: string[], seed?: number): Scene
  export function colorsOf(scene: Scene): string[]      // solid 색 + linear 정지점 색
  ```

- [ ] **Step 1: 테스트 헬퍼, 공통 테스트, stripes 전용 테스트 작성**

`src/generators/testUtils.ts`
```ts
import type { Params } from '../core/params'
import { defaultParams } from '../core/params'
import type { Scene } from '../core/scene'
import { mulberry32 } from '../core/prng'
import { getGenerator } from './index'

export const PALETTE8 = ['#111111', '#e63b2e', '#f2a91e', '#6aa9dc', '#1f7a4d', '#e8459a', '#f2f2f2', '#7a1a1a']

/** 생성기를 기본값 + overrides로 실행한다 */
export function run(id: string, overrides: Params = {}, palette: string[] = PALETTE8, seed = 1): Scene {
  const g = getGenerator(id)
  if (!g) throw new Error(`unknown generator ${id}`)
  return g.generate({ params: { ...defaultParams(g.params), ...overrides }, palette, rng: mulberry32(seed) })
}

/** Scene에 쓰인 모든 색(solid 색과 linear 정지점 색) */
export function colorsOf(scene: Scene): string[] {
  const out: string[] = []
  for (const s of scene.shapes) {
    if (s.fill.type === 'solid') out.push(s.fill.color)
    else for (const st of s.fill.stops) out.push(st.color)
  }
  return out
}
```

`src/generators/generators.test.ts`
```ts
import { describe, it, expect } from 'vitest'
import type { ParamValue } from '../core/params'
import { defaultParams } from '../core/params'
import { EPS, shapeBounds } from '../core/scene'
import { PRESETS, ensurePaletteLength } from '../core/palettes'
import { GENERATORS, getGenerator, generateScene, DEFAULT_GENERATOR_ID } from './index'
import { PALETTE8, run, colorsOf } from './testUtils'

interface Case {
  id: string
  /** rng를 실제로 사용하게 만드는 매개변수(없으면 결정성 테스트에서 시드 비교를 건너뜀) */
  rngParams?: Record<string, ParamValue>
  /** 팔레트 밖 색(혼합색)이 허용되는 생성기 */
  mixedColors?: boolean
}

// 2부에서 생성기를 추가할 때마다 여기에 한 행씩 추가한다
const CASES: Case[] = [
  { id: 'stripes', rngParams: { colorMode: 'random' } },
]

describe('registry', () => {
  it('has unique ids and a valid default', () => {
    const ids = GENERATORS.map((g) => g.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(getGenerator(DEFAULT_GENERATOR_ID)).toBeDefined()
    expect(getGenerator('nope')).toBeUndefined()
  })
  it('every registered generator has a test case', () => {
    for (const g of GENERATORS) expect(CASES.some((c) => c.id === g.id)).toBe(true)
  })
  it('generateScene pads a short palette and clamps params', () => {
    const scene = generateScene({ generator: DEFAULT_GENERATOR_ID, seed: 3, params: { cell: 9999 }, palette: ['#000000', '#ffffff'] })
    expect(scene.shapes.length).toBeGreaterThan(0)
  })
})

describe.each(CASES)('generator $id', ({ id, rngParams, mixedColors }) => {
  it('is registered', () => {
    expect(getGenerator(id)).toBeDefined()
  })
  it('is deterministic for the same input', () => {
    expect(run(id, rngParams)).toEqual(run(id, rngParams))
  })
  it('changes with the seed when rng is used', () => {
    if (!rngParams) return
    expect(run(id, rngParams, PALETTE8, 1)).not.toEqual(run(id, rngParams, PALETTE8, 2))
  })
  it('has a positive tile size and at least one shape', () => {
    const s = run(id)
    expect(s.width).toBeGreaterThan(0)
    expect(s.height).toBeGreaterThan(0)
    expect(s.shapes.length).toBeGreaterThan(0)
  })
  it('keeps every shape inside the tile', () => {
    for (const params of [undefined, rngParams]) {
      const s = run(id, params)
      for (const sh of s.shapes) {
        const b = shapeBounds(sh)
        expect(b.x0).toBeGreaterThanOrEqual(-EPS)
        expect(b.y0).toBeGreaterThanOrEqual(-EPS)
        expect(b.x1).toBeLessThanOrEqual(s.width + EPS)
        expect(b.y1).toBeLessThanOrEqual(s.height + EPS)
      }
    }
  })
  it('uses only palette colors (background = palette[0])', () => {
    const s = run(id)
    expect(s.background).toBe(PALETTE8[0])
    if (mixedColors) return
    for (const c of colorsOf(s)) expect(PALETTE8).toContain(c)
  })
  it('has defaults within range', () => {
    for (const d of getGenerator(id)!.params) {
      if (d.type === 'range') {
        expect(d.default).toBeGreaterThanOrEqual(d.min)
        expect(d.default).toBeLessThanOrEqual(d.max)
        expect(d.step).toBeGreaterThan(0)
      }
      if (d.type === 'select') expect(d.options.some((o) => o.value === d.default)).toBe(true)
    }
  })
  it('works with the minimum palette, 8 colors, and every preset', () => {
    const g = getGenerator(id)!
    expect(() => run(id, {}, PALETTE8.slice(0, g.minColors))).not.toThrow()
    expect(() => run(id, {}, PALETTE8)).not.toThrow()
    for (const p of PRESETS) expect(() => run(id, {}, ensurePaletteLength(p.colors, g.minColors))).not.toThrow()
  })
  it('grid tiles are whole multiples of cell', () => {
    const g = getGenerator(id)!
    if (g.family !== 'grid') return
    const s = run(id)
    const cell = defaultParams(g.params).cell as number
    expect(Math.abs(s.width / cell - Math.round(s.width / cell))).toBeLessThan(EPS)
    expect(Math.abs(s.height / cell - Math.round(s.height / cell))).toBeLessThan(EPS)
  })
})
```

`src/generators/stripes.test.ts`
```ts
import { describe, it, expect } from 'vitest'
import { run, PALETTE8 } from './testUtils'

describe('stripes', () => {
  it('tile size follows columns × segmentLength × cell and rows × (bandHeight + separator) × cell', () => {
    const s = run('stripes', { cell: 10, segmentLength: 4, columns: 3, rows: 4, bandHeight: 2, separator: 1 })
    expect(s.width).toBe(120)
    expect(s.height).toBe(120)
  })
  it('odd rows are shifted by offset × segment length and wrap', () => {
    const s = run('stripes', { cell: 10, segmentLength: 4, columns: 2, rows: 2, bandHeight: 2, separator: 0, offset: 0.5 })
    // 행 0: x = 0, 40  / 행 1: x = 20, 60 → 60+40 = 100 > 80 이므로 [60,80] + [0,20] 두 조각으로 감긴다
    const row1 = s.shapes.filter((sh) => sh.kind === 'rect' && sh.y === 20)
    const xs = row1.map((sh) => (sh.kind === 'rect' ? sh.x : -1)).sort((a, b) => a - b)
    expect(xs).toEqual([0, 20, 60])
  })
  it('sequence mode cycles foreground colors', () => {
    const s = run('stripes', { colorMode: 'sequence', columns: 3, rows: 2 })
    const colors = s.shapes.map((sh) => (sh.fill.type === 'solid' ? sh.fill.color : ''))
    expect(colors[0]).toBe(PALETTE8[1])
    expect(colors[1]).toBe(PALETTE8[2])
    expect(colors[2]).toBe(PALETTE8[3])
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/generators`
Expected: FAIL — `Cannot find module './index'`

- [ ] **Step 3: 타입·유틸·stripes·레지스트리 구현**

`src/generators/types.ts`
```ts
import type { Rng } from '../core/prng'
import type { Scene } from '../core/scene'
import type { ParamDef, Params } from '../core/params'

export interface GenContext {
  params: Params
  /** palette[0]은 배경, palette[1..]은 전경 */
  palette: string[]
  rng: Rng
}

export interface GeneratorDef {
  id: string
  name: string
  family: 'grid' | 'gradient' | 'tessellation'
  /** 배경 포함 최소 팔레트 길이 */
  minColors: number
  params: ParamDef[]
  generate(ctx: GenContext): Scene
}
```

`src/generators/util.ts`
```ts
import type { Rng } from '../core/prng'
import type { Shape } from '../core/scene'

/** 전경색 i번째 (palette[1..] 순환, 음수도 안전) */
export function fg(palette: string[], i: number): string {
  const n = palette.length - 1
  if (n <= 0) return palette[0]
  return palette[1 + (((i % n) + n) % n)]
}

/** rng로 전경색 인덱스를 고른다. avoidIndex가 주어지고 색이 2개 이상이면 그 인덱스를 피한다 */
export function pickFg(palette: string[], rng: Rng, avoidIndex?: number): number {
  const n = palette.length - 1
  if (n <= 1) return 0
  let i = rng.int(0, n - 1)
  if (avoidIndex !== undefined && i === avoidIndex) i = (i + 1) % n
  return i
}

export function rect(x: number, y: number, w: number, h: number, color: string): Shape {
  return { kind: 'rect', x, y, w, h, fill: { type: 'solid', color } }
}

export function poly(points: number[], color: string): Shape {
  return { kind: 'polygon', points, fill: { type: 'solid', color } }
}
```

`src/generators/stripes.ts`
```ts
import type { GeneratorDef } from './types'
import type { Shape } from '../core/scene'
import { tileWrap } from '../core/scene'
import { num, str } from '../core/params'
import { fg, pickFg, rect } from './util'

export const stripes: GeneratorDef = {
  id: 'stripes',
  name: 'Stripes',
  family: 'grid',
  minColors: 3,
  params: [
    { type: 'range', key: 'cell', label: 'Cell size', min: 4, max: 64, step: 2, default: 16 },
    { type: 'range', key: 'bandHeight', label: 'Band height', min: 1, max: 8, step: 1, default: 3 },
    { type: 'range', key: 'segmentLength', label: 'Segment length', min: 2, max: 16, step: 1, default: 6 },
    { type: 'range', key: 'columns', label: 'Segments per row', min: 1, max: 8, step: 1, default: 3 },
    { type: 'range', key: 'rows', label: 'Rows', min: 2, max: 12, step: 2, default: 6 },
    { type: 'range', key: 'offset', label: 'Row offset', min: 0, max: 1, step: 0.25, default: 0.5 },
    { type: 'range', key: 'separator', label: 'Separator', min: 0, max: 3, step: 1, default: 1 },
    {
      type: 'select', key: 'colorMode', label: 'Colors', default: 'sequence',
      options: [
        { value: 'sequence', label: 'Sequence' },
        { value: 'alternate', label: 'Alternate' },
        { value: 'random', label: 'Random' },
      ],
    },
  ],
  generate({ params, palette, rng }) {
    const cell = num(params, 'cell')
    const bandH = num(params, 'bandHeight') * cell
    const segL = num(params, 'segmentLength') * cell
    const cols = num(params, 'columns')
    const rows = num(params, 'rows')
    const offset = num(params, 'offset')
    const sep = num(params, 'separator') * cell
    const mode = str(params, 'colorMode')

    const width = cols * segL
    const height = rows * (bandH + sep)
    const shapes: Shape[] = []
    let k = 0
    for (let r = 0; r < rows; r++) {
      const y = r * (bandH + sep)
      const shift = r % 2 === 1 ? offset * segL : 0
      for (let c = 0; c < cols; c++) {
        let color: string
        if (mode === 'random') color = fg(palette, pickFg(palette, rng))
        else if (mode === 'alternate') color = fg(palette, (c % 2) + 2 * (r % 2))
        else color = fg(palette, k++)
        shapes.push(rect(c * segL + shift, y, segL, bandH, color))
      }
    }
    return { width, height, background: palette[0], shapes: tileWrap(shapes, width, height) }
  },
}
```

`src/generators/index.ts`
```ts
import type { Scene } from '../core/scene'
import type { PatternState } from '../core/state'
import { clampParams } from '../core/params'
import { ensurePaletteLength } from '../core/palettes'
import { mulberry32 } from '../core/prng'
import type { GeneratorDef } from './types'
import { stripes } from './stripes'

// 2부에서 생성기를 추가할 때 import와 이 배열에 한 줄씩 추가한다
export const GENERATORS: GeneratorDef[] = [stripes]

export const DEFAULT_GENERATOR_ID = 'stripes'

export function getGenerator(id: string): GeneratorDef | undefined {
  return GENERATORS.find((g) => g.id === id)
}

/** 상태 하나로 Scene을 만든다. 매개변수는 정의에 맞춰 보정하고 팔레트는 minColors까지 채운다 */
export function generateScene(state: PatternState): Scene {
  const def = getGenerator(state.generator) ?? GENERATORS[0]
  return def.generate({
    params: clampParams(def.params, state.params),
    palette: ensurePaletteLength(state.palette, def.minColors),
    rng: mulberry32(state.seed),
  })
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/generators`
Expected: PASS (registry 3개 + stripes 공통 10개 + stripes 전용 3개). `testUtils.ts`는 `.test.ts`가 아니므로 vitest가 테스트 파일로 수집하지 않는다.

- [ ] **Step 5: 전체 검증 후 커밋**

Run: `npm test && npm run lint && npm run build`
Expected: 모두 통과

```bash
git add src/generators
git commit -m "feat(generators): 생성기 타입·레지스트리·공통 테스트, stripes 생성기"
```

---

### Task 9: Canvas 렌더러와 출력 크기 계산 (`render/canvas.ts`, `render/export.ts`)

**Files:**
- Create: `src/render/canvas.ts`, `src/render/export.ts`
- Test: `src/render/export.test.ts`

**Interfaces:**
- Consumes: `Scene`, `Shape`, `Paint` (Task 4)
- Produces:
  ```ts
  // render/canvas.ts
  export interface TilePx { w: number; h: number }
  export function tilePixelSize(scene: Scene, scale: number): TilePx           // Math.round, 최소 1
  export function renderTile(scene: Scene, tilePx: TilePx, ctx: CanvasRenderingContext2D): void
  export function renderFill(scene: Scene, tilePx: TilePx, ctx: CanvasRenderingContext2D, w: number, h: number, origin?: { x: number; y: number }): void
  // render/export.ts
  export type ExportFormat = 'png' | 'jpg'
  export type ExportMode = 'tile' | 'canvas'
  export interface ExportSettings { format: ExportFormat; mode: ExportMode; scale: number; width: number; height: number }
  export const MAX_DIM = 8192
  export const SIZE_PRESETS: { label: string; w: number; h: number }[]
  export function outputSize(scene: Scene, s: ExportSettings): TilePx
  export function exceedsLimit(size: TilePx): boolean
  export function exportFilename(generator: string, seed: number, format: ExportFormat): string
  export function mimeOf(format: ExportFormat): string
  ```
- `renderFill`은 `origin`을 주면 그 위치에서 시작하는 `w × h` 영역을 채운다(3×3 뷰에서 사용). 기본은 (0, 0).

- [ ] **Step 1: export 순수 함수 테스트 작성**

`src/render/export.test.ts`
```ts
import { describe, it, expect } from 'vitest'
import type { Scene } from '../core/scene'
import { outputSize, exceedsLimit, exportFilename, mimeOf, MAX_DIM, SIZE_PRESETS } from './export'
import { tilePixelSize } from './canvas'

const scene: Scene = { width: 300, height: 200, background: '#000000', shapes: [] }

describe('tilePixelSize', () => {
  it('rounds to integers and never returns 0', () => {
    expect(tilePixelSize(scene, 1)).toEqual({ w: 300, h: 200 })
    expect(tilePixelSize(scene, 0.333)).toEqual({ w: 100, h: 67 })
    expect(tilePixelSize({ ...scene, width: 0.2, height: 0.2 }, 1)).toEqual({ w: 1, h: 1 })
  })
})

describe('outputSize / exceedsLimit', () => {
  it('tile mode uses scale, canvas mode uses width/height', () => {
    expect(outputSize(scene, { format: 'png', mode: 'tile', scale: 2, width: 0, height: 0 })).toEqual({ w: 600, h: 400 })
    expect(outputSize(scene, { format: 'png', mode: 'canvas', scale: 1, width: 1920.4, height: 1080 })).toEqual({ w: 1920, h: 1080 })
  })
  it('limits at MAX_DIM and rejects sizes below 1', () => {
    expect(exceedsLimit({ w: MAX_DIM, h: 10 })).toBe(false)
    expect(exceedsLimit({ w: MAX_DIM + 1, h: 10 })).toBe(true)
    expect(exceedsLimit({ w: 10, h: 0 })).toBe(true)
  })
  it('presets are within the limit', () => {
    expect(SIZE_PRESETS.length).toBeGreaterThanOrEqual(5)
    for (const p of SIZE_PRESETS) expect(exceedsLimit({ w: p.w, h: p.h })).toBe(false)
  })
})

describe('filename / mime', () => {
  it('formats the filename and mime type', () => {
    expect(exportFilename('stripes', 4242, 'png')).toBe('jacquard-stripes-4242.png')
    expect(exportFilename('isoCubes', 1, 'jpg')).toBe('jacquard-isoCubes-1.jpg')
    expect(mimeOf('png')).toBe('image/png')
    expect(mimeOf('jpg')).toBe('image/jpeg')
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/render`
Expected: FAIL — `Cannot find module './export'`

- [ ] **Step 3: 렌더러와 export 구현**

`src/render/canvas.ts`
```ts
import type { Paint, Scene } from '../core/scene'

export interface TilePx { w: number; h: number }

export function tilePixelSize(scene: Scene, scale: number): TilePx {
  return {
    w: Math.max(1, Math.round(scene.width * scale)),
    h: Math.max(1, Math.round(scene.height * scale)),
  }
}

function makePaint(ctx: CanvasRenderingContext2D, paint: Paint, sx: number, sy: number): string | CanvasGradient {
  if (paint.type === 'solid') return paint.color
  const g = ctx.createLinearGradient(paint.x1 * sx, paint.y1 * sy, paint.x2 * sx, paint.y2 * sy)
  for (const st of paint.stops) g.addColorStop(Math.min(1, Math.max(0, st.offset)), st.color)
  return g
}

/** 타일 1장을 (0,0)부터 tilePx 크기로 그린다. 배율은 축별로 정확히 tilePx / scene 크기 */
export function renderTile(scene: Scene, tilePx: TilePx, ctx: CanvasRenderingContext2D): void {
  const sx = tilePx.w / scene.width
  const sy = tilePx.h / scene.height
  ctx.save()
  ctx.fillStyle = scene.background
  ctx.fillRect(0, 0, tilePx.w, tilePx.h)
  for (const s of scene.shapes) {
    const paint = makePaint(ctx, s.fill, sx, sy)
    ctx.fillStyle = paint
    if (s.kind === 'rect') {
      // 각 변을 장치 픽셀에 맞춰 이음새를 없앤다
      const x0 = Math.round(s.x * sx)
      const y0 = Math.round(s.y * sy)
      const x1 = Math.round((s.x + s.w) * sx)
      const y1 = Math.round((s.y + s.h) * sy)
      if (x1 > x0 && y1 > y0) ctx.fillRect(x0, y0, x1 - x0, y1 - y0)
    } else {
      ctx.beginPath()
      for (let i = 0; i < s.points.length; i += 2) {
        const px = s.points[i] * sx
        const py = s.points[i + 1] * sy
        if (i === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      ctx.closePath()
      ctx.fill()
      // 같은 페인트로 1px 스트로크를 덧그려 안티에일리어싱 틈을 가린다
      ctx.strokeStyle = paint
      ctx.lineWidth = 1
      ctx.lineJoin = 'miter'
      ctx.stroke()
    }
  }
  ctx.restore()
}

/** 타일을 오프스크린에 그린 뒤 반복 패턴으로 origin에서 시작하는 w × h 영역을 채운다 */
export function renderFill(
  scene: Scene,
  tilePx: TilePx,
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  origin: { x: number; y: number } = { x: 0, y: 0 },
): void {
  const tile = document.createElement('canvas')
  tile.width = tilePx.w
  tile.height = tilePx.h
  const tctx = tile.getContext('2d')
  if (!tctx) return
  renderTile(scene, tilePx, tctx)
  const pattern = ctx.createPattern(tile, 'repeat')
  if (!pattern) return
  ctx.save()
  ctx.translate(origin.x, origin.y)
  ctx.fillStyle = pattern
  ctx.fillRect(0, 0, w, h)
  ctx.restore()
}
```

`src/render/export.ts`
```ts
import type { Scene } from '../core/scene'
import type { TilePx } from './canvas'
import { tilePixelSize } from './canvas'

export type ExportFormat = 'png' | 'jpg'
export type ExportMode = 'tile' | 'canvas'

export interface ExportSettings {
  format: ExportFormat
  mode: ExportMode
  /** tile 모드: px per unit. canvas 모드: 채우기에 쓰는 타일 배율 */
  scale: number
  width: number
  height: number
}

export const MAX_DIM = 8192

export const SIZE_PRESETS: { label: string; w: number; h: number }[] = [
  { label: '1080 × 1080', w: 1080, h: 1080 },
  { label: '1920 × 1080', w: 1920, h: 1080 },
  { label: '1080 × 1920', w: 1080, h: 1920 },
  { label: 'A4 300dpi (2480 × 3508)', w: 2480, h: 3508 },
  { label: 'A3 300dpi (3508 × 4961)', w: 3508, h: 4961 },
]

export function outputSize(scene: Scene, s: ExportSettings): TilePx {
  if (s.mode === 'tile') return tilePixelSize(scene, s.scale)
  return { w: Math.round(s.width), h: Math.round(s.height) }
}

export function exceedsLimit(size: TilePx): boolean {
  return size.w > MAX_DIM || size.h > MAX_DIM || size.w < 1 || size.h < 1
}

export function exportFilename(generator: string, seed: number, format: ExportFormat): string {
  return `jacquard-${generator}-${seed}.${format}`
}

export function mimeOf(format: ExportFormat): string {
  return format === 'png' ? 'image/png' : 'image/jpeg'
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/render`
Expected: PASS (5 tests). `export.ts`가 `canvas.ts`를 import하지만 `document`는 함수 안에서만 쓰므로 Node에서 import해도 오류가 없어야 한다.

- [ ] **Step 5: 커밋**

```bash
git add src/render
git commit -m "feat(render): Canvas 타일 렌더러, 반복 채우기, 출력 크기 계산"
```

---

### Task 10: 앱 골격 — TopBar, ControlPanel, ParamControl, Preview, App, 스타일

**Files:**
- Create: `src/ui/TopBar.tsx`, `src/ui/ControlPanel.tsx`, `src/ui/ParamControl.tsx`, `src/ui/Preview.tsx`
- Modify: `src/App.tsx` (Task 1의 임시 파일 전체 교체), `src/styles.css` (Task 1 내용 뒤에 추가)

**Interfaces:**
- Consumes: `PatternState`, `encodeState`, `decodeState` (Task 7); `GENERATORS`, `getGenerator`, `generateScene`, `DEFAULT_GENERATOR_ID` (Task 8); `defaultParams`, `ParamDef`, `ParamValue`, `Params` (Task 5); `DEFAULT_PALETTE`, `ensurePaletteLength` (Task 6); `randomSeed`, `MAX_SEED` (Task 2); `tilePixelSize`, `renderFill` (Task 9)
- Produces:
  ```ts
  // ui/Preview.tsx
  export type ViewMode = 'fill' | 'tile' | 'grid3'
  export function Preview(props: { scene: Scene; view: ViewMode; scale: number; onViewChange(v: ViewMode): void; onScaleChange(s: number): void }): JSX.Element
  // ui/TopBar.tsx
  export function TopBar(props: { generators: GeneratorDef[]; generatorId: string; seed: number; onGeneratorChange(id: string): void; onSeedChange(seed: number): void; onRandomSeed(): void; onCopyLink(): Promise<void> | void; onExport(): void }): JSX.Element
  // ui/ControlPanel.tsx  — children 슬롯에 3부의 PalettePanel이 들어간다
  export function ControlPanel(props: { generator: GeneratorDef; params: Params; onParamChange(key: string, value: ParamValue): void; scene: Scene; tilePx: TilePx; children?: ReactNode }): JSX.Element
  // ui/ParamControl.tsx
  export function ParamControl(props: { def: ParamDef; value: ParamValue; onChange(v: ParamValue): void }): JSX.Element
  ```
- App은 `pattern: PatternState`, `view`, `scale`을 소유한다. `onExport`는 이 Task에서는 빈 함수이고 3부에서 대화상자를 연다.

- [ ] **Step 1: ParamControl 작성**

`src/ui/ParamControl.tsx`
```tsx
import type { ParamDef, ParamValue } from '../core/params'

interface Props {
  def: ParamDef
  value: ParamValue
  onChange(v: ParamValue): void
}

export function ParamControl({ def, value, onChange }: Props) {
  if (def.type === 'range') {
    const v = typeof value === 'number' ? value : def.default
    const commit = (raw: string) => {
      const n = Number(raw)
      if (Number.isFinite(n)) onChange(Math.min(def.max, Math.max(def.min, n)))
    }
    return (
      <label className="control">
        <span className="control-label">{def.label}</span>
        <input type="range" min={def.min} max={def.max} step={def.step} value={v} onChange={(e) => commit(e.target.value)} />
        <input className="num" type="number" min={def.min} max={def.max} step={def.step} value={v} onChange={(e) => commit(e.target.value)} />
      </label>
    )
  }
  if (def.type === 'select') {
    const v = typeof value === 'string' ? value : def.default
    if (def.options.length <= 4) {
      return (
        <div className="control">
          <span className="control-label">{def.label}</span>
          <div className="segmented">
            {def.options.map((o) => (
              <button key={o.value} type="button" className={o.value === v ? 'on' : ''} onClick={() => onChange(o.value)}>
                {o.label}
              </button>
            ))}
          </div>
        </div>
      )
    }
    return (
      <label className="control">
        <span className="control-label">{def.label}</span>
        <select value={v} onChange={(e) => onChange(e.target.value)}>
          {def.options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </label>
    )
  }
  const v = typeof value === 'boolean' ? value : def.default
  return (
    <label className="control toggle">
      <span className="control-label">{def.label}</span>
      <input type="checkbox" checked={v} onChange={(e) => onChange(e.target.checked)} />
    </label>
  )
}
```

- [ ] **Step 2: ControlPanel 작성**

`src/ui/ControlPanel.tsx`
```tsx
import type { ReactNode } from 'react'
import type { GeneratorDef } from '../generators/types'
import type { Params, ParamValue } from '../core/params'
import type { Scene } from '../core/scene'
import type { TilePx } from '../render/canvas'
import { ParamControl } from './ParamControl'

interface Props {
  generator: GeneratorDef
  params: Params
  onParamChange(key: string, value: ParamValue): void
  scene: Scene
  tilePx: TilePx
  children?: ReactNode
}

export function ControlPanel({ generator, params, onParamChange, scene, tilePx, children }: Props) {
  return (
    <aside className="panel">
      <section className="panel-section">
        <h2>Parameters</h2>
        {generator.params.map((def) => (
          <ParamControl key={def.key} def={def} value={params[def.key] ?? def.default} onChange={(v) => onParamChange(def.key, v)} />
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

- [ ] **Step 3: TopBar 작성**

`src/ui/TopBar.tsx`
```tsx
import { useState } from 'react'
import type { GeneratorDef } from '../generators/types'
import { MAX_SEED } from '../core/prng'

interface Props {
  generators: GeneratorDef[]
  generatorId: string
  seed: number
  onGeneratorChange(id: string): void
  onSeedChange(seed: number): void
  onRandomSeed(): void
  onCopyLink(): Promise<void> | void
  onExport(): void
}

export function TopBar(p: Props) {
  const [copied, setCopied] = useState(false)
  return (
    <header className="topbar">
      <div className="brand">Jacquard</div>
      <select className="select" value={p.generatorId} onChange={(e) => p.onGeneratorChange(e.target.value)} aria-label="Generator">
        {p.generators.map((g) => (
          <option key={g.id} value={g.id}>{g.name}</option>
        ))}
      </select>
      <label className="seed">
        Seed
        <input
          type="number"
          min={0}
          max={MAX_SEED}
          value={p.seed}
          onChange={(e) => {
            const n = Number(e.target.value)
            if (Number.isInteger(n) && n >= 0 && n <= MAX_SEED) p.onSeedChange(n)
          }}
        />
      </label>
      <button type="button" className="btn" title="Random seed" onClick={p.onRandomSeed}>🎲</button>
      <div className="spacer" />
      <button
        type="button"
        className="btn"
        onClick={async () => {
          await p.onCopyLink()
          setCopied(true)
          setTimeout(() => setCopied(false), 1200)
        }}
      >
        {copied ? 'Copied' : 'Copy link'}
      </button>
      <button type="button" className="btn primary" onClick={p.onExport}>Export</button>
    </header>
  )
}
```

- [ ] **Step 4: Preview 작성**

`src/ui/Preview.tsx`
```tsx
import { useEffect, useRef } from 'react'
import type { Scene } from '../core/scene'
import { renderFill, tilePixelSize } from '../render/canvas'

export type ViewMode = 'fill' | 'tile' | 'grid3'

interface Props {
  scene: Scene
  view: ViewMode
  scale: number
  onViewChange(v: ViewMode): void
  onScaleChange(s: number): void
}

const VIEWS: { id: ViewMode; label: string }[] = [
  { id: 'fill', label: 'Fill' },
  { id: 'tile', label: 'Tile' },
  { id: 'grid3', label: '3 × 3' },
]

export function Preview({ scene, view, scale, onViewChange, onScaleChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return
    let raf = 0
    const draw = () => {
      const dpr = window.devicePixelRatio || 1
      const cw = wrap.clientWidth
      const ch = wrap.clientHeight
      if (cw === 0 || ch === 0) return
      canvas.width = Math.round(cw * dpr)
      canvas.height = Math.round(ch * dpr)
      canvas.style.width = `${cw}px`
      canvas.style.height = `${ch}px`
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.fillStyle = '#0c0c0c'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      const tilePx = tilePixelSize(scene, scale * dpr)
      if (view === 'fill') {
        renderFill(scene, tilePx, ctx, canvas.width, canvas.height)
        return
      }
      const n = view === 'tile' ? 1 : 3
      const totalW = tilePx.w * n
      const totalH = tilePx.h * n
      const ox = Math.round((canvas.width - totalW) / 2)
      const oy = Math.round((canvas.height - totalH) / 2)
      renderFill(scene, tilePx, ctx, totalW, totalH, { x: ox, y: oy })
      if (n === 3) {
        ctx.save()
        ctx.strokeStyle = 'rgba(255,255,255,0.75)'
        ctx.setLineDash([4 * dpr, 4 * dpr])
        ctx.lineWidth = dpr
        for (let i = 1; i < 3; i++) {
          ctx.beginPath()
          ctx.moveTo(ox + i * tilePx.w + 0.5, oy)
          ctx.lineTo(ox + i * tilePx.w + 0.5, oy + totalH)
          ctx.stroke()
          ctx.beginPath()
          ctx.moveTo(ox, oy + i * tilePx.h + 0.5)
          ctx.lineTo(ox + totalW, oy + i * tilePx.h + 0.5)
          ctx.stroke()
        }
        ctx.restore()
      }
    }
    const schedule = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(draw)
    }
    schedule()
    const ro = new ResizeObserver(schedule)
    ro.observe(wrap)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [scene, view, scale])

  return (
    <main className="preview">
      <div className="preview-toolbar">
        <div className="segmented">
          {VIEWS.map((v) => (
            <button key={v.id} type="button" className={v.id === view ? 'on' : ''} onClick={() => onViewChange(v.id)}>
              {v.label}
            </button>
          ))}
        </div>
        <label className="scale">
          Scale
          <input type="range" min={0.25} max={4} step={0.25} value={scale} onChange={(e) => onScaleChange(Number(e.target.value))} />
          <span className="mono">{scale.toFixed(2)}×</span>
        </label>
      </div>
      <div className="canvas-wrap" ref={wrapRef}>
        <canvas ref={canvasRef} />
      </div>
    </main>
  )
}
```

- [ ] **Step 5: App 교체**

`src/App.tsx` (전체 교체)
```tsx
import { useEffect, useMemo, useState } from 'react'
import type { PatternState } from './core/state'
import { decodeState, encodeState } from './core/state'
import type { ParamValue } from './core/params'
import { defaultParams } from './core/params'
import { DEFAULT_PALETTE, ensurePaletteLength } from './core/palettes'
import { randomSeed } from './core/prng'
import { DEFAULT_GENERATOR_ID, GENERATORS, generateScene, getGenerator } from './generators'
import { tilePixelSize } from './render/canvas'
import { TopBar } from './ui/TopBar'
import { ControlPanel } from './ui/ControlPanel'
import { Preview } from './ui/Preview'
import type { ViewMode } from './ui/Preview'

const resolve = (id: string) => {
  const g = getGenerator(id)
  return g ? { params: g.params, minColors: g.minColors } : undefined
}

export default function App() {
  const [pattern, setPattern] = useState<PatternState>(() =>
    decodeState(window.location.hash, resolve, { generator: DEFAULT_GENERATOR_ID, palette: DEFAULT_PALETTE }),
  )
  const [view, setView] = useState<ViewMode>('fill')
  const [scale, setScale] = useState(1)

  const generator = getGenerator(pattern.generator) ?? GENERATORS[0]
  const scene = useMemo(() => generateScene(pattern), [pattern])
  const tilePx = tilePixelSize(scene, scale)

  useEffect(() => {
    const t = setTimeout(() => {
      window.history.replaceState(null, '', `#${encodeState(pattern)}`)
    }, 300)
    return () => clearTimeout(t)
  }, [pattern])

  const setParam = (key: string, value: ParamValue) =>
    setPattern((p) => ({ ...p, params: { ...p.params, [key]: value } }))

  const selectGenerator = (id: string) => {
    const g = getGenerator(id)
    if (!g) return
    setPattern((p) => ({
      ...p,
      generator: id,
      params: defaultParams(g.params),
      palette: ensurePaletteLength(p.palette, g.minColors),
    }))
  }

  return (
    <div className="app">
      <TopBar
        generators={GENERATORS}
        generatorId={pattern.generator}
        seed={pattern.seed}
        onGeneratorChange={selectGenerator}
        onSeedChange={(seed) => setPattern((p) => ({ ...p, seed }))}
        onRandomSeed={() => setPattern((p) => ({ ...p, seed: randomSeed() }))}
        onCopyLink={() => navigator.clipboard.writeText(window.location.href)}
        onExport={() => {}}
      />
      <div className="body">
        <ControlPanel generator={generator} params={pattern.params} onParamChange={setParam} scene={scene} tilePx={tilePx} />
        <Preview scene={scene} view={view} scale={scale} onViewChange={setView} onScaleChange={setScale} />
      </div>
    </div>
  )
}
```

- [ ] **Step 6: 스타일 추가**

`src/styles.css` — Task 1 내용 뒤에 다음을 추가
```css
.app { display: flex; flex-direction: column; height: 100%; min-width: 1024px; }
.topbar {
  display: flex; align-items: center; gap: 12px; height: 48px; padding: 0 16px;
  background: var(--panel); border-bottom: 1px solid var(--border);
}
.brand { font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; margin-right: 8px; }
.spacer { flex: 1; }
.body { display: flex; flex: 1; min-height: 0; }
.panel {
  width: 320px; flex: none; overflow-y: auto; padding: 12px 16px 24px;
  background: var(--panel); border-right: 1px solid var(--border);
}
.panel-section { margin-bottom: 20px; }
.panel-section h2 {
  font-size: 11px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase;
  color: var(--muted); margin: 0 0 10px;
}
.control { display: grid; grid-template-columns: 1fr; gap: 4px; margin-bottom: 10px; }
.control-label { color: var(--muted); }
.control input[type='range'] { width: 100%; accent-color: var(--accent); }
.control .num, .control select, .seed input, .select {
  background: var(--bg); color: var(--text); border: 1px solid var(--border); border-radius: 4px;
  padding: 4px 6px; font: inherit;
}
.control .num { width: 80px; justify-self: end; }
.control.toggle { grid-template-columns: 1fr auto; align-items: center; }
.segmented { display: inline-flex; border: 1px solid var(--border); border-radius: 4px; overflow: hidden; }
.segmented button {
  background: transparent; color: var(--muted); border: 0; padding: 4px 10px; font: inherit; cursor: pointer;
}
.segmented button + button { border-left: 1px solid var(--border); }
.segmented button.on { background: var(--accent); color: #0c0c0c; }
.btn {
  background: var(--bg); color: var(--text); border: 1px solid var(--border); border-radius: 4px;
  padding: 5px 10px; font: inherit; cursor: pointer;
}
.btn:hover { border-color: var(--accent); }
.btn.primary { background: var(--accent); color: #0c0c0c; border-color: var(--accent); font-weight: 600; }
.seed { display: inline-flex; align-items: center; gap: 6px; color: var(--muted); }
.seed input { width: 120px; }
.info { color: var(--muted); margin-bottom: 4px; }
.mono { font-variant-numeric: tabular-nums; color: var(--muted); min-width: 48px; text-align: right; }
.preview { flex: 1; display: flex; flex-direction: column; min-width: 0; }
.preview-toolbar {
  display: flex; align-items: center; gap: 16px; height: 40px; padding: 0 16px;
  border-bottom: 1px solid var(--border);
}
.scale { display: inline-flex; align-items: center; gap: 8px; color: var(--muted); }
.scale input { width: 140px; accent-color: var(--accent); }
.canvas-wrap { flex: 1; min-height: 0; position: relative; }
.canvas-wrap canvas { display: block; position: absolute; inset: 0; }
```

- [ ] **Step 7: 빌드·린트·테스트**

Run: `npm run build && npm run lint && npm test`
Expected: 모두 통과. 타입 오류가 나면 `import type` 누락이나 미사용 변수를 먼저 의심한다.

- [ ] **Step 8: 브라우저 육안 검증**

Run: `npm run dev` (백그라운드) → 브라우저 자동화 도구(Playwright MCP 또는 Claude in Chrome)로 `http://localhost:5173` 열기
확인 항목:
1. 상단 바에 Jacquard, 생성기 드롭다운(Stripes), Seed 입력, 🎲, Copy link, Export가 보인다.
2. 왼쪽 패널에 8개 매개변수 컨트롤과 Output 정보가 보인다.
3. 미리보기에 벽돌식 스트라이프 패턴이 화면을 채운다. 슬라이더를 움직이면 즉시 바뀐다.
4. 뷰를 3 × 3으로 바꾸면 점선 경계가 보이고 경계에서 무늬가 끊기지 않는다(홀수 행이 반 칸 어긋나 감겨 있어야 한다).
5. 🎲을 눌러도 기본 colorMode(sequence)에서는 그림이 바뀌지 않지만 Colors를 Random으로 바꾸면 시드마다 달라진다.
6. 주소창 해시가 바뀌고, 새로고침하면 같은 상태가 복원된다.
스크린샷을 `docs/screenshots/01-stripes.png`로 저장한다(`docs/screenshots/` 폴더 생성). 화면이 비어 있으면 브라우저 콘솔 오류를 먼저 읽는다.

- [ ] **Step 9: 커밋**

```bash
git add -A
git commit -m "feat(ui): 앱 골격 — 상단 바, 매개변수 패널, 캔버스 미리보기, URL 상태 동기화"
git push origin main
```

---

## 자체 검토 결과 (계획 작성자)

- 설계서 3절(스택) → Task 1. 4.3 타입 → Task 4·5·7·8. 4.4 tileWrap → Task 4. 4.5 렌더러 → Task 9. 4.6 내보내기 중 순수 함수 → Task 9, 다운로드·대화상자 → 3부. 4.7 URL → Task 7·10. 5.1 stripes → Task 8. 6절 색 변환 → Task 3, 색 편집기·팔레트 패널 → 3부. 7절 레이아웃·동작 중 팔레트/내보내기 제외 → Task 10.
- Task 8의 공통 테스트가 "등록된 모든 생성기는 CASES에 있어야 한다"를 강제하므로 2부에서 생성기를 등록만 하고 테스트를 빠뜨리는 실수가 잡힌다.
- `ResolveGenerator` 콜백 방식으로 core → generators 의존을 끊었다.
