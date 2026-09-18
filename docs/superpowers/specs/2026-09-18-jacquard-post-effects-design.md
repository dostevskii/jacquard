# Jacquard v1.2 — 후처리 엔진(블러·그레인·픽셀화·포스터라이즈·디더·하프톤)과 기본 생성기 Zigzag 설계서

- 작성일: 2026-09-18
- 상태: 승인됨 (황보정님, 2026-09-18). 효과 범위 6종, 후처리는 전역 Randomize 제외로 확정.
- 선행 설계서: `2026-09-16-jacquard-design.md`(v1), `2026-09-17-jacquard-randomize-locks-theme-design.md`(v1.1). 충돌 시 이 문서가 우선한다.
- 역할 분담: 설계·계획 Fable, 구현 Opus(서브에이전트), 리뷰 Sonnet/Opus — 이전과 동일.

## 1. 목적

1. 처음 접속(빈 URL)했을 때 Zigzag 생성기가 뜨게 한다.
2. 타일에 래스터 후처리를 적용하는 엔진을 만든다. 효과 6종: Blur, Grain, Pixelate, Posterize, Dither(순서 디더링), Halftone. 미리보기·타일 내보내기·캔버스 내보내기가 모두 같은 처리 결과를 보여야 하고, 반복 타일의 이음새가 유지되어야 한다.

## 2. 범위

포함: `src/post/` 효과 엔진(순수 함수), 렌더러·내보내기 연결, `PatternState.effects`와 URL 저장, Effects 패널 UI(효과별 켜기 + 값 컨트롤 + 개별 🎲), 기본 생성기 Zigzag, 테스트, README·스크린샷·재배포.

제외: 효과 순서 편집(순서는 고정), 오차 확산 디더링(Floyd–Steinberg 등 — 이음새·결정성 보장 불가), 비네트처럼 타일 반복과 양립하지 않는 효과, 후처리의 전역 Randomize 참여(황보정님 결정), 잠금(Randomize 대상이 아니므로 의미 없음), 웹 워커 오프로드, SVG 내보내기.

## 3. 파이프라인

```
Scene ─▶ renderTile: 도형 그리기 ─▶ [효과 체인: ImageData 픽셀 연산] ─▶ 타일 캔버스 ─▶ createPattern 반복 / 내보내기
```

- 후처리는 **타일 1장의 픽셀**에 적용한다. `renderTile`이 도형을 그린 뒤 `getImageData` → `applyEffects` → `putImageData`. `renderFill`(미리보기·캔버스 내보내기)과 타일 내보내기가 같은 `renderTile`을 쓰므로 결과가 일치한다.
- 효과 함수는 Canvas를 모른다. `RasterImage { width, height, data: Uint8ClampedArray }`(RGBA, 길이 `width × height × 4`)만 다루며 `ImageData`가 이 형태를 만족한다. 그래서 Node의 Vitest로 검증할 수 있다.
- 크기 매개변수는 **타일 단위(unit)** 로 정의하고 `pxPerUnit = tilePx.w / scene.width`을 곱해 픽셀로 바꾼다. 미리보기(배율 1)와 고해상도 내보내기(배율 4)의 모양이 같아진다.
- 타일은 배경으로 채워져 항상 불투명하므로 효과는 RGB만 바꾸고 알파는 255로 둔다.

## 4. 효과 정의

```ts
// post/types.ts
export interface RasterImage { width: number; height: number; data: Uint8ClampedArray }
export interface EffectContext { pxPerUnit: number; seed: number; palette: string[] }
export interface EffectDef {
  id: string
  name: string
  params: ParamDef[]          // 첫 항목은 항상 { type: 'toggle', key: 'enabled', default: false }
  apply(img: RasterImage, params: Params, ctx: EffectContext): void   // 제자리(in-place) 수정
}
// post/index.ts
export const EFFECTS: EffectDef[]                       // 적용 순서 = 배열 순서
export type EffectsState = Record<string, Params>       // id → params (enabled 포함)
export function defaultEffects(): EffectsState
export function hasEnabledEffects(e: EffectsState): boolean
export function applyEffects(img: RasterImage, effects: EffectsState, ctx: EffectContext): void
// core/state.ts (post를 import하지 않고 정의 목록을 인자로 받는다)
export interface EffectInfo { id: string; params: ParamDef[] }
export function normalizeEffects(input: unknown, effectDefs: EffectInfo[]): EffectsState
```

적용 순서(고정): **pixelate → blur → posterize → dither → halftone → grain**. 기하(픽셀화) → 흐림 → 톤(포스터라이즈·디더·하프톤) → 입자 순서다.

### 4.1 Blur — `post/blur.ts`

| key | type | 범위 | 기본 | 의미 |
|---|---|---|---|---|
| enabled | toggle | | false | |
| radius | range | 0.5..32 step 0.5 | 4 | 반지름(unit) |

- `r = min(64, round(radius × pxPerUnit))`. `r < 1`이면 건너뛴다. 64px 상한은 8192px 내보내기의 처리 시간을 묶기 위한 것이다.
- 창 `2r+1`의 박스 블러를 가로·세로 각각 3회 반복해 가우시안을 근사한다. 각 행/열은 누적합(running sum)으로 O(n).
- **경계는 감는다(wrap-around)**: 인덱스 `(i + k + n) mod n`. 그래서 타일을 이어붙였을 때 블러가 경계를 가로질러 연속이다. 검증: 타일을 3×3으로 이어붙인 이미지를 같은 반지름으로 (경계 감기 없이) 블러한 뒤 중앙 타일을 잘라낸 결과와 픽셀 단위로 일치해야 한다.

### 4.2 Grain — `post/grain.ts`

| key | type | 범위 | 기본 | 의미 |
|---|---|---|---|---|
| enabled | toggle | | false | |
| amount | range | 0..100 | 30 | 세기. 100이면 최대 ±128 |
| size | range | 1..8 | 1 | 입자 크기(unit) |
| color | toggle | | false | 켜면 채널별로 다른 노이즈(컬러 그레인) |

- `s = max(1, round(size × pxPerUnit))`. 픽셀 (x, y)의 노이즈는 셀 `(floor(x/s), floor(y/s))`에서 결정된다 → 굵은 입자.
- 노이즈는 정수 해시 `hash(cx, cy, seed[, channel])`로 `[-1, 1]`을 만든다(결정적, 시드에 종속, 타일 주기). 해시:
  ```
  h = (cx * 0x9E3779B1) ^ (cy * 0x85EBCA77) ^ (seedPlusChannel * 0xC2B2AE3D)
  h = imul(h ^ (h >>> 15), 0x2C1B3C6D); h = imul(h ^ (h >>> 12), 0x297A2D39); h ^= h >>> 15
  noise = (h >>> 0) / 2^32 * 2 - 1
  ```
- `delta = noise × amount × 1.28`. 단색이면 RGB에 같은 delta, 컬러면 채널마다 `seed + 1/2/3`로 다른 노이즈. `Uint8ClampedArray` 대입으로 0..255 클램프.
- 같은 (이미지, 매개변수, seed)면 결과가 같다. 평균 변화는 0에 가깝고(|평균| < amount×1.28×0.05), 최대 변화는 `amount × 1.28`을 넘지 않는다.

### 4.3 Pixelate — `post/pixelate.ts`

| key | type | 범위 | 기본 | 의미 |
|---|---|---|---|---|
| enabled | toggle | | false | |
| block | range | 2..64 | 8 | 블록 한 변(unit) |

- `b = max(1, round(block × pxPerUnit))`. 블록 격자는 타일 원점 (0,0)에서 시작한다. 각 블록의 RGB 평균으로 블록을 채운다. 오른쪽·아래 끝의 부분 블록은 실제 픽셀들만 평균한다.
- 이음새: 격자가 타일마다 원점에서 다시 시작하므로 경계에서 블록이 어긋나지 않는다(부분 블록은 작게 보일 뿐). 타일 크기의 약수를 쓰면 가장 깔끔하다는 점을 README에 적는다.

### 4.4 Posterize — `post/posterize.ts`

| key | type | 범위 | 기본 | 의미 |
|---|---|---|---|---|
| enabled | toggle | | false | |
| levels | range | 2..16 | 4 | 채널당 단계 수 |

- 채널마다 `v → round(round(v / 255 × (L−1)) / (L−1) × 255)`. 출력 채널값의 서로 다른 개수는 L 이하다.

### 4.5 Dither — `post/dither.ts` (순서 디더링)

| key | type | 범위 | 기본 | 의미 |
|---|---|---|---|---|
| enabled | toggle | | false | |
| levels | range | 2..8 | 2 | 채널당 단계 수 |
| matrix | select | 2 / 4 / 8 | 4 | Bayer 행렬 크기(px) |

- Bayer 행렬: `M1 = [[0]]`, `M2n = [[4M, 4M+2], [4M+3, 4M+1]]`. 임계 `t = (M[y mod m][x mod m] + 0.5) / m² − 0.5`.
- 채널마다 `q = v / 255 × (L−1)`, `out = clamp(round(q + t), 0, L−1) / (L−1) × 255`.
- 행렬은 타일 원점에 정렬된다. 타일 크기가 m의 배수면 완전 seamless, 아니면 경계에서 행렬 위상만 바뀐다(값 자체는 단계 집합 안).

### 4.6 Halftone — `post/halftone.ts`

| key | type | 범위 | 기본 | 의미 |
|---|---|---|---|---|
| enabled | toggle | | false | |
| cell | range | 2..32 | 8 | 셀 한 변(unit) |
| mode | select | ink / color | ink | ink: 잉크 한 색 + 종이 한 색, color: 셀 평균색 점 + 종이 |

- `c = max(2, round(cell × pxPerUnit))`. 셀 격자는 타일 원점에서 시작하고 끝의 부분 셀은 실제 크기로 처리한다.
- 셀마다 원본 픽셀의 평균 밝기 `Lum`(Rec. 601: `0.299R + 0.587G + 0.114B`, 0..1)과 평균색을 구한다. 잉크 면적 비율 `a = 1 − Lum`, 점 반지름 `R = 0.7071 × c × sqrt(a)`(a = 1이면 셀 모서리까지 덮어 완전히 잉크). 픽셀은 셀 중심까지의 거리 `d ≤ R`이면 점, 아니면 종이.
- `ink`는 팔레트에서 밝기가 가장 낮은 색, `paper`는 가장 높은 색(`EffectContext.palette`). `color` 모드는 점 색이 셀 평균색.
- 검증: 완전 흰 이미지 → 전부 paper, 완전 검정 → 전부 ink, 회색 단계가 어두울수록 잉크 픽셀 수가 단조 증가. ink 모드 출력에는 두 색만 존재.

## 5. 상태

```ts
export interface PatternState {
  generator: string; seed: number; params: Params; palette: string[]; locks: LockState
  effects: EffectsState        // 추가. 항상 6개 id 모두 존재(기본값 포함)
}
```

- URL 해시에 그대로 저장한다. 디코딩은 `normalizeEffects(obj.effects)`로 정리한다(id 누락·깨짐 → 기본값, 값은 `clampParams`).
- `core/state.ts`는 `post/`를 import하지 않는다. `decodeState`의 `defaults`에 `effectDefs: { id: string; params: ParamDef[] }[]`를 넘겨 그 정의로 정리한다(생성기의 `resolve`와 같은 주입 방식). `normalizeEffects`는 `post/index.ts`가 아니라 `core/state.ts`에 두고 `effectDefs`를 인자로 받는다: `normalizeEffects(input, effectDefs)`. `post/index.ts`의 `defaultEffects()`는 `EFFECTS`로부터 같은 규칙으로 만든다.
- 잠금(`locks`)은 후처리를 다루지 않는다. `randomizeAll`은 `effects`를 건드리지 않는다.
- 생성기 변경 시 `effects`는 유지된다(효과는 생성기와 무관).

## 6. 렌더러·내보내기 연결

```ts
export interface PostOptions { effects: EffectsState; seed: number; palette: string[] }
export function renderTile(scene, tilePx, ctx, post?: PostOptions): void
export function renderFill(scene, tilePx, ctx, w, h, origin?, post?: PostOptions): boolean
// export.ts
export function renderForExport(scene, settings, post?: PostOptions): HTMLCanvasElement
export async function exportImage(scene, generator, seed, settings, post?: PostOptions): Promise<void>
```

- `renderTile`은 도형을 다 그린 뒤 `post`가 있고 `hasEnabledEffects(post.effects)`이면 `getImageData(0,0,w,h)` → `applyEffects(img, post.effects, { pxPerUnit: tilePx.w / scene.width, seed: post.seed, palette: post.palette })` → `putImageData(img, 0, 0)`.
- App은 `post = { effects: pattern.effects, seed: pattern.seed, palette: pattern.palette }`를 `Preview`와 `ExportDialog`에 넘긴다. 미리보기의 rAF 합치기는 그대로다.
- 처리 시간: 미리보기 타일(수백 px)은 수 ms. 8192px 타일에 블러 64px는 수 초가 걸릴 수 있다. 내보내기 버튼의 `busy` 상태가 이미 있으므로 추가 UI는 두지 않는다.

## 7. UI

- 패널에 **Effects** 섹션(Palette와 Output 사이). 효과마다 한 줄 헤더 `[체크박스] 이름`(체크박스 = `enabled`). 켜진 효과 아래에 그 효과의 나머지 값 컨트롤이 펼쳐진다. 효과 순서는 적용 순서와 같고, 헤더 위에 작은 안내 "Applied top to bottom"을 둔다.
- 값 컨트롤은 `ParamControl`을 재사용한다. 새 prop `lockable?: boolean`(기본 true)을 추가해 `false`면 🔒를 그리지 않고 `locked`는 무시한다. 🎲는 그대로 두어 그 값만 무작위로 정한다(`randomParamValue`).
- 컴포넌트: `ui/EffectsPanel.tsx` props `{ effects: EffectsState; onParamChange(id, key, value): void; onRandomizeParam(id, key): void }`. 앱 핸들러: `setEffectParam`, `randomizeEffectParam`(둘 다 `locks` 불변).
- Output 정보에 `Effects: N on` 한 줄 추가.
- 전역 Randomize·Unlock all은 후처리와 무관하다. 후처리 값에는 잠금이 없다.

## 8. 기본 생성기

- `DEFAULT_GENERATOR_ID = 'zigzag'`. 빈 URL로 접속하면 Zigzag + Missoni Blue(기본 팔레트)가 뜬다.
- README의 첫 화면 설명에 "opens with Zigzag" 한 문장을 추가한다. 히어로 스크린샷은 그대로(Gradient Bars + Boogie).

## 9. 검증

| 대상 | 테스트 |
|---|---|
| 공통 | `applyEffects`가 EFFECTS 순서대로 켜진 것만 적용(호출 순서 기록), 모두 꺼지면 이미지 불변, 알파 255 유지, 입력 길이·크기 불변 |
| blur | 단색 이미지 불변; 3×3 이어붙인 이미지를 경계 감기 없이 블러한 중앙 타일과 wrap 블러 결과가 일치(허용 오차 1); `r < 1`이면 불변; 반지름 상한 64 |
| grain | 결정성(같은 seed → 같은 결과), 다른 seed → 다름, |delta| ≤ amount×1.28, 평균 변화 작음, size 4면 4×4 블록 안 동일 delta, color 토글이면 채널별 다름 |
| pixelate | 각 블록 안 픽셀 동일, 블록 값 = 원본 평균, 부분 블록 처리, block ≥ 이미지면 전체 단색 |
| posterize | 채널 고유값 수 ≤ levels, levels 2면 {0,255}만, 단조성 유지 |
| dither | 출력값이 단계 집합 안, Bayer 행렬 4×4가 정확히 0..15 순열, 균일 회색 50%가 levels 2에서 흑백 절반씩(±1), 행렬 주기 |
| halftone | 흰 → 전부 paper, 검정 → 전부 ink, 회색 단계별 잉크 픽셀 수 단조 증가, ink 모드 두 색만, color 모드 점 색 = 셀 평균 |
| state | effects 왕복, 없는 해시 → 기본값, 깨진 값 클램프, 미지의 id 무시 |
| 렌더러 | `hasEnabledEffects`가 false면 `getImageData`를 호출하지 않음(순수 부분만 테스트), 나머지는 브라우저 |
| 브라우저 | 효과별 시각 확인, 블러·그레인 3×3 이음새, 내보낸 PNG 픽셀에 효과 반영(예: 포스터라이즈 후 고유 색 수), URL 왕복, Randomize가 effects 불변, 개별 🎲 동작, 빈 URL 첫 화면이 Zigzag |

## 10. 구현 순서

1. `post/types.ts`, `post/index.ts` 골격(EFFECTS 빈 배열 → 순차 추가), `core/state.ts` effects 통합, 기본 생성기 Zigzag → 커밋
2. blur, grain(테스트 먼저) → 커밋
3. pixelate, posterize, dither → 커밋
4. halftone → 커밋
5. 렌더러·내보내기 `post` 연결, App 상태·Preview·ExportDialog → 커밋
6. `EffectsPanel`, `ParamControl.lockable`, Output 정보 → 커밋
7. 브라우저 검증, 스크린샷 2장(`effects-grain-blur.png`: Zigzag + Grain + Blur, `effects-halftone.png`), README(EN·KO) Effects 절·Controls·Known limitations, 재배포 → 커밋·푸시

## 11. 결정 기록

| 결정 | 대안 | 이유 |
|---|---|---|
| 효과를 타일 1장 픽셀에 적용 | 채워진 캔버스 전체에 적용 | 타일 반복과 내보내기 두 경로가 같은 결과를 내고, 비용이 타일 크기에만 비례 |
| 직접 구현한 픽셀 연산 | `ctx.filter`(CSS 필터) | Safari 호환·이음새 감기·결정성·Node 테스트를 모두 얻는다 |
| 블러 경계 wrap-around | 3×3 타일링 후 중앙 잘라내기 | 같은 결과를 1/9 비용으로 |
| 순서 고정 | 사용자가 순서 편집 | 요청 없음(YAGNI). 고정 순서가 결과를 예측 가능하게 함 |
| 후처리는 Randomize 제외, 잠금 없음 | 참여 | 황보정님 결정 |
| 오차 확산 디더 제외 | Floyd–Steinberg | 이음새·결정성 보장 불가 |
| 크기 매개변수를 unit으로 | px로 | 미리보기와 고해상도 내보내기의 모양 일치 |
| 블러 64px 상한 | 무제한 | 8192px 내보내기 시간 상한 |
| Halftone ink/paper를 팔레트 극값에서 | 고정 검정/흰색 | 팔레트와 어울리는 결과 |
| SVG 내보내기(추후)와의 관계 | — | Blur→feGaussianBlur, Grain→feTurbulence로만 대응 가능. 나머지는 래스터 전용임을 명시 |
