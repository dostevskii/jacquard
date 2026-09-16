# Jacquard 구현 계획 3부 — 팔레트 편집기, 내보내기, 배포·README

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 색상환·명도 슬라이더·HEX/RGB/HSL/HSB 입력이 있는 팔레트 편집기, PNG/JPG 내보내기 대화상자를 완성하고, 스크린샷·Cloudflare Pages 배포·한영 README·GitHub About까지 마무리해 v1을 공개 가능한 상태로 만든다.

**Architecture:** 팔레트 편집기는 `PalettePanel`이 선택 스와치의 `Hsv` 상태를 소유하고, 하위 `ColorEditor`(`ColorWheel` + 명도 슬라이더 + `ColorInputs`)가 그 값을 편집한다. 포인터 좌표 ↔ 색상·채도 변환과 회색에서의 색상 보존은 순수 함수 `colorMath.ts`로 분리해 테스트한다. 내보내기는 `render/export.ts`의 `renderForExport`가 오프스크린 캔버스를 만들고 `canvas.toBlob`으로 파일을 받는다.

**Tech Stack:** React 19, TypeScript, Vitest, Cloudflare Pages(wrangler 직접 업로드). 새 런타임 의존성 없음.

**Spec:** `docs/superpowers/specs/2026-09-16-jacquard-design.md` 4.6, 4.7, 6절, 7절, 9절 7단계.

**선행 조건:** 1부·2부가 완료되어 생성기 8종이 등록되고 `npm test`, `npm run lint`, `npm run build`가 통과하는 상태.

## Global Constraints

- 1부의 Global Constraints가 그대로 적용된다.
- 색상 관련 순수 계산은 `src/core/color.ts`(변환)와 `src/ui/colorMath.ts`(색상환 좌표·색상 보존)에만 둔다. 컴포넌트 안에서 삼각함수를 직접 쓰지 않는다.
- 색상환은 외부 라이브러리 없이 CSS `conic-gradient` + `radial-gradient` + 검은 오버레이로 그린다.
- 내보내기 한 변 상한은 `MAX_DIM = 8192`(1부 `render/export.ts`).
- 배포는 `npx wrangler`로 실행하며 `wrangler`를 package.json 의존성에 추가하지 않는다. 로그인이 안 되어 있으면 멈추고 황보정님께 `npx wrangler login` 실행을 요청한다. 배포는 되돌리기 어려운 외부 공개 작업이므로 Task 21의 Step 4 직전에 반드시 사용자 확인을 받는다.
- README·About 작성은 `presenting-github-repo` 스킬을 호출해 그 절차를 따른다(황보정님의 저장소 꾸미기 규칙).

---

## 1부·2부에서 쓸 수 있는 인터페이스 (요약)

```ts
// core/color.ts
type Rgb = { r: number; g: number; b: number }; type Hsl = { h: number; s: number; l: number }; type Hsv = { h: number; s: number; v: number }
parseHex(input: string): Rgb | null;  toHex(rgb: Rgb): string;  rgbToHsl;  hslToRgb;  rgbToHsv;  hsvToRgb
// core/palettes.ts
PRESETS: { name: string; colors: string[] }[];  MAX_COLORS = 8;  MIN_COLORS = 2;  ensurePaletteLength(palette, minColors): string[];  randomPalette(count): string[]
// core/state.ts
interface PatternState { generator: string; seed: number; params: Params; palette: string[] }
// render/canvas.ts
interface TilePx { w: number; h: number };  tilePixelSize(scene, scale): TilePx;  renderTile(scene, tilePx, ctx);  renderFill(scene, tilePx, ctx, w, h, origin?)
// render/export.ts
type ExportFormat = 'png' | 'jpg';  type ExportMode = 'tile' | 'canvas'
interface ExportSettings { format: ExportFormat; mode: ExportMode; scale: number; width: number; height: number }
MAX_DIM;  SIZE_PRESETS: { label: string; w: number; h: number }[];  outputSize(scene, s): TilePx;  exceedsLimit(size): boolean;  exportFilename(generator, seed, format): string;  mimeOf(format): string
// ui/ControlPanel.tsx — children 슬롯이 Parameters 섹션과 Output 섹션 사이에 렌더된다
// App.tsx — pattern: PatternState, setPattern, generator: GeneratorDef, scene, scale(미리보기 배율), TopBar onExport는 현재 빈 함수
```

---

### Task 18: 색상환 수학, ColorWheel, ColorInputs, ColorEditor

**Files:**
- Create: `src/ui/colorMath.ts`, `src/ui/ColorWheel.tsx`, `src/ui/ColorInputs.tsx`, `src/ui/ColorEditor.tsx`
- Modify: `src/styles.css` (뒤에 추가)
- Test: `src/ui/colorMath.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // ui/colorMath.ts
  export function hsFromPointer(dx: number, dy: number, radius: number): { h: number; s: number }  // 위쪽 0°, 시계 방향
  export function markerPosition(hsv: Hsv, radius: number): { x: number; y: number }                // 좌상단 기준 px
  export function keepHue(next: Hsv, prev: Hsv): Hsv                                                  // s 또는 v가 0이면 prev.h 유지
  // ui/ColorWheel.tsx
  export function ColorWheel(props: { hsv: Hsv; onChange(hsv: Hsv): void; size?: number }): JSX.Element
  // ui/ColorInputs.tsx
  export function ColorInputs(props: { hsv: Hsv; onChange(hsv: Hsv): void }): JSX.Element
  // ui/ColorEditor.tsx
  export function ColorEditor(props: { hsv: Hsv; onChange(hsv: Hsv): void }): JSX.Element
  ```

- [ ] **Step 1: colorMath 테스트 작성**

`src/ui/colorMath.test.ts`
```ts
import { describe, it, expect } from 'vitest'
import { hsFromPointer, markerPosition, keepHue } from './colorMath'

describe('hsFromPointer', () => {
  it('maps top/right/bottom/left to hue 0/90/180/270', () => {
    expect(hsFromPointer(0, -100, 100).h).toBeCloseTo(0)
    expect(hsFromPointer(100, 0, 100).h).toBeCloseTo(90)
    expect(hsFromPointer(0, 100, 100).h).toBeCloseTo(180)
    expect(hsFromPointer(-100, 0, 100).h).toBeCloseTo(270)
  })
  it('saturation is the radius ratio, clamped to 100', () => {
    expect(hsFromPointer(0, -50, 100).s).toBeCloseTo(50)
    expect(hsFromPointer(0, -500, 100).s).toBe(100)
    expect(hsFromPointer(0, 0, 100).s).toBe(0)
  })
})

describe('markerPosition', () => {
  it('is the inverse of hsFromPointer', () => {
    const samples = [
      { h: 0, s: 100, v: 100 },
      { h: 90, s: 50, v: 50 },
      { h: 200, s: 75, v: 20 },
      { h: 359, s: 10, v: 90 },
    ]
    for (const hsv of samples) {
      const p = markerPosition(hsv, 100)
      const back = hsFromPointer(p.x - 100, p.y - 100, 100)
      expect(back.h).toBeCloseTo(hsv.h)
      expect(back.s).toBeCloseTo(hsv.s)
    }
  })
  it('hue 0 at full saturation sits at the top', () => {
    const p = markerPosition({ h: 0, s: 100, v: 100 }, 100)
    expect(p.x).toBeCloseTo(100)
    expect(p.y).toBeCloseTo(0)
  })
})

describe('keepHue', () => {
  it('keeps the previous hue for greys and black, otherwise takes the new hue', () => {
    expect(keepHue({ h: 0, s: 0, v: 50 }, { h: 200, s: 80, v: 80 }).h).toBe(200)
    expect(keepHue({ h: 0, s: 50, v: 0 }, { h: 200, s: 80, v: 80 }).h).toBe(200)
    expect(keepHue({ h: 30, s: 50, v: 50 }, { h: 200, s: 80, v: 80 }).h).toBe(30)
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/ui`
Expected: FAIL — `Cannot find module './colorMath'`

- [ ] **Step 3: colorMath 구현**

`src/ui/colorMath.ts`
```ts
import type { Hsv } from '../core/color'

/** 색상환 중심 기준 포인터 위치 → 색상(위쪽 0°, 시계 방향)과 채도(반지름 비율 0..100) */
export function hsFromPointer(dx: number, dy: number, radius: number): { h: number; s: number } {
  const r = radius > 0 ? Math.min(1, Math.hypot(dx, dy) / radius) : 0
  const deg = (Math.atan2(dy, dx) * 180) / Math.PI
  return { h: (deg + 90 + 360) % 360, s: r * 100 }
}

/** 색상환 위 마커 위치 (색상환 좌상단 기준 px) */
export function markerPosition(hsv: Hsv, radius: number): { x: number; y: number } {
  const rad = ((hsv.h - 90) * Math.PI) / 180
  const r = (hsv.s / 100) * radius
  return { x: radius + r * Math.cos(rad), y: radius + r * Math.sin(rad) }
}

/** 채도나 명도가 0이면 색상 정보가 사라지므로 이전 색상을 유지한다 */
export function keepHue(next: Hsv, prev: Hsv): Hsv {
  return next.s < 1e-6 || next.v < 1e-6 ? { ...next, h: prev.h } : next
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/ui`
Expected: PASS (5 tests)

- [ ] **Step 5: ColorWheel 작성**

`src/ui/ColorWheel.tsx`
```tsx
import { useRef } from 'react'
import type { PointerEvent } from 'react'
import type { Hsv } from '../core/color'
import { hsFromPointer, markerPosition } from './colorMath'

interface Props {
  hsv: Hsv
  onChange(hsv: Hsv): void
  size?: number
}

export function ColorWheel({ hsv, onChange, size = 200 }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const radius = size / 2

  const update = (e: PointerEvent<HTMLDivElement>) => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const { h, s } = hsFromPointer(
      e.clientX - (rect.left + rect.width / 2),
      e.clientY - (rect.top + rect.height / 2),
      rect.width / 2,
    )
    onChange({ h, s, v: hsv.v })
  }

  const marker = markerPosition(hsv, radius)
  return (
    <div
      className="wheel"
      ref={ref}
      style={{ width: size, height: size }}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        update(e)
      }}
      onPointerMove={(e) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) update(e)
      }}
      onPointerUp={(e) => e.currentTarget.releasePointerCapture(e.pointerId)}
    >
      <div className="wheel-layer wheel-hue" />
      <div className="wheel-layer wheel-sat" />
      <div className="wheel-layer wheel-dim" style={{ opacity: 1 - hsv.v / 100 }} />
      <div className="wheel-marker" style={{ left: marker.x, top: marker.y }} />
    </div>
  )
}
```

- [ ] **Step 6: ColorInputs 작성**

HEX는 입력 중에는 검증 표시만 하고 blur 또는 Enter에서 확정한다(자릿수를 채우는 동안 값이 바뀌지 않도록). 숫자 필드는 유효 범위 안이면 즉시 반영한다.

`src/ui/ColorInputs.tsx`
```tsx
import { useEffect, useState } from 'react'
import type { Hsl, Hsv, Rgb } from '../core/color'
import { hslToRgb, hsvToRgb, parseHex, rgbToHsl, rgbToHsv, toHex } from '../core/color'
import { keepHue } from './colorMath'

interface Props {
  hsv: Hsv
  onChange(hsv: Hsv): void
}

interface NumberFieldProps {
  label: string
  value: number
  min: number
  max: number
  onCommit(n: number): void
}

function NumberField({ label, value, min, max, onCommit }: NumberFieldProps) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        value={Math.round(value)}
        onChange={(e) => {
          const n = Number(e.target.value)
          if (Number.isFinite(n) && n >= min && n <= max) onCommit(n)
        }}
      />
    </label>
  )
}

export function ColorInputs({ hsv, onChange }: Props) {
  const rgb = hsvToRgb(hsv)
  const hex = toHex(rgb)
  const hsl = rgbToHsl(rgb)
  const [hexText, setHexText] = useState(hex)
  const [hexValid, setHexValid] = useState(true)

  useEffect(() => {
    setHexText(hex)
    setHexValid(true)
  }, [hex])

  const fromRgb = (patch: Partial<Rgb>) => onChange(keepHue(rgbToHsv({ ...rgb, ...patch }), hsv))
  const fromHsl = (patch: Partial<Hsl>) => onChange(keepHue(rgbToHsv(hslToRgb({ ...hsl, ...patch })), hsv))
  const commitHex = () => {
    const p = parseHex(hexText)
    if (p) onChange(keepHue(rgbToHsv(p), hsv))
    else {
      setHexText(hex)
      setHexValid(true)
    }
  }

  return (
    <div className="color-inputs">
      <label className={`field hex${hexValid ? '' : ' invalid'}`}>
        <span>HEX</span>
        <input
          type="text"
          value={hexText}
          spellCheck={false}
          onChange={(e) => {
            setHexText(e.target.value)
            setHexValid(parseHex(e.target.value) !== null)
          }}
          onBlur={commitHex}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitHex()
          }}
        />
      </label>
      <div className="field-row">
        <span className="field-group">RGB</span>
        <NumberField label="R" value={rgb.r} min={0} max={255} onCommit={(n) => fromRgb({ r: n })} />
        <NumberField label="G" value={rgb.g} min={0} max={255} onCommit={(n) => fromRgb({ g: n })} />
        <NumberField label="B" value={rgb.b} min={0} max={255} onCommit={(n) => fromRgb({ b: n })} />
      </div>
      <div className="field-row">
        <span className="field-group">HSL</span>
        <NumberField label="H" value={hsl.h} min={0} max={360} onCommit={(n) => fromHsl({ h: n })} />
        <NumberField label="S" value={hsl.s} min={0} max={100} onCommit={(n) => fromHsl({ s: n })} />
        <NumberField label="L" value={hsl.l} min={0} max={100} onCommit={(n) => fromHsl({ l: n })} />
      </div>
      <div className="field-row">
        <span className="field-group">HSB</span>
        <NumberField label="H" value={hsv.h} min={0} max={360} onCommit={(n) => onChange({ ...hsv, h: n })} />
        <NumberField label="S" value={hsv.s} min={0} max={100} onCommit={(n) => onChange({ ...hsv, s: n })} />
        <NumberField label="B" value={hsv.v} min={0} max={100} onCommit={(n) => onChange({ ...hsv, v: n })} />
      </div>
    </div>
  )
}
```

- [ ] **Step 7: ColorEditor 작성**

`src/ui/ColorEditor.tsx`
```tsx
import type { Hsv } from '../core/color'
import { ColorWheel } from './ColorWheel'
import { ColorInputs } from './ColorInputs'

interface Props {
  hsv: Hsv
  onChange(hsv: Hsv): void
}

export function ColorEditor({ hsv, onChange }: Props) {
  return (
    <div className="color-editor">
      <ColorWheel hsv={hsv} onChange={onChange} />
      <label className="field brightness">
        <span>Brightness</span>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={Math.round(hsv.v)}
          onChange={(e) => onChange({ ...hsv, v: Number(e.target.value) })}
        />
      </label>
      <ColorInputs hsv={hsv} onChange={onChange} />
    </div>
  )
}
```

- [ ] **Step 8: 스타일 추가**

`src/styles.css` 뒤에 추가
```css
/* color editor */
.color-editor { display: flex; flex-direction: column; align-items: center; gap: 10px; padding-top: 8px; }
.wheel { position: relative; border-radius: 50%; overflow: hidden; touch-action: none; cursor: crosshair; user-select: none; }
.wheel-layer { position: absolute; inset: 0; border-radius: 50%; }
.wheel-hue { background: conic-gradient(from 0deg, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00); }
.wheel-sat { background: radial-gradient(circle, #fff 0%, rgba(255, 255, 255, 0) 100%); }
.wheel-dim { background: #000; }
.wheel-marker {
  position: absolute; width: 12px; height: 12px; margin: -6px 0 0 -6px; border-radius: 50%;
  border: 2px solid #fff; box-shadow: 0 0 0 1px #000; pointer-events: none;
}
.field { display: inline-flex; align-items: center; gap: 4px; color: var(--muted); }
.field input[type='number'], .field input[type='text'] {
  background: var(--bg); color: var(--text); border: 1px solid var(--border); border-radius: 4px;
  padding: 3px 5px; font: inherit; width: 56px;
}
.field.hex input { width: 96px; font-family: ui-monospace, Menlo, Consolas, monospace; }
.field.invalid input { border-color: #e63b2e; }
.field.brightness { width: 100%; }
.field.brightness input { flex: 1; accent-color: var(--accent); }
.color-inputs { display: flex; flex-direction: column; gap: 6px; width: 100%; }
.field-row { display: flex; align-items: center; gap: 6px; }
.field-group { width: 32px; color: var(--muted); font-size: 11px; letter-spacing: 0.05em; }
```

- [ ] **Step 9: 검증 후 커밋**

Run: `npm test && npm run lint && npm run build`
Expected: 모두 통과(컴포넌트는 아직 App에 연결되지 않았으므로 화면 변화 없음)

```bash
git add src/ui src/styles.css
git commit -m "feat(ui): 색상환·명도·HEX/RGB/HSL/HSB 입력 색 편집기"
```

---

### Task 19: PalettePanel과 App 연결

**Files:**
- Create: `src/ui/PalettePanel.tsx`
- Modify: `src/App.tsx` (ControlPanel children에 PalettePanel 추가), `src/styles.css` (뒤에 추가)

**Interfaces:**
- Consumes: `ColorEditor` (Task 18); `PRESETS`, `MAX_COLORS`, `MIN_COLORS`, `ensurePaletteLength`, `randomPalette` (core/palettes); `parseHex`, `toHex`, `rgbToHsv`, `hsvToRgb` (core/color)
- Produces:
  ```ts
  export function PalettePanel(props: { palette: string[]; minColors: number; onChange(palette: string[]): void }): JSX.Element
  ```
- 선택 스와치의 `Hsv`는 PalettePanel이 소유한다. 팔레트 hex가 편집기 값과 다르게 바뀌면(프리셋·셔플·스와치 이동·외부 변경) hex에서 다시 계산하고, 편집기 자신이 바꾼 결과면 hue를 보존한다.

- [ ] **Step 1: PalettePanel 작성**

`src/ui/PalettePanel.tsx`
```tsx
import { useEffect, useState } from 'react'
import type { Hsv } from '../core/color'
import { hsvToRgb, parseHex, rgbToHsv, toHex } from '../core/color'
import { MAX_COLORS, MIN_COLORS, PRESETS, ensurePaletteLength, randomPalette } from '../core/palettes'
import { ColorEditor } from './ColorEditor'

interface Props {
  palette: string[]
  minColors: number
  onChange(palette: string[]): void
}

const hsvOf = (hex: string): Hsv => rgbToHsv(parseHex(hex) ?? { r: 0, g: 0, b: 0 })

export function PalettePanel({ palette, minColors, onChange }: Props) {
  const [selected, setSelected] = useState(0)
  const sel = Math.min(selected, palette.length - 1)
  const current = palette[sel]
  const [hsv, setHsv] = useState<Hsv>(() => hsvOf(current))

  // 편집기가 만든 값이 아닌 외부 변경(프리셋, 셔플, 스와치 이동, URL 복원)이면 hex에서 다시 계산한다
  useEffect(() => {
    if (toHex(hsvToRgb(hsv)) !== current) setHsv(hsvOf(current))
  }, [current, sel]) // eslint-disable-line react-hooks/exhaustive-deps

  const minLen = Math.max(minColors, MIN_COLORS)

  const edit = (next: Hsv) => {
    setHsv(next)
    const p = palette.slice()
    p[sel] = toHex(hsvToRgb(next))
    onChange(p)
  }
  const move = (dir: -1 | 1) => {
    const j = sel + dir
    if (j < 0 || j >= palette.length) return
    const p = palette.slice()
    const tmp = p[sel]
    p[sel] = p[j]
    p[j] = tmp
    onChange(p)
    setSelected(j)
  }
  const add = () => {
    if (palette.length >= MAX_COLORS) return
    onChange([...palette, randomPalette(2)[1]])
    setSelected(palette.length)
  }
  const remove = () => {
    if (palette.length <= minLen) return
    onChange(palette.filter((_, i) => i !== sel))
    setSelected(Math.max(0, sel - 1))
  }
  const applyPreset = (name: string) => {
    const preset = PRESETS.find((p) => p.name === name)
    if (!preset) return
    onChange(ensurePaletteLength(preset.colors, minColors))
    setSelected(0)
  }
  const shuffle = () => onChange(randomPalette(palette.length))

  return (
    <section className="panel-section">
      <h2>Palette</h2>
      <div className="swatches">
        {palette.map((c, i) => (
          <button
            key={`${i}-${c}`}
            type="button"
            className={`swatch${i === sel ? ' on' : ''}`}
            style={{ background: c }}
            title={c}
            onClick={() => setSelected(i)}
          >
            {i === 0 ? <span className="swatch-tag">BG</span> : null}
          </button>
        ))}
      </div>
      <div className="palette-tools">
        <button type="button" className="btn" onClick={() => move(-1)} disabled={sel === 0} title="Move left">◀</button>
        <button type="button" className="btn" onClick={() => move(1)} disabled={sel === palette.length - 1} title="Move right">▶</button>
        <button type="button" className="btn" onClick={add} disabled={palette.length >= MAX_COLORS} title="Add color">+</button>
        <button type="button" className="btn" onClick={remove} disabled={palette.length <= minLen} title="Remove color">−</button>
        <div className="spacer" />
        <select className="select" value="" onChange={(e) => applyPreset(e.target.value)} aria-label="Preset palette">
          <option value="" disabled>Preset…</option>
          {PRESETS.map((p) => (
            <option key={p.name} value={p.name}>{p.name}</option>
          ))}
        </select>
        <button type="button" className="btn" onClick={shuffle}>Shuffle</button>
      </div>
      <ColorEditor hsv={hsv} onChange={edit} />
    </section>
  )
}
```

- [ ] **Step 2: App에 연결**

`src/App.tsx` — import 추가 후 `<ControlPanel ...>`를 children이 있는 형태로 바꾼다.
```tsx
import { PalettePanel } from './ui/PalettePanel'
// ...
        <ControlPanel generator={generator} params={pattern.params} onParamChange={setParam} scene={scene} tilePx={tilePx}>
          <PalettePanel
            palette={pattern.palette}
            minColors={generator.minColors}
            onChange={(palette) => setPattern((p) => ({ ...p, palette }))}
          />
        </ControlPanel>
```

- [ ] **Step 3: 스타일 추가**

`src/styles.css` 뒤에 추가
```css
/* palette */
.swatches { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 8px; }
.swatch {
  position: relative; width: 30px; height: 30px; border-radius: 4px; border: 2px solid transparent;
  cursor: pointer; padding: 0; box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.15);
}
.swatch.on { border-color: var(--text); }
.swatch-tag {
  position: absolute; left: 0; right: 0; bottom: -1px; font-size: 9px; font-weight: 700; text-align: center;
  color: #fff; text-shadow: 0 0 2px #000, 0 0 2px #000;
}
.palette-tools { display: flex; align-items: center; gap: 4px; margin-bottom: 4px; }
.palette-tools .btn { padding: 3px 7px; }
.palette-tools .btn:disabled { opacity: 0.35; cursor: default; border-color: var(--border); }
.palette-tools .select { max-width: 110px; }
```

- [ ] **Step 4: 검증**

Run: `npm test && npm run lint && npm run build`
Expected: 모두 통과. oxlint가 `eslint-disable-line` 주석을 모르면 경고 없이 무시하며, 만약 "unused directive"류 경고가 나오면 그 주석 줄 끝의 `// eslint-disable-line ...`을 삭제한다.

브라우저(`npm run dev`) 확인 항목:
1. Palette 섹션에 스와치가 보이고 첫 스와치에 BG 표시가 있다.
2. 스와치를 클릭하면 색상환 마커와 HEX/RGB/HSL/HSB 값이 그 색으로 바뀐다.
3. 색상환을 드래그하면 미리보기 패턴 색이 실시간으로 바뀌고, 명도 슬라이더를 0까지 내린 뒤 다시 올려도 색상(마커 각도)이 유지된다.
4. HEX에 `#1e6fe6`를 입력하고 Enter → 다른 필드가 동기화된다. `#zz`를 입력하면 빨간 테두리가 보이고 blur 시 원래 값으로 돌아간다.
5. RGB의 R 값을 바꾸면 패턴과 색상환이 즉시 따라온다.
6. Preset에서 Walala를 고르면 팔레트가 바뀌고 Shuffle을 누르면 무작위 팔레트가 나온다. Iso Cubes(minColors 4)에서 −가 3색에서 비활성화된다.
7. ◀ ▶로 BG 색과 첫 전경색을 바꾸면 패턴 배경이 바뀐다.
8. Copy link 후 새 탭에 붙여 넣으면 같은 팔레트가 복원된다.

- [ ] **Step 5: 커밋**

```bash
git add src/ui/PalettePanel.tsx src/App.tsx src/styles.css
git commit -m "feat(ui): 팔레트 패널 — 스와치, 프리셋, 셔플, 색 편집기 연결"
```

---

### Task 20: 내보내기 — renderForExport, exportImage, ExportDialog

**Files:**
- Modify: `src/render/export.ts` (함수 추가), `src/App.tsx` (대화상자 상태·연결), `src/styles.css` (뒤에 추가)
- Create: `src/ui/ExportDialog.tsx`
- Test: `src/render/export.test.ts` (테스트 추가)

**Interfaces:**
- Produces (render/export.ts에 추가):
  ```ts
  export function renderForExport(scene: Scene, settings: ExportSettings): HTMLCanvasElement   // 크기 초과 시 throw
  export function canvasToBlob(canvas: HTMLCanvasElement, format: ExportFormat): Promise<Blob>
  export function downloadBlob(blob: Blob, filename: string): void
  export async function exportImage(scene: Scene, generator: string, seed: number, settings: ExportSettings): Promise<void>
  ```
  ```ts
  // ui/ExportDialog.tsx
  export function ExportDialog(props: { open: boolean; scene: Scene; generator: string; seed: number; previewScale: number; onClose(): void }): JSX.Element | null
  ```

- [ ] **Step 1: 테스트 추가**

`src/render/export.test.ts` 끝에 추가
```ts
import { renderForExport } from './export'

describe('renderForExport (node: DOM 없음)', () => {
  it('throws before touching the DOM when the size exceeds the limit', () => {
    expect(() =>
      renderForExport(scene, { format: 'png', mode: 'canvas', scale: 1, width: MAX_DIM + 1, height: 100 }),
    ).toThrow(/8192/)
  })
})
```
(파일 상단의 기존 import 문에 `renderForExport`를 합쳐도 된다. `scene`과 `MAX_DIM`은 이미 그 파일에 있다.)

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/render`
Expected: FAIL — `renderForExport is not a function` 또는 import 오류

- [ ] **Step 3: export.ts에 함수 추가**

`src/render/export.ts` 상단 import를 다음으로 바꾸고, 파일 끝에 함수를 추가한다.
```ts
import type { Scene } from '../core/scene'
import type { TilePx } from './canvas'
import { renderFill, renderTile, tilePixelSize } from './canvas'
```
```ts
/** 설정대로 오프스크린 캔버스에 렌더한다. 크기 상한을 넘으면 DOM을 만들기 전에 throw */
export function renderForExport(scene: Scene, settings: ExportSettings): HTMLCanvasElement {
  const size = outputSize(scene, settings)
  if (exceedsLimit(size)) throw new Error(`Output size ${size.w} × ${size.h} exceeds the ${MAX_DIM}px limit`)
  const canvas = document.createElement('canvas')
  canvas.width = size.w
  canvas.height = size.h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2D canvas context is unavailable')
  if (settings.mode === 'tile') renderTile(scene, size, ctx)
  else renderFill(scene, tilePixelSize(scene, settings.scale), ctx, size.w, size.h)
  return canvas
}

export function canvasToBlob(canvas: HTMLCanvasElement, format: ExportFormat): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Encoding failed'))), mimeOf(format), 0.92)
  })
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function exportImage(scene: Scene, generator: string, seed: number, settings: ExportSettings): Promise<void> {
  const canvas = renderForExport(scene, settings)
  const blob = await canvasToBlob(canvas, settings.format)
  downloadBlob(blob, exportFilename(generator, seed, settings.format))
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/render`
Expected: PASS

- [ ] **Step 5: ExportDialog 작성**

`src/ui/ExportDialog.tsx`
```tsx
import { useState } from 'react'
import type { Scene } from '../core/scene'
import type { ExportFormat, ExportMode, ExportSettings } from '../render/export'
import { MAX_DIM, SIZE_PRESETS, exceedsLimit, exportImage, outputSize } from '../render/export'

interface Props {
  open: boolean
  scene: Scene
  generator: string
  seed: number
  previewScale: number
  onClose(): void
}

export function ExportDialog({ open, scene, generator, seed, previewScale, onClose }: Props) {
  const [format, setFormat] = useState<ExportFormat>('png')
  const [mode, setMode] = useState<ExportMode>('tile')
  const [scale, setScale] = useState(2)
  const [preset, setPreset] = useState(0) // SIZE_PRESETS 인덱스, -1 = custom
  const [width, setWidth] = useState(SIZE_PRESETS[0].w)
  const [height, setHeight] = useState(SIZE_PRESETS[0].h)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!open) return null

  const settings: ExportSettings = { format, mode, scale: mode === 'tile' ? scale : previewScale, width, height }
  const size = outputSize(scene, settings)
  const tooBig = exceedsLimit(size)

  const run = async () => {
    setBusy(true)
    setError(null)
    try {
      await exportImage(scene, generator, seed, settings)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const numberInput = (value: number, set: (n: number) => void) => (
    <input
      type="number"
      min={1}
      max={MAX_DIM}
      value={value}
      onChange={(e) => {
        const n = Number(e.target.value)
        if (Number.isFinite(n)) {
          set(Math.round(n))
          setPreset(-1)
        }
      }}
    />
  )

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-label="Export" onClick={(e) => e.stopPropagation()}>
        <h2>Export</h2>

        <div className="control">
          <span className="control-label">Format</span>
          <div className="segmented">
            <button type="button" className={format === 'png' ? 'on' : ''} onClick={() => setFormat('png')}>PNG</button>
            <button type="button" className={format === 'jpg' ? 'on' : ''} onClick={() => setFormat('jpg')}>JPG</button>
          </div>
        </div>

        <div className="control">
          <span className="control-label">Mode</span>
          <div className="segmented">
            <button type="button" className={mode === 'tile' ? 'on' : ''} onClick={() => setMode('tile')}>Single tile</button>
            <button type="button" className={mode === 'canvas' ? 'on' : ''} onClick={() => setMode('canvas')}>Canvas</button>
          </div>
        </div>

        {mode === 'tile' ? (
          <label className="control">
            <span className="control-label">Scale (px per unit)</span>
            <input
              className="num"
              type="number"
              min={0.1}
              max={64}
              step={0.5}
              value={scale}
              onChange={(e) => {
                const n = Number(e.target.value)
                if (Number.isFinite(n) && n > 0) setScale(n)
              }}
            />
          </label>
        ) : (
          <>
            <label className="control">
              <span className="control-label">Size preset</span>
              <select
                value={preset}
                onChange={(e) => {
                  const i = Number(e.target.value)
                  setPreset(i)
                  if (i >= 0) {
                    setWidth(SIZE_PRESETS[i].w)
                    setHeight(SIZE_PRESETS[i].h)
                  }
                }}
              >
                {SIZE_PRESETS.map((p, i) => (
                  <option key={p.label} value={i}>{p.label}</option>
                ))}
                <option value={-1}>Custom</option>
              </select>
            </label>
            <div className="control size-row">
              <label className="field"><span>W</span>{numberInput(width, setWidth)}</label>
              <label className="field"><span>H</span>{numberInput(height, setHeight)}</label>
            </div>
            <div className="info">Tile scale follows the preview: {previewScale.toFixed(2)}× ({Math.round(scene.width * previewScale)} × {Math.round(scene.height * previewScale)} px per tile)</div>
          </>
        )}

        <div className={`info${tooBig ? ' error' : ''}`}>
          Output: {size.w} × {size.h} px{tooBig ? ` — exceeds the ${MAX_DIM}px limit` : ''}
        </div>
        {error ? <div className="info error">{error}</div> : null}

        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="button" className="btn primary" disabled={tooBig || busy} onClick={run}>
            {busy ? 'Exporting…' : `Export ${format.toUpperCase()}`}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: App 연결**

`src/App.tsx`
```tsx
import { ExportDialog } from './ui/ExportDialog'
// 상태 추가 (다른 useState 옆)
const [exportOpen, setExportOpen] = useState(false)
// TopBar: onExport={() => setExportOpen(true)}
// JSX 맨 끝, </div> 닫기 직전에 추가
<ExportDialog
  open={exportOpen}
  scene={scene}
  generator={pattern.generator}
  seed={pattern.seed}
  previewScale={scale}
  onClose={() => setExportOpen(false)}
/>
```

- [ ] **Step 7: 스타일 추가**

`src/styles.css` 뒤에 추가
```css
/* export dialog */
.modal-backdrop {
  position: fixed; inset: 0; background: rgba(0, 0, 0, 0.6); display: flex; align-items: center; justify-content: center; z-index: 10;
}
.modal {
  width: 380px; background: var(--panel); border: 1px solid var(--border); border-radius: 8px; padding: 16px 18px 14px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
}
.modal h2 { margin: 0 0 14px; font-size: 15px; }
.modal .control { margin-bottom: 12px; }
.modal .size-row { display: flex; gap: 12px; }
.modal .size-row .field input { width: 90px; }
.modal-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }
.info.error { color: #ff6b5e; }
```

- [ ] **Step 8: 검증**

Run: `npm test && npm run lint && npm run build`
Expected: 모두 통과

브라우저 확인 항목:
1. Export 버튼 → 대화상자가 열리고 배경 클릭 또는 Cancel로 닫힌다.
2. Single tile, PNG, Scale 2 → Export → `jacquard-<generator>-<seed>.png`가 내려받아지고 크기가 표시된 Output과 같다(이미지 뷰어로 확인).
3. Canvas, 1920 × 1080, JPG → 파일이 내려받아지고 배경이 채워져 있다(투명 아님).
4. Custom W 9000 → Output에 초과 경고가 보이고 Export 버튼이 비활성화된다.
5. Iso Cubes처럼 폴리곤 생성기를 Canvas 모드로 내보낸 결과를 확대해 타일 경계에 선이 없는지 본다.

- [ ] **Step 9: 커밋·푸시**

```bash
git add src/render src/ui/ExportDialog.tsx src/App.tsx src/styles.css
git commit -m "feat(export): PNG/JPG 내보내기 대화상자 — 타일/캔버스 모드, 크기 프리셋, 8192px 상한"
git push origin main
```

---

### Task 21: 스크린샷, Cloudflare Pages 배포, README, GitHub About

**Files:**
- Modify: `package.json` (`deploy` 스크립트 추가), `index.html` (필요 시 description 보정)
- Create: `docs/screenshots/hero.png` 외 생성기별 스크린샷 갱신, `README.md`

**Interfaces:**
- Consumes: 완성된 앱 전체
- Produces: 배포 URL(README·About·설계서 9절에 기록), 한·영 README

- [ ] **Step 1: 최종 스크린샷**

`npm run dev` 상태에서 브라우저 자동화 도구로 다음을 캡처해 `docs/screenshots/`에 저장한다(창 크기 1440 × 900 권장).
- `hero.png`: Gradient Bars + Boogie 프리셋, Fill 뷰, 패널 포함 전체 화면
- `01-stripes.png` ~ `08-triangles.png`: 각 생성기에 어울리는 프리셋(stripes: Poppy Field, plaid: Underground, zigzag: Missoni Blue, motif: Bauhaus, rings: Walala, gradientBars: Candy Weave, isoCubes: Neon Op, triangles: Neon Op)을 적용한 Fill 뷰. 1부·2부에서 찍은 같은 이름의 파일은 덮어쓴다.
- `export-dialog.png`: Export 대화상자가 열린 화면

자동화 도구가 없으면 여기서 멈추고 황보정님께 수동 캡처를 요청한다. 스크린샷 없이 README를 쓰지 않는다.

- [ ] **Step 2: deploy 스크립트 추가**

`package.json`의 `scripts`에 추가
```json
    "deploy": "npm run build && npx wrangler pages deploy dist --project-name=jacquard --branch=main"
```

- [ ] **Step 3: 빌드와 배포 전 확인**

Run: `npm test && npm run lint && npm run build`
Expected: 모두 통과, `dist/` 갱신

Run: `npx wrangler whoami`
Expected: 로그인된 계정과 Account ID가 출력된다. "You are not authenticated"가 나오면 **멈추고** 황보정님께 터미널에서 `npx wrangler login`을 실행해 달라고 요청한 뒤, 완료 답을 받고 다시 확인한다.

**사용자 확인(필수):** 배포는 외부 URL을 만드는 작업이다. "jacquard 프로젝트로 Cloudflare Pages에 배포하겠습니다. 진행할까요?"라고 묻고 명시적 승인을 받은 뒤 Step 4로 간다.

- [ ] **Step 4: Cloudflare Pages 프로젝트 생성·배포**

Run: `npx wrangler pages project list`
Expected: 프로젝트 목록. `jacquard`가 없으면 생성한다:

Run: `npx wrangler pages project create jacquard --production-branch main`
Expected: "Successfully created the 'jacquard' project". 이름이 이미 다른 계정에 있어 실패하면 `jacquard-patterns`로 재시도하고, 이후 모든 `--project-name`과 `deploy` 스크립트를 그 이름으로 바꾼다.

Run: `npm run deploy`
Expected: 업로드 후 `https://<project>.pages.dev` 형태의 URL이 출력된다. 브라우저로 열어 8종 생성기와 Export가 동작하는지 확인한다(로컬과 동일해야 한다).

- [ ] **Step 5: README와 About**

REQUIRED SUB-SKILL: `presenting-github-repo` 스킬을 호출하고 그 절차대로 README·About을 작성한다. 스킬이 요구하는 항목에 더해 README에 반드시 들어가야 하는 내용:
- 한 줄 소개(한·영): 브라우저용 파라메트릭 패턴 제조기, 텍스타일·타일·그래픽 디자인용 반복 타일 생성
- `docs/screenshots/hero.png`와 생성기 8종 스크린샷 그리드
- 배포 URL(Step 4 결과) — 라이브 데모 링크
- 기능: 생성기 8종(계열별), 시드 결정성, 팔레트 편집(색상환·HEX/RGB/HSL/HSB), 프리셋, 미리보기 3모드, PNG/JPG 내보내기(타일/캔버스, 8192px), URL 공유
- 사용법: `npm install`, `npm run dev`, `npm test`, `npm run build`, `npm run deploy`
- 아키텍처 한 단락: 생성기 → Scene IR → Canvas. SVG 내보내기는 v2 예정이라고만 적는다(유료화 언급은 하지 않는다)
- 라이선스: MIT

About: `gh repo edit dostevskii/jacquard --description "Parametric seamless pattern generator for textile, tile and graphic design" --homepage "<배포 URL>" --add-topic pattern-generator --add-topic generative-design --add-topic textile --add-topic canvas --add-topic react --add-topic typescript`

- [ ] **Step 6: 설계서에 배포 URL 기록 후 커밋·푸시**

`docs/superpowers/specs/2026-09-16-jacquard-design.md` 9절 마지막 항목 아래에 한 줄 추가: `- 프로덕션 URL: <배포 URL> (2026-MM-DD 배포)`

```bash
git add -A
git commit -m "docs: README(한·영), 스크린샷, deploy 스크립트, 배포 URL 기록"
git push origin main
```

- [ ] **Step 7: 완료 보고**

황보정님께 다음을 보고한다: 배포 URL, 저장소 URL, 테스트 개수와 통과 여부, 스크린샷 위치, 남은 v2 항목(SVG 내보내기, 그레인, 실행 취소, 모바일 레이아웃).

---

## 자체 검토 결과 (계획 작성자)

- 설계서 6.2(색상환: 각도=H, 반지름=S, CSS 그라데이션, 명도 오버레이, 4종 숫자 입력 동기화, 회색에서 H 보존) → Task 18. 6.3(스와치, BG 표시, 이동·추가·삭제, 프리셋, 셔플) → Task 19. 4.6(PNG/JPG, 타일/캔버스, 프리셋 5종 + 직접 입력, 8192 상한, 파일명) → Task 20. 9절 7단계(스크린샷, 배포, README, About) → Task 21.
- 설계서 6.3의 셔플 규칙(황금각·채도 55..85·명도 35..90·배경 밝거나 어둡게)은 1부 `randomPalette`에 이미 구현되어 있어 여기서는 호출만 한다.
- 타입 일관성: `ExportSettings`, `outputSize`, `exceedsLimit`, `exportFilename`, `mimeOf`, `MAX_DIM`, `SIZE_PRESETS`는 1부 Task 9의 이름과 같다. `renderFill`의 `origin` 인자는 내보내기에서 쓰지 않는다.
- 배포는 사용자 확인 게이트를 두었고, 로그인 부재 시 멈추도록 했다.
