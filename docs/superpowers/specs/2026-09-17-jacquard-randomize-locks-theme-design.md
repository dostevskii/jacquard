# Jacquard v1.1 — 전역/개별 랜덤, 잠금, 라이트 테마 설계서

- 작성일: 2026-09-17
- 상태: 승인됨 (황보정님, 2026-09-17). 잠금의 URL 저장은 "세션만" → "URL에도 저장"으로 번복 확정.
- 선행 설계서: `2026-09-16-jacquard-design.md` (v1). 이 문서는 v1 설계서의 §4.7(URL 상태), §6.3(팔레트 패널의 Shuffle), §7.1~7.2(상단 바·테마·주사위)를 갱신한다. 충돌 시 이 문서가 우선한다.
- 역할 분담: 설계·계획 Fable, 구현 Opus(서브에이전트), 리뷰 Sonnet/Opus — v1과 동일.

## 1. 목적

황보정님이 지시한 여섯 항목을 그대로 구현한다.

1. 상단 주사위가 효과 없는 생성기가 있다. 원인: 주사위는 `seed`만 바꾸는데 stripes(Sequence)·zigzag(Sequence)·gradientBars(Pairs)·isoCubes(Shuffle 꺼짐)·triangles(Random 외 규칙)는 기본 설정에서 시드를 쓰지 않고, 팔레트·매개변수는 주사위와 연결되어 있지 않다. → 주사위가 시드·매개변수·팔레트 전부에 무작위 값을 넣는다.
2. 라이트 테마를 만들고 기본값으로 지정한다. 다크 테마는 토글로 유지한다.
3. 사용자가 한 번이라도 손댄 변수(슬라이더·선택·토글·시드·팔레트)는 자동으로 잠기고, 전역 주사위는 잠긴 변수에 무작위 값을 넣지 않는다.
4. 사용자가 조작할 수 있는 모든 항목에 자물쇠 아이콘을 두어 수동으로 잠그고 풀 수 있다.
5. 각 개별 변수마다 그 변수만 무작위로 정하는 버튼을 둔다.
6. 상단 주사위는 전역 설정이고 개별 설정이 우선한다. 잠긴 개별 설정은 전역 설정이 임의로 조정하지 않는다.

## 2. 범위

포함: 잠금 상태 모델과 URL 저장, 무작위 규칙 순수 함수, 매개변수·시드·팔레트의 잠금/개별 랜덤 UI, 전역 Randomize 버튼, 라이트 테마와 토글, 테스트, 스크린샷·README 갱신, 재배포.

제외: 생성기 자체를 무작위로 바꾸는 기능(생성기는 사용자가 고르는 모드), 미리보기 배율·뷰 모드의 무작위화, OS `prefers-color-scheme` 따르기(기본은 항상 라이트), 실행 취소.

## 3. 상태 모델

### 3.1 잠금 상태

```ts
// core/locks.ts
export interface LockState {
  seed: boolean
  params: string[]     // 잠긴 매개변수 키 (현재 생성기의 키만)
  palette: number[]    // 잠긴 스와치 인덱스 (오름차순, 중복 없음)
}
export function emptyLocks(): LockState      // 항상 새 객체 { seed: false, params: [], palette: [] } (공유 참조 방지)

export function lockParam(l: LockState, key: string): LockState
export function toggleParamLock(l: LockState, key: string): LockState
export function clearParamLocks(l: LockState): LockState
export function toggleSeedLock(l: LockState): LockState
export function lockSwatch(l: LockState, i: number): LockState
export function toggleSwatchLock(l: LockState, i: number): LockState
export function lockAllSwatches(l: LockState, count: number): LockState
export function swatchLocksAfterSwap(l: LockState, i: number, j: number): LockState   // 스와치 이동
export function swatchLocksAfterRemove(l: LockState, i: number): LockState            // i 삭제, 뒤 인덱스 −1
export function clampSwatchLocks(l: LockState, count: number): LockState               // count 이상 인덱스 제거
export function normalizeLocks(input: unknown, paramKeys: readonly string[], paletteLength: number): LockState
```

모든 함수는 새 객체를 돌려주는 순수 함수다. `params`는 삽입 순서를 유지하고 중복을 넣지 않는다.

### 3.2 PatternState

```ts
export interface PatternState {
  generator: string
  seed: number
  params: Params
  palette: string[]
  locks: LockState      // 추가
}
```

- `encodeState`는 `locks`를 그대로 포함한다(항상 기록).
- `decodeState`는 `locks`가 없거나 깨졌으면 `EMPTY_LOCKS`로 복원하고, 있으면 `normalizeLocks`로 정리한다: `seed`는 boolean만, `params`는 해당 생성기의 키만, `palette`는 `0..palette.length-1` 정수만(중복 제거·정렬).
- 생성기 변경(`selectGenerator`): 매개변수 기본값으로 초기화 + `clearParamLocks`. 시드·팔레트 잠금은 유지하되 `clampSwatchLocks(팔레트 길이)`.
- 잠금은 값을 바꾸지 않는다. 잠긴 항목도 사용자가 직접 수정할 수 있다.

## 4. 무작위 규칙 (`core/random.ts`, 순수 함수)

```ts
export function randomParamValue(def: ParamDef, rng: Rng): ParamValue
export function randomizeParams(defs: ParamDef[], params: Params, locked: readonly string[], rng: Rng): Params
export function randomSwatch(index: number, rng: Rng): string
export function randomizePalette(palette: string[], locked: readonly number[], rng: Rng): string[]
export function randomizeAll(state: PatternState, defs: ParamDef[], rng: Rng): PatternState
```

- `randomParamValue`: range는 `steps = round((max − min) / step)`, `k = rng.int(0, steps)`, `snapValue(def, min + k·step)`. select는 `rng.pick(options).value`. toggle은 `rng.next() < 0.5`.
- `randomizeParams`: `locked`에 없는 키만 `randomParamValue`로 교체. 순서는 `defs` 순서로 rng를 소비한다(결정성).
- `randomSwatch(index)`: `randomPalette(2, () => rng.next())`를 만들어 `index === 0`이면 `[0]`(배경형: 아주 밝거나 어두운 색), 아니면 `[1]`(전경형: 채도 55..85, 명도 35..90).
- `randomizePalette`: `fresh = randomPalette(palette.length, () => rng.next())`를 만든 뒤 잠긴 인덱스는 기존 색을 유지한다. 길이는 바뀌지 않는다.
- `randomizeAll`: `locks.seed`가 false면 `seed = rng.int(0, MAX_SEED)`, 그다음 `randomizeParams`, 그다음 `randomizePalette`. `generator`와 `locks`는 그대로.
- 무작위 원천: UI가 버튼을 누를 때마다 `mulberry32(randomSeed())`를 만들어 넘긴다. 결과는 매번 다르지만 함수는 rng가 주어지면 결정적이라 테스트할 수 있다.

## 5. 잠금 규칙

| 조작 | 잠금 변화 |
|---|---|
| 슬라이더·숫자 입력·선택·토글로 매개변수 변경 | 그 매개변수 잠김 |
| 시드 입력 확정(blur/Enter) | 시드 잠김 |
| 색 편집기(색상환·명도·HEX/RGB/HSL/HSB)로 색 변경 | 선택 스와치 잠김 |
| 프리셋 적용 | 팔레트 전체 잠김 |
| 스와치 추가(+) | 새 스와치는 잠기지 않음 |
| 스와치 삭제(−) / 이동(◀ ▶) | 잠금 인덱스만 함께 이동·조정 |
| 개별 🎲 (매개변수·시드·선택 스와치) | 잠금 변화 없음. 잠겨 있어도 동작 |
| Randomize palette (구 Shuffle) | 잠기지 않은 스와치만 교체, 잠금 변화 없음 |
| 전역 Randomize | 잠기지 않은 시드·매개변수·스와치만 교체, 잠금 변화 없음 |
| 자물쇠 아이콘 클릭 | 해당 항목 잠금 토글 |
| 생성기 변경 | 매개변수 잠금 초기화, 시드·팔레트 잠금 유지 |

원칙: 개별 설정(잠금, 개별 🎲)이 전역 설정보다 우선한다. 개별 🎲는 "이 값은 무작위로 해 달라"는 요청이므로 자동 잠금을 걸지 않는다.

## 6. UI

### 6.1 공통 아이콘 버튼

- `ui/LockButton.tsx`: 닫힌/열린 자물쇠 인라인 SVG(16px). 잠기면 `--accent` 색, 아니면 `--muted`. `title`은 잠김 "Locked — Randomize leaves this alone. Click to unlock." / 열림 "Unlocked — Randomize may change this. Click to lock.". `aria-pressed`로 상태 표시.
- `ui/DiceButton.tsx`: 주사위 인라인 SVG(16px). `title` "Randomize this value".
- 이모지는 쓰지 않는다(헤드리스·플랫폼 폰트 차이).

### 6.2 매개변수 컨트롤 (`ParamControl`)

라벨 줄을 `.control-head`(flex)로 바꾼다: `[라벨] [spacer] [🎲] [🔒]`. 그 아래에 기존 입력(슬라이더+숫자 / 세그먼트·select / 체크박스는 head 줄 맨 오른쪽). 잠긴 컨트롤은 라벨 옆 자물쇠가 강조색으로 표시되고 `.control.locked` 클래스가 붙는다. props 추가: `locked: boolean`, `onToggleLock(): void`, `onRandomize(): void`. 값 변경 콜백은 그대로 `onChange`이며 잠금 부여는 App이 한다.

### 6.3 상단 바 (`TopBar`)

`Jacquard │ [Generator ▾] │ Seed [______] 🎲 🔒 │ [🎲 Randomize] │ … │ [☀/☾] │ Copy link │ Export`

- 시드 옆 🎲는 시드만, 🔒는 시드 잠금.
- `Randomize` 버튼(주사위 아이콘 + 글자)이 전역. title "Randomize everything that is not locked".
- 테마 토글은 해/달 아이콘 버튼, title "Switch to dark/light theme".

### 6.4 팔레트 패널 (`PalettePanel`)

- 각 스와치 오른쪽 위에 작은 자물쇠 배지. 클릭하면 그 스와치 잠금 토글(스와치 선택 클릭과 분리: `stopPropagation`). 잠긴 스와치는 배지가 강조색, 열린 스와치는 배지가 흐리게 hover 시에만 보인다.
- 도구 줄: `◀ ▶ + −  [🎲 swatch]  [Preset…]  [Randomize colors]`. `🎲 swatch`는 선택 스와치만 `randomSwatch`. `Randomize colors`(구 Shuffle)는 잠기지 않은 스와치 전부 `randomizePalette`. 상단 바의 전역 `Randomize`와 글자를 다르게 해 혼동을 막는다.
- props: `{ palette, locks: number[], minColors, onChange(palette: string[], locks: number[]): void }`. 패널이 `core/locks.ts` 헬퍼로 잠금 변화를 계산해 값과 함께 넘긴다(편집 → `lockSwatch`, 프리셋 → `lockAllSwatches`, 이동 → `swatchLocksAfterSwap`, 삭제 → `swatchLocksAfterRemove`).

### 6.5 App 연결

- `setParam(key, value)`는 값 갱신 + `lockParam`. `randomizeParam(key)`는 `randomParamValue`로 값만 갱신. `toggleParamLock(key)`.
- `setSeed(n)`은 값 + 시드 잠금. `randomizeSeed()`는 값만. `toggleSeedLock()`.
- `randomizeAll()`은 `core/random.ts`의 `randomizeAll(state, generator.params, mulberry32(randomSeed()))`.
- 상태 갱신은 모두 `setPattern(p => …)` 형태의 불변 갱신.

## 7. 라이트 테마

### 7.1 변수

```css
:root {                     /* 기본 = 라이트 */
  color-scheme: light;
  --bg: #f3f3f1; --panel: #ffffff; --border: #d9d9d6; --text: #1a1a1a; --muted: #6a6a6a;
  --accent: #2b6cd9; --on-accent: #ffffff; --canvas-bg: #e4e4e1; --danger: #c62828;
}
:root[data-theme='dark'] {
  color-scheme: dark;
  --bg: #141414; --panel: #1d1d1d; --border: #2c2c2c; --text: #ececec; --muted: #9a9a9a;
  --accent: #6aa9dc; --on-accent: #0c0c0c; --canvas-bg: #0c0c0c; --danger: #ff6b5e;
}
```

- 하드코딩 색 교체: 강조 버튼·세그먼트 선택 글자색 `#0c0c0c` → `var(--on-accent)`; `.invalid` 테두리·`.info.error` → `var(--danger)`; Preview 캔버스 바탕 `#0c0c0c`과 안내 문구 `#9a9a9a` → 그리기 시점에 `getComputedStyle(document.documentElement).getPropertyValue('--canvas-bg' | '--muted')`.
- 색상환 레이어, 스와치 BG 태그(흰 글자+검은 그림자), 모달 배경(반투명 검정)은 두 테마 공통.
- 3×3 뷰 점선은 라이트에서 `rgba(0,0,0,0.6)`, 다크에서 `rgba(255,255,255,0.75)` — `--grid-line` 변수로 둔다.

### 7.2 동작

- `ui/theme.ts`: `type Theme = 'light' | 'dark'`, `loadTheme(): Theme`(localStorage `jacquard-theme`가 'dark'면 dark, 그 외 light), `applyTheme(t)`(`document.documentElement.dataset.theme = t`, localStorage 저장). OS 설정은 보지 않는다.
- App이 `theme` 상태를 들고 첫 렌더 전에 `applyTheme(loadTheme())`를 호출한다(깜빡임 방지를 위해 `main.tsx`에서 렌더 전에 한 번 더 적용).
- 테마는 URL 상태에 넣지 않는다.

## 8. 검증

| 대상 | 테스트 |
|---|---|
| `core/locks.ts` | 각 헬퍼의 불변성(입력 미변경), 중복 방지, swap/remove 인덱스 이동, clamp, `normalizeLocks`의 잘못된 입력 처리 |
| `core/random.ts` | range 값이 min..max 안이고 step에 스냅됨(1000회), select 값이 옵션 안, toggle 두 값 모두 등장, 잠긴 키·인덱스 불변, 잠기지 않은 항목은 시드가 다르면 달라짐, 같은 rng 시드 → 같은 결과, `randomizeAll`이 잠긴 시드를 유지, 팔레트 길이 유지 |
| `core/state.ts` | locks 왕복, locks 없는 구 URL → EMPTY_LOCKS, 생성기에 없는 키·범위 밖 인덱스 제거 |
| `ui/theme.ts` | localStorage 없음 → light, 'dark' → dark, 잘못된 값 → light (localStorage는 테스트에서 간단한 객체로 주입) |
| 브라우저(Playwright) | (1) 8종 모두 Randomize 3회 → 캔버스 지문이 매번 바뀜 (2) 새 프로필에서 라이트가 기본, 토글 → 다크, 새로고침 유지 (3) 슬라이더 조작 → 자물쇠 켜짐 → Randomize 후 그 값 유지 (4) 손대지 않은 항목 수동 잠금 → 유지, 풀면 바뀜 (5) 개별 🎲 → 그 값만 바뀌고 잠기지 않음 (6) 프리셋 적용 → 스와치 전부 잠김 → Randomize 후 색 유지, 한 스와치 풀면 그것만 바뀜 (7) 시드 입력 → 시드 잠김 → Randomize 후 시드 유지 (8) Copy link 후 새 탭에서 잠금 복원 |

스크린샷 11장은 라이트 테마로 재촬영하고 README의 기능·조작 표에 Randomize·잠금·테마를 추가한다.

## 9. 구현 순서

1. `core/locks.ts` + `core/random.ts` + `state.ts` locks 통합 (테스트 먼저) → 커밋
2. 아이콘 버튼 2종 + `ParamControl` head 줄 + `ControlPanel`/App 연결(매개변수 잠금·개별 🎲·자동 잠금) → 커밋
3. `TopBar`: 시드 🎲/🔒, 전역 Randomize, `randomizeAll` 연결 → 커밋
4. `PalettePanel`: 스와치 잠금 배지, 선택 스와치 🎲, Randomize palette, 자동 잠금 → 커밋
5. 라이트 테마 변수·토글·`theme.ts`·Preview 변수 읽기 → 커밋
6. Playwright 시나리오 8종, 스크린샷 재촬영, README 갱신, 재배포 → 커밋·푸시

## 10. 결정 기록

| 결정 | 대안 | 이유 |
|---|---|---|
| 잠금을 URL 상태에 저장 | 세션에서만 유지 | 황보정님 번복 확정. 새로고침·공유 시 잠금이 유지되어야 "지정한 개별 설정"이 살아남는다 |
| 프리셋 적용 시 팔레트 전체 자동 잠금 | 잠그지 않음 | 프리셋 선택은 색을 고른 명시적 행위(황보정님 선택) |
| 개별 🎲는 자동 잠금 없음 | 잠금 | 무작위를 요청한 것이지 값을 고른 것이 아니다 |
| 잠겨도 직접 수정 가능 | 잠기면 비활성 | 잠금은 "전역 Randomize가 건드리지 않음"의 의미. 비활성화하면 값을 바꾸려 할 때마다 풀어야 해 번거롭다 |
| 생성기 변경 시 매개변수 잠금 초기화 | 키가 같으면 유지 | 생성기마다 키 의미가 달라 유지하면 혼란 |
| 라이트 기본, OS 설정 무시 | prefers-color-scheme | 황보정님 지시("라이트테마를 기본값으로") |
| 인라인 SVG 아이콘 | 이모지 | 헤드리스·플랫폼별 폰트 차이 없이 동일하게 보임 |
