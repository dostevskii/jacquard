# Jacquard — 파라메트릭 패턴 제조기 설계서

- 작성일: 2026-09-16
- 상태: 승인됨 (황보정님, 2026-09-16)
- 역할 분담: 설계·계획은 Claude Fable, 구현은 Claude Opus가 별도 세션에서 수행한다.
- 저장소: `~/jacquard` (로컬), `github.com/dostevskii/jacquard` (비공개)
- 라이선스: MIT (Copyright (c) 2026 dostevskii)

## 1. 목적

Jacquard는 브라우저에서 동작하는 패턴 생성 도구다. 사용자가 슬라이더·선택·토글과 색상
입력(색상환, HEX, RGB, HSL, HSB)으로 매개변수를 조정하면 즉시 미리보기가 갱신되고,
결과를 PNG 또는 JPG로 내려받는다. 그래픽 디자인, 웹 디자인, 텍스타일, 타일 디자인에서
바로 쓸 수 있는 **이어붙여도 무늬가 맞는 반복 타일(seamless repeat)** 을 만드는 것이 핵심이다.

참고 이미지 17장을 분석한 결과 패턴은 세 계열로 나뉘며 v1은 세 계열을 모두 다룬다.

| 계열 | 특징 | 참고 이미지 |
|---|---|---|
| 격자·직조 (grid) | 셀 격자 위에 색을 배치. 지그재그, 벽돌식 스트라이프, 타탄, 페어아일 모티프, 동심 사각 타일 | 1, 2, 3, 9, 10, 11, 12, 13~15 |
| 그라데이션 바 (gradient) | 세로·가로 막대에 선형 그라데이션. 반 칸 어긋남, 띠 분할, 계단 오프셋, 미러 | 4, 5, 6, 7, 8 |
| 기하 테셀레이션 (tessellation) | 등각 큐브, 삼각·마름모 타일링 | 16, 17 |

## 2. 범위

### v1에 포함

- 생성기 8종 (5절)
- 시드 기반 결정적 생성 (같은 입력 → 같은 출력)
- 팔레트 편집: 색상환 + 명도 슬라이더, HEX/RGB/HSL/HSB 숫자 입력, 프리셋 팔레트, 셔플
- 미리보기: 채우기 / 타일 1장 / 3×3 + 경계선
- 내보내기: PNG, JPG. 타일 1장(배율 지정) 또는 캔버스 채우기(프리셋·직접 입력 크기)
- URL 해시로 상태 공유 (링크 복사)
- Vitest 단위 테스트, Cloudflare Pages 배포, 한·영 README

### v1에서 제외 (설계상 확장 여지만 남김)

- SVG(벡터) 내보내기 — Scene IR을 SVG 원시 도형만으로 제한하여 `exportSvg()` 모듈 추가만으로 가능하게 한다. 추후 유료 기능으로 게이트할 수 있다. 결제·인증 코드는 v1에 넣지 않는다.
- 그레인(입자) 질감, 블러 등 후처리
- 실행 취소/다시 실행, 저장 라이브러리, 다국어 UI, 모바일 레이아웃(데스크톱 우선, 최소 폭 1024px), 터치 제스처

## 3. 기술 스택

| 항목 | 선택 | 근거 |
|---|---|---|
| 빌드 | Vite 8 | 기존 프로젝트(tc-slate)와 동일 |
| UI | React 19 + TypeScript 6 | 동일 |
| 린트 | oxlint | 동일 |
| 테스트 | Vitest (jsdom 불필요, 순수 함수 위주) | 생성기·색 변환이 DOM과 무관 |
| 렌더 | Canvas 2D | 그라데이션 지원, 수만 도형도 빠름, PNG/JPG 직접 출력 |
| 런타임 의존성 | react, react-dom 두 개만 | 색상환·PRNG·색 변환은 직접 구현 |
| 배포 | Cloudflare Pages 직접 업로드 `npx wrangler pages deploy dist --project-name=jacquard --branch=main` | tc-slate와 동일 방식 |

node-canvas 같은 네이티브 의존성은 쓰지 않는다. Canvas 렌더 결과는 개발 서버를 띄운 뒤
브라우저 스크린샷으로 육안 검증한다.

## 4. 아키텍처

### 4.1 데이터 흐름

```
PatternState ──▶ generator.generate(ctx) ──▶ Scene(반복 타일 1장) ──▶ Canvas 렌더러 ──▶ 화면 / PNG / JPG
     ▲                                                                       
     └── URL 해시 (base64url JSON) ◀──▶ 인코딩/디코딩
```

생성기는 **순수 함수**다. 입력은 매개변수·팔레트·시드 PRNG, 출력은 Scene 하나다.
DOM과 Canvas를 전혀 모른다. 이 경계 덕분에 생성기는 Node 환경의 Vitest로 완전히 검증된다.

### 4.2 폴더 구조

```
jacquard/
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.json / tsconfig.app.json / tsconfig.node.json
├── public/                 # favicon
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── styles.css
│   ├── core/
│   │   ├── prng.ts          # mulberry32, Rng 인터페이스
│   │   ├── scene.ts         # Scene / Shape / Paint 타입, tileWrap, clipPolygonToRect
│   │   ├── color.ts         # hex/rgb/hsl/hsv 변환, 파싱, mix
│   │   ├── params.ts        # ParamDef 타입, 기본값 생성, 값 클램프
│   │   ├── state.ts         # PatternState, URL 인코딩/디코딩, 검증
│   │   └── palettes.ts      # 프리셋 팔레트, 랜덤 팔레트 생성
│   ├── generators/
│   │   ├── index.ts         # 레지스트리: GeneratorDef[] 와 id → def 조회
│   │   ├── types.ts         # GeneratorDef, GenContext
│   │   ├── stripes.ts
│   │   ├── plaid.ts
│   │   ├── zigzag.ts
│   │   ├── motif.ts
│   │   ├── rings.ts
│   │   ├── gradientBars.ts
│   │   ├── isoCubes.ts
│   │   └── triangles.ts
│   ├── render/
│   │   ├── canvas.ts        # renderTile, renderFill (Canvas 2D)
│   │   └── export.ts        # 출력 크기 계산, toBlob, 파일명, 다운로드
│   └── ui/
│       ├── TopBar.tsx
│       ├── ControlPanel.tsx
│       ├── ParamControl.tsx # ParamDef → 슬라이더/선택/토글
│       ├── PalettePanel.tsx
│       ├── ColorEditor.tsx  # 색상환 + 명도 + 숫자 입력 묶음
│       ├── ColorWheel.tsx
│       ├── ColorInputs.tsx  # HEX/RGB/HSL/HSB 필드
│       ├── Preview.tsx
│       └── ExportDialog.tsx
├── docs/superpowers/specs/  # 이 문서
├── docs/superpowers/plans/  # 구현 계획서
├── LICENSE
└── README.md
```

테스트 파일은 대상 옆에 `*.test.ts`로 둔다 (예: `src/core/color.test.ts`).

### 4.3 핵심 타입

```ts
// core/prng.ts
export interface Rng {
  next(): number;                       // [0, 1)
  int(min: number, max: number): number; // 정수, 양끝 포함
  pick<T>(items: readonly T[]): T;
  shuffle<T>(items: readonly T[]): T[];  // 새 배열 반환
}
export function mulberry32(seed: number): Rng;

// core/scene.ts
export type Paint =
  | { type: 'solid'; color: string }
  | { type: 'linear'; x1: number; y1: number; x2: number; y2: number;
      stops: { offset: number; color: string }[] };   // 좌표는 타일 절대 좌표

export type Shape =
  | { kind: 'rect'; x: number; y: number; w: number; h: number; fill: Paint }
  | { kind: 'polygon'; points: number[]; fill: Paint }; // [x0,y0,x1,y1,...]

export interface Scene {
  width: number;       // 타일 폭 (단위: unit, 배율 1에서 px)
  height: number;
  background: string;  // hex
  shapes: Shape[];
}

// core/params.ts  (generators/types.ts 가 아니라 core 에 두어 core → generators 순환 참조를 막는다)
export type ParamValue = number | string | boolean;
export type ParamDef =
  | { type: 'range'; key: string; label: string; min: number; max: number; step: number; default: number }
  | { type: 'select'; key: string; label: string; options: { value: string; label: string }[]; default: string }
  | { type: 'toggle'; key: string; label: string; default: boolean };
export function defaultParams(defs: ParamDef[]): Record<string, ParamValue>;
export function clampParams(defs: ParamDef[], input: Record<string, unknown>): Record<string, ParamValue>;

// generators/types.ts
export interface GenContext {
  params: Record<string, ParamValue>;
  palette: string[];   // palette[0]은 배경색 (모든 생성기 공통 규약)
  rng: Rng;
}
export interface GeneratorDef {
  id: string;
  name: string;
  family: 'grid' | 'gradient' | 'tessellation';
  minColors: number;   // 이 생성기가 요구하는 최소 팔레트 길이 (배경 포함)
  params: ParamDef[];
  generate(ctx: GenContext): Scene;
}

// core/state.ts
export interface PatternState {
  generator: string;
  seed: number;                         // 0 .. 2^32-1
  params: Record<string, ParamValue>;
  palette: string[];                    // '#rrggbb', 길이 2..8
}
```

`PatternState`만 URL에 인코딩한다. 미리보기 모드, 내보내기 설정은 앱 로컬 상태다.

### 4.4 반복 타일 규약과 `tileWrap`

모든 생성기는 폭 `width`, 높이 `height`의 타일 1장을 만들며, 타일을 상하좌우로 이어붙였을 때
무늬가 끊기지 않아야 한다. 도형은 타일 경계 안에 있어야 한다(허용 오차 1e-6).

경계를 넘는 도형을 손으로 쪼개는 대신 공통 유틸을 쓴다.

```ts
// core/scene.ts
export function tileWrap(shapes: Shape[], width: number, height: number): Shape[];
export function clipPolygonToRect(points: number[], x0: number, y0: number, x1: number, y1: number): number[] | null;
```

`tileWrap`은 각 도형을 (0,0), (±W,0), (0,±H), (±W,±H) 아홉 위치로 복사한 뒤 타일 사각형으로
잘라(rect는 교집합, polygon은 Sutherland–Hodgman) 비어 있지 않은 조각만 남긴다.
복사할 때 `linear` 페인트의 좌표도 같은 오프셋으로 이동시킨다. 생성기는 경계를 약간 넘어
자유롭게 그린 뒤 마지막에 `tileWrap`을 한 번 호출하면 된다.

### 4.5 렌더러 (render/canvas.ts)

```ts
export function renderTile(scene: Scene, tilePx: { w: number; h: number }, ctx: CanvasRenderingContext2D): void;
export function renderFill(scene: Scene, tilePx: { w: number; h: number }, ctx: CanvasRenderingContext2D, w: number, h: number): void;
export function tilePixelSize(scene: Scene, scale: number): { w: number; h: number }; // Math.round
```

- 타일 픽셀 크기는 항상 정수로 반올림하고, x·y 배율을 각각 `tilePx.w / scene.width`, `tilePx.h / scene.height`로 계산해 서브픽셀 이음새를 막는다.
- `renderFill`은 오프스크린 캔버스에 타일을 그린 뒤 `createPattern(tile, 'repeat')`로 채운다.
- 이음새 방지: `rect`는 각 변을 장치 픽셀에 반올림해서 그린다. `polygon`은 채운 뒤 같은 페인트로 lineWidth 1(장치 픽셀) stroke를 덧그려 안티에일리어싱 틈을 가린다.
- `linear` 페인트는 `createLinearGradient`로, 좌표는 배율을 곱해 변환한다.
- 배경은 `scene.background`로 먼저 채운다.

### 4.6 내보내기 (render/export.ts)

- 형식: `png`, `jpg`(품질 0.92). `canvas.toBlob` → `<a download>`.
- 모드
  - `tile`: 배율(px/unit) 지정. 출력 = 타일 1장.
  - `canvas`: 폭·높이 지정. 프리셋 1080×1080, 1920×1080, 1080×1920, 2480×3508(A4 300dpi), 3508×4961(A3 300dpi) + 직접 입력. 타일 배율은 미리보기와 같은 값을 쓴다.
- 한 변 최대 8192px. 넘으면 버튼을 비활성화하고 이유를 표시한다.
- 파일명: `jacquard-<generator>-<seed>.<ext>`.

### 4.7 URL 상태 (core/state.ts)

- `location.hash = '#' + base64url(JSON.stringify(state))`. 상태 변경 시 300ms 디바운스로 `history.replaceState`.
- 로드 시 디코딩 후 검증: 알 수 없는 생성기 → 기본 생성기, 매개변수는 정의에 맞춰 클램프·기본값 보정, 팔레트는 hex 형식 검사 후 길이 2..8로 정규화.
- 상단 바 "Copy link" 버튼이 현재 URL을 클립보드에 복사한다.

## 5. 생성기 사양

공통 규약
- `palette[0]`은 배경색. 나머지 `palette[1..]`가 전경색이다.
- 색이 부족하면 `palette[1 + (i mod (len-1))]`처럼 순환한다.
- 매개변수 단위 `unit`은 배율 1에서 1px. `cell`은 격자 한 칸의 unit 크기.
- 모든 생성기는 마지막에 `tileWrap`을 호출하거나, 그 필요가 없음을 주석으로 명시한다.

### 5.1 `stripes` — 벽돌 스트라이프 (grid)  참고 11, 3

가로 띠를 쌓고 각 띠를 색 세그먼트로 나눈다. 행마다 세그먼트 시작점을 어긋나게 해 벽돌 쌓기 느낌을 낸다.

| key | type | 범위 | 기본 | 의미 |
|---|---|---|---|---|
| cell | range | 4..64 step 2 | 16 | 격자 칸 크기(unit) |
| bandHeight | range | 1..8 | 3 | 띠 높이(cell) |
| segmentLength | range | 2..16 | 6 | 세그먼트 길이(cell) |
| columns | range | 1..8 | 3 | 행당 세그먼트 수 → 타일 폭 = columns × segmentLength × cell |
| rows | range | 2..12 step 2 | 6 | 띠 수(짝수) → 타일 높이 = rows × (bandHeight + separator) × cell |
| offset | range | 0..1 step 0.25 | 0.5 | 홀수 행의 시작점 이동(세그먼트 길이 비율). 짝수 행은 0 |
| separator | range | 0..3 | 1 | 띠 사이 배경색 구분선 두께(cell) |
| colorMode | select | sequence / alternate / random | sequence | sequence: 세그먼트마다 팔레트 순환, alternate: 행마다 두 색 교대, random: rng |

오프셋을 짝·홀 행 교대로만 적용하고 rows를 짝수로 제한하므로 수직 이음새가 보장된다.
오프셋 때문에 타일 오른쪽 경계를 넘는 세그먼트는 `tileWrap`으로 자른다. minColors 3.

### 5.2 `plaid` — 타탄·격자 (grid)  참고 3, 10, 13~15

세로 줄 시퀀스(warp)와 가로 줄 시퀀스(weft)를 교차시킨다. 교차부 색은 두 색의 혼합 규칙으로 정한다.

| key | type | 범위 | 기본 | 의미 |
|---|---|---|---|---|
| cell | range | 2..32 | 8 | 격자 칸(unit) |
| sett | range | 2..8 | 4 | 반 세트의 줄 수 |
| maxStripe | range | 1..8 | 4 | 줄 폭 상한(cell), rng로 1..maxStripe |
| symmetric | toggle | | true | 반 세트를 거울 대칭으로 이어 전통 타탄 세트 구성 |
| sameSett | toggle | | true | weft가 warp 시퀀스를 그대로 사용 |
| blend | select | mix / weave / warp | mix | mix: RGB 평균, weave: 1 cell 체커로 두 색 교대(트윌 느낌), warp: 세로 줄이 위 |

타일 크기 = 세트 총 길이(cell) × cell, 가로·세로 각각. 줄 색은 rng가 `palette[1..]`에서 뽑되 인접 줄은 다른 색. minColors 3.

### 5.3 `zigzag` — 셰브런 (grid)  참고 1

계단식 지그재그 띠. 셀 단위로 계산하므로 니트 느낌이 나고, cell을 작게 하면 매끈해진다.

| key | type | 범위 | 기본 | 의미 |
|---|---|---|---|---|
| cell | range | 2..32 | 6 | 격자 칸(unit) |
| wavelength | range | 4..64 step 2 | 16 | 한 주기 폭(cell) → 타일 폭 |
| amplitude | range | 1..32 | 6 | 진폭(cell) |
| bandHeight | range | 1..16 | 3 | 띠 두께(cell) |
| bands | range | 2..12 | 6 | 띠 수 → 타일 높이 = bands × bandHeight × cell |
| colorMode | select | sequence / random | sequence | 띠 색 배정 |

알고리즘: 열 x에 대해 `offset(x) = amplitude × tri(x / wavelength)` (삼각파, 0..1). 행 y의 띠 인덱스 = `floor((y + offset(x)) / bandHeight) mod bands`. 세로로 이어지는 같은 색 칸은 하나의 rect로 합친다. 주기가 타일 크기와 일치하므로 tileWrap이 필요 없다. minColors 3.

### 5.4 `motif` — 페어아일 모티프 (grid)  참고 9, 10

시드로 대칭 모티프를 만들고 줄무늬 띠와 함께 반복한다.

| key | type | 범위 | 기본 | 의미 |
|---|---|---|---|---|
| cell | range | 4..32 | 10 | 격자 칸(unit) |
| size | range | 7..31 step 2 | 15 | 모티프 한 변(cell, 홀수) |
| density | range | 0.1..0.6 step 0.05 | 0.3 | 사분면 셀이 채워질 확률 |
| symmetry | select | quad / oct | quad | 4방 또는 8방(대각선 포함) 거울 대칭 |
| smooth | range | 0..2 | 1 | 이웃 4칸 중 2칸 이상이 채워진 빈 칸을 채우는 패스 횟수 |
| spacing | range | 0..6 | 2 | 모티프 사이 간격(cell) |
| bandRows | range | 0..4 | 2 | 모티프 행 사이 줄무늬 띠 높이(cell). 0이면 없음 |
| stagger | toggle | | false | 홀수 행 모티프를 반 칸 이동(타일에 모티프 2행 포함) |

색: 모티프 `palette[1]`, 띠는 `palette[2]`/`palette[3]` 1 cell 체커 교대(부족하면 순환). 타일 폭 = (size + spacing) × cell, 높이 = (size + spacing + bandRows) × cell × (stagger ? 2 : 1). stagger가 켜지면 둘째 모티프 행이 좌우 경계를 넘으므로 `tileWrap`으로 자른다. minColors 3.

### 5.5 `rings` — 동심 사각 타일 (grid)  참고 12, 2

셀 격자에 바깥에서 안쪽으로 링을 그린다. 줄눈(grout)은 배경색이 비치는 방식으로 표현한다.

| key | type | 범위 | 기본 | 의미 |
|---|---|---|---|---|
| cell | range | 4..40 | 20 | 격자 칸(unit) |
| cols | range | 6..40 | 16 | 타일 폭(cell) |
| rows | range | 6..40 | 12 | 타일 높이(cell) |
| grout | range | 0..4 step 0.5 | 2 | 셀마다 사방으로 줄어드는 양(unit) |
| maxRing | range | 1..4 | 2 | 링 두께 상한(cell), rng로 1..maxRing |
| center | select | solid / checker / stripes | checker | 링이 끝난 중심부 채움 |

셀 (i, j)의 깊이 `d = min(i, j, cols-1-i, rows-1-j)`. rng가 만든 링 두께 시퀀스의 누적합으로 링 인덱스를 구하고 색은 `palette[1..]` 순환(인접 링은 다른 색). 도형은 셀마다 rect 하나. 타일 경계가 곧 바깥 링이므로 tileWrap 불필요. minColors 3.

### 5.6 `gradientBars` — 그라데이션 바 (gradient)  참고 4~8

열마다 선형 그라데이션 세그먼트를 쌓는다. 어긋남·계단·미러로 4~8번 이미지를 모두 낸다.

| key | type | 범위 | 기본 | 의미 |
|---|---|---|---|---|
| columns | range | 2..64 | 12 | 열 수 |
| barWidth | range | 8..200 | 60 | 열 폭(unit) → 타일 폭 = columns × barWidth |
| length | range | 200..2000 step 10 | 800 | 바 축 길이(unit) → 타일 높이(vertical) |
| direction | select | vertical / horizontal | vertical | 바가 뻗는 방향(그라데이션 축) |
| bands | range | 1..12 | 1 | 바를 나누는 세그먼트 수. 세그먼트마다 그라데이션이 다시 시작 |
| stagger | range | 0..1 step 0.05 | 0.5 | 짝수·홀수 열의 세그먼트 경계 어긋남(세그먼트 길이 비율) |
| step | range | -1..1 step 0.05 | 0 | 열마다 누적되는 경계 이동(세그먼트 길이 비율). 5번 이미지의 계단 |
| shape | select | linear / symmetric | linear | linear: A→B, symmetric: A→B→A (6, 7번 이미지의 관 느낌) |
| colorMode | select | pairs / random | pairs | pairs: 팔레트 연속 두 색을 열마다 순환, random: rng가 서로 다른 두 색 선택 |
| mirrorX | toggle | | false | 타일 좌우 절반을 거울 복사 |
| mirrorY | toggle | | false | 타일 상하 절반을 거울 복사 (8번 이미지) |

열 i의 경계 이동 = `((i mod 2) × stagger + i × step) mod 1` × 세그먼트 길이. 세그먼트는 축 방향으로 타일을 완전히 채우며 경계를 넘는 조각은 `tileWrap`으로 처리한다. `direction`이 horizontal이면 타일 폭 = length, 타일 높이 = columns × barWidth 로 축이 바뀐다. 미러는 반쪽을 생성한 뒤 좌표와 그라데이션 좌표를 반전 복사한다. minColors 3 (배경은 그라데이션에 쓰지 않는다).

### 5.7 `isoCubes` — 등각 큐브 (tessellation)  참고 16, 17

육각 격자 위에 마름모 세 개로 큐브를 그린다.

| key | type | 범위 | 기본 | 의미 |
|---|---|---|---|---|
| size | range | 10..120 | 40 | 큐브 모서리 길이(unit) |
| cols | range | 1..8 | 2 | 타일 안 큐브 열 수 → 타일 폭 = cols × √3 × size |
| rows | range | 1..8 | 2 | 타일 안 큐브 행 쌍 수 → 타일 높이 = rows × 3 × size |
| gap | range | 0..8 | 0 | 면 사이 배경이 비치는 간격(unit) |
| shuffle | toggle | | false | 큐브마다 rng로 세 면 색을 뒤섞음 |

면 색: 윗면 `palette[1]`, 왼면 `palette[2]`, 오른면 `palette[3]`(부족 시 순환). 육각 배치: 가로 간격 √3·size, 세로 간격 1.5·size, 홀수 행은 √3/2·size 이동. 경계에 걸린 큐브는 `tileWrap`으로 자른다. minColors 4.

### 5.8 `triangles` — 삼각·마름모 (tessellation)  참고 16, 17

정삼각형 격자를 색 규칙으로 채운다.

| key | type | 범위 | 기본 | 의미 |
|---|---|---|---|---|
| size | range | 10..120 | 40 | 삼각형 한 변(unit) |
| cols | range | 2..16 | 4 | 타일 폭 = cols × size |
| rows | range | 2..16 step 2 | 2 | 타일 높이 = rows × (√3/2) × size (짝수) |
| rule | select | checker / stripes / random / rhombus | checker | checker: 위·아래 삼각형 두 색, stripes: 행마다 색, random: rng, rhombus: 인접 위·아래 쌍이 같은 색(마름모) |
| orientation | select | horizontal / vertical | horizontal | 행이 뻗는 방향 |

색은 `palette[1..]`. 경계는 `tileWrap`으로 처리한다. minColors 3.

## 6. 색상 시스템

### 6.1 변환 (core/color.ts)

```ts
export type Rgb = { r: number; g: number; b: number };        // 0..255 정수
export type Hsl = { h: number; s: number; l: number };        // h 0..360, s/l 0..100
export type Hsv = { h: number; s: number; v: number };        // HSB와 동일
export function parseHex(input: string): Rgb | null;         // '#abc', 'abc', '#aabbcc', 'aabbcc' 허용
export function toHex(rgb: Rgb): string;                      // '#rrggbb' 소문자
export function rgbToHsl(rgb: Rgb): Hsl;  export function hslToRgb(hsl: Hsl): Rgb;
export function rgbToHsv(rgb: Rgb): Hsv;  export function hsvToRgb(hsv: Hsv): Rgb;
export function mix(a: string, b: string, t?: number): string; // RGB 선형 혼합, 기본 0.5
```

### 6.2 색 편집기 (ui/ColorEditor.tsx)

- **색상환(ColorWheel)**: 지름 200px 원판. 각도 = 색상(H), 중심에서의 거리 = 채도(S). CSS `conic-gradient`(색상) 위에 `radial-gradient`(중심 흰색 → 투명)를 겹쳐 그리고, 명도(V)는 검은 반투명 오버레이 `opacity = 1 - V/100`로 표현한다. 포인터 드래그로 H·S를 바꾸고 현재 색 위치에 마커를 표시한다.
- **명도 슬라이더**: 0..100, 색상환 아래.
- **숫자 입력(ColorInputs)**: HEX 텍스트 1개, RGB 3개, HSL 3개, HSB 3개. 어느 필드를 바꿔도 나머지가 즉시 동기화된다. 잘못된 입력은 빨간 테두리로 표시하고 상태를 바꾸지 않는다.
- 내부 표준 표현은 `Hsv`로 두어 색상환 드래그 중 H가 튀지 않게 한다(채도 0이나 명도 0에서 H 보존).

### 6.3 팔레트 패널 (ui/PalettePanel.tsx)

- 스와치 행 (2..8개). 클릭하면 선택되고 아래에 색 편집기가 열린다. 첫 스와치에 "BG" 표시.
- 선택 스와치 좌·우 이동 버튼, 추가(+, 최대 8), 삭제(−, 현재 생성기의 `minColors` 미만이면 비활성).
- 프리셋 드롭다운(6.4)과 "Shuffle" 버튼. Shuffle은 `Math.random`으로 황금각(137.5°) 색상 간격 + 채도 55..85 + 명도 35..90 범위에서 현재 길이의 팔레트를 새로 만든다. 첫 색은 밝거나(명도 92..97) 어둡게(8..14) 하여 배경 역할을 한다.

### 6.4 프리셋 팔레트 (core/palettes.ts) — 참고 이미지 기준 근사값, 구현 중 조정 가능

| 이름 | 색 (첫 색이 배경) |
|---|---|
| Missoni Blue | #0a0a0a, #1e6fe6, #3b8cff, #0b3fa8, #9cc4ff |
| Walala | #f2f2f2, #e63b2e, #f2a91e, #6aa9dc, #1a1a1a, #b41f2b |
| Underground | #eeeae1, #7a1a1a, #f2c72c, #3a9ad9, #e8459a, #1f7a4d |
| Boogie | #f4efe9, #ff2a2a, #ffb3c1, #ffffff |
| Poppy Field | #f48fb1, #1b5e20, #e53935, #64b5f6, #111111 |
| Bauhaus | #f5f0e6, #d32f2f, #fbc02d, #1565c0, #212121 |
| Neon Op | #111111, #e6ff00, #ff2d78, #ff8a00, #00a3a3 |
| Candy Weave | #c8c8c8, #1d47a8, #ffb400, #ff3366, #58a36b, #ffc9d9 |

## 7. UI

### 7.1 레이아웃

```
┌──────────────────────────────────────────────────────────────┐
│ TopBar: Jacquard │ [Generator ▾] │ Seed [______] 🎲 │ Copy link │ Export │  48px
├───────────────┬──────────────────────────────────────────────┤
│ ControlPanel  │ Preview                                      │
│ 320px         │  (뷰 모드: Fill │ Tile │ 3×3)  배율 슬라이더  │
│ - Parameters  │                                              │
│ - Palette     │            <canvas>                          │
│ - Output info │                                              │
└───────────────┴──────────────────────────────────────────────┘
```

- 데스크톱 우선, 최소 폭 1024px. 테마는 중립 다크(배경 #141414, 텍스트 #ececec, 패널 #1d1d1d)로 패턴 색이 돋보이게 한다. 시스템 UI 폰트.
- UI 문구는 영어.

### 7.2 동작

- **생성기 전환**: 매개변수를 새 생성기 기본값으로 초기화하고 팔레트·시드는 유지. 팔레트 길이가 `minColors`보다 짧으면 프리셋에서 색을 보충한다.
- **매개변수 컨트롤(ParamControl)**: range → 라벨 + 슬라이더 + 숫자 입력, select → 세그먼트 버튼(옵션 4개 이하) 또는 `<select>`, toggle → 스위치. 변경은 즉시 상태에 반영된다.
- **시드**: 숫자 입력 + 주사위 버튼(새 uint32).
- **미리보기(Preview)**: 캔버스는 영역을 채우고 `devicePixelRatio`를 반영한다. 배율 슬라이더(0.25..4 px/unit, 기본 1). 뷰 모드 Fill은 `renderFill`, Tile은 타일 1장을 중앙에, 3×3은 3×3 반복 위에 1px 점선으로 타일 경계를 그린다. 렌더는 `requestAnimationFrame`으로 합쳐 프레임당 최대 1회 실행한다.
- **출력 정보**: 현재 타일의 unit 크기와 배율 적용 px 크기를 패널 하단에 표시한다.
- **내보내기 대화상자(ExportDialog)**: 형식(PNG/JPG), 모드(Tile/Canvas), Tile이면 배율 입력, Canvas면 프리셋 선택 + 폭·높이 입력. 결과 px 크기를 표시하고 8192 초과 시 경고와 버튼 비활성.

## 8. 검증 전략

모든 생성기와 코어 모듈은 TDD로 진행한다(테스트 먼저, 실패 확인, 구현, 통과).

| 대상 | 테스트 |
|---|---|
| prng | 같은 시드 → 같은 수열 20개, 다른 시드 → 다른 수열, 1만 회 평균이 0.45..0.55, `int`가 양끝 포함 범위 안 |
| color | 대표 색 12개 hex→rgb→hsl→rgb→hex 왕복 일치, hsv 왕복 일치, parseHex 4가지 표기 허용·오류 반환, mix(#000,#fff)=#808080 |
| scene.tileWrap | 오른쪽 경계를 넘는 rect가 두 조각으로 나뉘고 면적 합이 보존, 모서리를 넘는 rect가 네 조각, 완전히 안에 있는 도형은 그대로, linear 페인트 좌표가 오프셋만큼 이동 |
| scene.clipPolygonToRect | 삼각형을 사각형으로 잘랐을 때 정점이 모두 사각형 안, 완전히 밖이면 null |
| 각 생성기 (8종 공통) | (1) 같은 params·palette·seed → `deepEqual` Scene, (2) 다른 seed → 다른 Scene(rng를 쓰는 생성기만), (3) 모든 도형이 타일 경계 안(1e-6), (4) width·height > 0, (5) solid 색과 linear 정지점 색이 모두 팔레트 안(plaid mix는 mix 결과 허용), (6) 기본값이 min·max 안, (7) `minColors` 길이 팔레트와 8색 팔레트 모두 예외 없이 동작, (8) 격자 계열은 타일 크기가 cell의 정수배 |
| state | 인코딩→디코딩 왕복 일치, 깨진 해시 → 기본 상태, 범위 밖 매개변수 → 클램프, 잘못된 hex 제거 |
| export | 파일명 형식, 8192 초과 판정, 타일 px 크기 반올림 |
| 렌더·UI | `npm run dev` 후 브라우저에서 생성기 8종 × 기본 팔레트 스크린샷을 `docs/screenshots/`에 저장하고 육안 확인. 3×3 뷰에서 타일 경계에 끊김이 없는지 확인 |

`npm test`(vitest run), `npm run lint`(oxlint), `npm run build`(tsc -b && vite build)가 모두 통과해야 단계 완료로 본다.

## 9. 구현 순서와 저장소 운영

1. 스캐폴드: Vite React-TS 템플릿, oxlint, vitest, 빈 App, `npm run build` 통과 → 커밋
2. 코어: prng → color → scene(tileWrap, clip) → params → state → palettes (각각 테스트 먼저) → 커밋
3. 렌더러와 앱 골격: canvas.ts, Preview, TopBar, ControlPanel/ParamControl, 첫 생성기 `stripes`로 화면 확인 → 커밋
4. 생성기 순차 추가: plaid → zigzag → gradientBars → motif → rings → isoCubes → triangles (생성기마다 커밋)
5. 팔레트 패널 + 색 편집기(색상환, 숫자 입력) → 커밋
6. 내보내기 대화상자 + URL 상태 공유 → 커밋
7. 스크린샷, Cloudflare Pages 배포, README(한·영), GitHub About 정리 → 커밋

- 브랜치는 `main` 하나. 각 단계 종료마다 테스트·린트·빌드 통과 후 커밋.
- GitHub: `gh repo create dostevskii/jacquard --private --source=. --push`는 설계 문서 첫 커밋 직후 실행한다.
- 배포는 7단계에서 wrangler 로그인 상태를 확인한 뒤 실행하고, 배포 URL을 README와 About에 기록한다.

## 10. 결정 기록

| 결정 | 대안 | 이유 |
|---|---|---|
| Scene IR + Canvas 렌더 | React가 SVG를 직접 렌더 / WebGL | 수천 도형에서도 슬라이더가 끊기지 않고, PNG·JPG를 바로 뽑을 수 있으며, IR을 SVG 원시 도형으로 제한해 벡터 내보내기를 추후 유료 기능으로 추가할 수 있다 |
| 반복 타일 1장을 생성 후 `createPattern`으로 채움 | 생성기가 캔버스 전체를 직접 채움 | 텍스타일·타일 실무의 리피트 단위 요구를 구조적으로 보장. 큰 구성은 타일을 캔버스 크기로 잡으면 된다 |
| `tileWrap` 공통 유틸 | 생성기별 경계 처리 | 이음새 로직을 한 곳에서 검증한다 |
| `palette[0]` = 배경 규약 | 생성기별 배경 매개변수 | UI가 단순해지고 프리셋 팔레트를 모든 생성기에 그대로 적용할 수 있다 |
| 색상환을 CSS 그라데이션으로 직접 구현 | react-colorful 등 라이브러리 | 의존성 추가 없이 요구 형태(원형 휠)를 정확히 맞춘다 |
| 그레인 후처리 제외 | Canvas 노이즈 오버레이 | 사용자 요청으로 제외. 필요 시 렌더러 후처리로 추가 가능 |
| TypeScript 6.x | 7.x | 기존 프로젝트와 동일 버전으로 도구 호환 위험을 줄인다 |
