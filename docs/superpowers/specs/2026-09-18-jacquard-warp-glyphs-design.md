# Jacquard v1.3 설계 — Warp 효과 그룹, Glyphs 생성기, 그레인 px, 보류 항목, UI 테스트 하네스

- 작성일: 2026-09-18
- 선행 문서: `2026-09-16-jacquard-design.md`(v1), `2026-09-17-jacquard-randomize-locks-theme-design.md`(v1.1), `2026-09-18-jacquard-post-effects-design.md`(v1.2)
- 상태: 승인 대기

## 1. 목적

- 정형화된 반복 패턴 위에 **2차 변조**를 얹어 더 복잡한 형태를 만든다. 작은 지그재그가 큰 사인곡선을 따라 다시 반복되거나(Wave), 그라데이션 띠가 구간마다 위상이 어긋나며 중앙으로 갈수록 얇아지거나(Bands, "The Boogie"), 거울 대칭과 명암 변조로 중앙이 어두운 대칭 구도가 되도록(Fold + Shade, 참고 이미지 18) 한다.
- 픽셀 글리프 형태의 정사각 타일 생성기(Glyphs)를 추가해 참고 이미지(A–Z)와 같은 계열의 형태가 무작위로 생성되게 한다.
- 그레인을 출력 픽셀 단위로 바꿔 어느 배율·크기에서도 세밀한 입자를 얻는다.
- v1.2 최종 리뷰에서 보류한 소형 4건을 처리하고, UI 동작을 자동 검증할 jsdom 테스트 하네스를 넣는다.

## 2. 범위

포함
- Warp 효과 4종(Bands, Wave, Fold, Shade)과 공통 리샘플러. 후처리 체인 맨 앞에서 실행. `EffectDef.group`으로 패널을 Warp / Texture로 나눔.
- Grain `size`를 출력 px 단위(1–8)로 변경.
- 새 생성기 `glyphs`(격자 계열).
- 보류 4건: Effects 패널 aria-label 고유화, 하프톤 부분 셀 과잉 잉크, URL 해시에서 기본값 효과 생략, 하프톤 color 모드·반올림 테스트.
- jsdom + Testing Library 하네스와 UI 테스트.
- README 영·한, 스크린샷 3장, 재배포.

제외(그대로 유지)
- 효과는 Randomize·잠금 대상이 아니다(개별 🎲만). Warp도 같다.
- Web Worker 효과 체인(v1.4 후보), SVG 내보내기(유료 기능), Scene IR 변경 없음.
- v1.1 보류 소형 항목(접근성 이름 구분, 2옵션 🎲, 시드 🎲 안내, 갤러리 스크린샷 갱신).

## 3. Warp 효과 그룹

### 3.1 파이프라인 위치와 그룹

- `EffectDef`에 `group: 'warp' | 'texture'` 필드를 추가한다. 모든 기존 효과는 `'texture'`.
- `EFFECTS` 고정 순서: **bands → wave → fold → shade** → pixelate → blur → posterize → dither → halftone → grain. `applyEffects`·`hasEnabledEffects`·`normalizeEffects`는 변경 없음(순서는 배열이 결정).
- 순서 근거: Bands가 기본 무늬를 재배열하고, Wave가 휘게 하고, Fold가 결과를 대칭으로 만들고, Shade는 색 연산이라 기하 연산 뒤에 온다. 그 뒤에 텍스처 효과가 픽셀을 다듬는다.
- 미리보기 4 MP 상한(v1.2 §6)은 Warp에도 그대로 적용된다.

### 3.2 공통 리샘플러 — `post/resample.ts`

```ts
export type SampleMode = 'nearest' | 'bilinear'
/** 출력 픽셀 (x, y)마다 map이 준 원본 좌표(px, 실수 가능)를 타일 주기로 감아 샘플링해 제자리 수정한다 */
export function resample(img: RasterImage, map: (x: number, y: number) => readonly [number, number], mode: SampleMode): void
```

- 원본을 `Uint8ClampedArray`로 복사한 뒤 출력 픽셀마다 `(sx, sy) = map(x, y)`.
- nearest: `ix = mod(round(sx), w)`, `iy = mod(round(sy), h)`. 정수 이동이면 정확한 복사.
- bilinear: `x0 = floor(sx)`, `fx = sx − x0`, 네 이웃 `(x0, y0)…(x0+1, y0+1)`을 모두 mod로 감아 가중 평균. 곡선 변위에 쓴다.
- 알파는 항상 255. 각 효과는 열/행 단위 오프셋 표를 미리 계산해 `map`이 사인 계산을 픽셀마다 반복하지 않게 한다.

### 3.3 Wave — `post/wave.ts` (큰 사인곡선 변위)

| 키 | 타입 | 범위 | 기본 | 의미 |
|---|---|---|---|---|
| enabled | toggle | | false | |
| axis | select | `y` Up–down / `x` Left–right | `y` | 변위 방향 |
| periods | range | 1–8 step 1 | 1 | 타일당 사인 주기 수(정수 → 이음새 보장) |
| amplitude | range | 0–64 step 1 | 8 | 변위 진폭(unit) |
| phase | range | 0–1 step 0.05 | 0 | 위상(한 바퀴 = 1) |

- `A = amplitude × pxPerUnit`. `A < 0.5`면 건너뛴다.
- axis `y`: 열 x마다 `dy(x) = A·sin(2π(periods·x/W + phase))`, 원본 `(x, y − dy)`. 타일이 세로로 주기적이므로 y 감기가 정확하다.
- axis `x`: 행 y마다 `dx(y) = A·sin(2π(periods·y/H + phase))`, 원본 `(x − dx, y)`.
- 샘플링 bilinear. `periods`가 정수라 `dy(0) = dy(W)`이고 가로 이음새가 유지된다.
- 예: Zigzag(파장 16 unit) + Wave periods 1, amplitude 8 → 작은 지그재그 행들이 타일 폭만큼의 큰 사인곡선을 따라 굽는다.

### 3.4 Bands — `post/bands.ts` (구간별 위상 이동, The Boogie)

| 키 | 타입 | 범위 | 기본 | 의미 |
|---|---|---|---|---|
| enabled | toggle | | false | |
| axis | select | `rows` Horizontal bands / `cols` Vertical bands | `rows` | 띠가 쌓이는 방향 |
| bands | range | 2–24 step 1 | 8 | 띠 수 N |
| shift | range | 0–256 step 1 | 8 | 띠당 이동량(unit) |
| offset | select | alternate / progressive / random | alternate | 이동 규칙 |
| taper | range | 0–1 step 0.05 | 0 | 중앙 띠를 얇게 |

- 띠 가중치 `w_i = 1 − 0.85·taper·(1 − |2(i + 0.5)/N − 1|)` (i = 0..N−1). taper 1이면 중앙 띠가 가장자리의 15 %. 경계 `b_0 = 0`, `b_i = round(H·Σ_{j<i} w_j / Σ w)`, `b_N = H`. 띠 i = 행 `[b_i, b_{i+1})`.
- `S = shift × pxPerUnit`(px, 반올림). 띠 i의 이동 `s_i`: alternate `(i mod 2)·S`, progressive `i·S`, random `floor(u_i·W)`(`u_i = (grainNoise(i, 0, seed) + 1)/2`, 시드 결정적).
- 띠 i의 픽셀 `(x, y)`는 원본 `(x − s_i, y)`를 W로 감아 nearest 샘플링(정수 이동 → 정확 복사).
- axis `cols`는 역할을 바꾼다(띠는 W를 따라 나뉘고, 이동은 y 방향으로 H로 감는다).
- 이음새: 이동은 주기적 방향으로 감기 때문에 그 축의 이음새가 유지되고, 띠 분할은 타일 내부에 있어 다른 축도 유지된다.
- 예: Gradient Bars(bar width 60) + Bands 8, shift 30, alternate, taper 0.8 → 띠마다 막대가 반 폭씩 어긋나고 중앙 띠가 얇아져 참고 이미지의 중앙 체커 간섭이 생긴다.

### 3.5 Fold — `post/fold.ts` (거울)

| 키 | 타입 | 범위 | 기본 | 의미 |
|---|---|---|---|---|
| enabled | toggle | | false | |
| mode | select | horizontal / vertical / both | horizontal | 접는 축 |

- horizontal: `half = ceil(W/2)`, `sx = x < half ? x : W − 1 − x`. vertical은 y에 같은 규칙. both는 둘 다. nearest(정수 좌표라 정확).
- 결과 타일이 대칭이므로 반복 이음새가 유지된다. Gradient Bars의 mirror 토글과 같은 결과를 8종(9종) 모두에 제공한다.

### 3.6 Shade — `post/shade.ts` (명암 변조)

| 키 | 타입 | 범위 | 기본 | 의미 |
|---|---|---|---|---|
| enabled | toggle | | false | |
| axis | select | `y` Up–down / `x` Left–right | `y` | 변조 방향 |
| periods | range | 1–8 step 1 | 1 | 타일당 주기 수 |
| strength | range | 0–100 step 1 | 60 | 최대 변조량(%) |
| phase | range | 0–1 step 0.05 | 0 | 위상 |
| to | select | dark / light | dark | 어둡게 / 밝게 |

- `t = (y + 0.5)/H`(axis y) 또는 `(x + 0.5)/W`. `f = 1 − (strength/100)·(0.5 − 0.5·cos(2π(periods·t + phase)))`.
- dark: `c' = c·f`. light: `c' = c + (255 − c)·(1 − f)`. `Uint8ClampedArray` 대입으로 반올림.
- 기본값(periods 1, phase 0)에서 `t = 0`은 변화 없음, `t = 0.5`(타일 중앙)가 최대 변조 → 참고 이미지 18의 중앙 암부. `periods`가 정수라 `t = 0`과 `t = 1`의 f가 같아 이음새가 유지된다.

## 4. Grain 단위 변경 — `post/grain.ts`

- `size` 1–8 step 1 기본 1, 단위는 **출력 픽셀**. `s = max(1, round(size))`, `pxPerUnit`을 곱하지 않는다. 다른 매개변수·해시·알고리즘은 그대로.
- 결과: 배율 4에서도, 8192 px 내보내기에서도 1 px 입자가 가능하다. 미리보기 4 MP 상한이 걸린 경우(k > 1) 미리보기 입자는 k배 굵어 보인다 — README 제한 사항에 명시. Grain은 크기가 출력 픽셀인 유일한 효과다.

## 5. Glyphs 생성기 — `generators/glyphs.ts`

### 5.1 정의

- `id: 'glyphs'`, `name: 'Glyphs'`, `family: 'grid'`, `minColors: 2`. `GENERATORS`에서 Rings 다음, Gradient Bars 앞.
- 타일 = `across × down`개의 글리프 슬롯. 슬롯 한 변 = `(grid + gutter)` 셀, 글리프는 슬롯 안 `floor(gutter/2)` 오프셋에 그린다. 타일 크기 = `across·(grid + gutter)·cell × down·(grid + gutter)·cell` unit.
- 출력은 rect만(가로 런 병합). 글리프가 타일 안에 완전히 들어가므로 반복 이음새가 자연스럽다.

| 키 | 타입 | 범위 | 기본 | 의미 |
|---|---|---|---|---|
| cell | range | 2–16 step 1 | 4 | 셀 한 변(unit) |
| grid | range | 6–16 step 1 | 8 | 글리프 한 변 셀 수 g |
| across | range | 1–8 step 1 | 4 | 가로 글리프 수 |
| down | range | 1–8 step 1 | 2 | 세로 글리프 수 |
| gutter | range | 0–4 step 1 | 2 | 글리프 사이 여백(셀) |
| density | range | 0.2–0.8 step 0.05 | 0.45 | 목표 채움 비율 |
| symmetry | select | auto / none / mirror / quad | auto | 대칭 |
| shapes | select | all / lines / dots / checker / wave | all | 원시 도형 계열 |
| colorMode | select | mono / sequence / random | mono | 글리프 색 |

### 5.2 글리프 문법

생성기는 `seed`가 아니라 `rng`를 받으므로, 먼저 `rng.int(0, 0x7fffffff)`로 글리프 수만큼 하위 시드를 뽑고 글리프 k(행 우선 번호)는 `mulberry32(sub_k)`로 그린다. 같은 시드·매개변수면 항상 같은 타일이고, Randomize(시드)로 전체가 바뀐다.

1. 원시 도형 수: 1개(p = 0.6) 또는 2개. 계열 필터: `lines` = bands·bars·loop, `dots` = dots·scatter·center, `checker` = checker·center, `wave` = step·bands, `all` = 전부.
2. 원시 도형(g × g 불리언 격자에 그림, 매개변수는 rng로 뽑고 density가 클수록 굵고 촘촘하게):
   - **bands** 가로 띠 1–3개, 두께 1–2, 균등 간격, p 0.4로 점선(대시 1–3, 간격 1–2). → H·Y·W·Z
   - **bars** 세로 막대 1–4개, 폭 1–2, 균등 간격. → K·V
   - **checker** 블록 1–2, 범위는 전체 또는 중앙 부분 정사각(g/2..g), 위상 무작위. → B·P·Q·X
   - **dots** 간격 2–4, 점 크기 1–2, 범위 전체 또는 중앙, 오프셋 무작위. → A·R·T·O
   - **step** 폴리라인 1–3개: 시작 행에서 가로 런 2–4셀 뒤 ±1행 계단, 너비 끝까지 반복. 방향이 번갈면 지그재그, 한쪽으로 흐르면 파형. → C·E·F·I·J
   - **loop** 여백 1..g/4의 사각 고리, 두께 1, p 0.5로 모서리 1셀 깎기. → M·N
   - **center** 중앙 블록 2–4셀(다른 도형과 결합). → P·R·U
   - **scatter** 확률 density/2의 무작위 셀(대칭 적용 전). → S
3. 대칭: `auto`는 글리프마다 none 0.15 / mirror-x 0.3 / mirror-y 0.2 / quad 0.25 / rotate-180 0.1로 선택. `mirror`는 mirror-x, `quad`는 4방 대칭, `none`은 없음. mirror-x는 왼쪽 절반을 오른쪽에 복사(g가 홀수면 중앙 열은 그대로), rotate-180은 `g[y][x] |= g[g−1−y][g−1−x]`.
4. 밀도 보정: 채움 비율이 `density + 0.25`를 넘으면 마지막 도형을 버리고, `density − 0.25` 미만이고 도형이 1개면 하나 더 그린다(한 번만). 채움 비율이 0.5 미만일 때 p 0.15로 반전.
5. 빈 글리프(채움 0)나 꽉 찬 글리프(채움 1)는 만들지 않는다: 보정 뒤에도 그렇다면 center 블록 하나를 그린다 / 반전을 되돌린다.

### 5.3 색

- mono: 모든 글리프 `fg(palette, 1)`. sequence: 글리프 k는 `fg(palette, 1 + (k mod (n − 1)))`. random: `pickFg`로 글리프마다.
- 배경은 `palette[0]`.

## 6. 보류 4건

### 6.1 Effects 패널 접근성 이름 — `ui/ParamControl.tsx`, `ui/EffectsPanel.tsx`

- `ParamControl`에 `namePrefix?: string` prop. 있으면 슬라이더·숫자 필드·select·체크박스의 `aria-label`과 🎲 제목이 `${namePrefix} ${def.label}`(예: "Posterize Levels", "Randomize Posterize Levels")이 된다. 보이는 라벨 텍스트는 그대로.
- `EffectsPanel`은 `namePrefix={def.name}`을 넘긴다. Parameters 섹션은 넘기지 않는다(기존 이름 유지).

### 6.2 하프톤 부분 셀 — `post/halftone.ts`

- 점 반지름을 실제 셀 크기로 계산한다: `cw = x1 − bx`, `ch = y1 − by`, `radius = 0.5·√(cw² + ch²)·√a`, 중심 `(bx + cw/2, by + ch/2)`. 정사각 완전 셀에서는 기존 `0.7071·c·√a`와 같다. 검정(a = 1)은 여전히 셀 전체를 덮는다(모서리 픽셀 중심 거리 < 반대각선).

### 6.3 해시에서 기본값 효과 생략 — `core/state.ts`

- `encodeState(state, effectDefs?: EffectInfo[])`. `effectDefs`가 주어지면 각 효과의 매개변수가 `defaultParams(def.params)`와 얕은 비교로 같으면 항목을 빼고, 정의에 없는 id도 뺀다. 남는 항목이 없으면 `effects` 키 자체를 뺀다. `decodeState`는 변경 없음(빠진 항목은 기본값으로 복원).
- App은 `encodeState(pattern, effectInfos())`를 쓴다. 기본 상태의 링크가 약 230자 짧아진다.

### 6.4 테스트 보강

- 하프톤 color 모드: 셀의 절반이 `[200, 40, 40]`, 절반이 `[100, 200, 60]`이면 점 색은 평균 `[150, 120, 50]`.
- `Uint8ClampedArray` 반올림 고정: pixelate 블록 평균 2.5 → 2, 3.5 → 4(ties-to-even).

## 7. jsdom UI 테스트 하네스

- devDependencies: `jsdom`, `@testing-library/react`, `@testing-library/dom`. 런타임 의존성은 그대로 react/react-dom.
- `vite.config.ts` test.include → `['src/**/*.test.{ts,tsx}']`. 기본 환경은 node 유지, UI 테스트 파일 첫 줄에 `// @vitest-environment jsdom`.
- 테스트(`src/ui/*.test.tsx`):
  - `EffectsPanel.test.tsx`: "Warp"·"Texture" 소제목이 이 순서로 있고 효과 이름이 `EFFECTS` 순서다; 체크박스 클릭이 `onParamChange(id, 'enabled', true)`를 부른다; 켜진 효과의 컨트롤에 🔒 버튼이 없다; 모든 효과를 켰을 때 패널 안 `aria-label`이 전부 고유하다.
  - `ParamControl.test.tsx`: `lockable={false}`면 🔒가 없다; 숫자 필드를 편집하지 않고 blur하면 `onChange`가 호출되지 않는다; "7.3" 입력 후 Enter면 스냅된 값으로 `onChange`; 옵션 4개 이하 select는 segmented 버튼.
  - `ControlPanel.test.tsx`: Output에 `Effects: 2 on`.
- Preview·ExportDialog는 jsdom에 canvas가 없어 제외(브라우저 검증 유지).

## 8. 상태·호환성

- 기존 링크: 새 효과 4종은 `normalizeEffects`가 기본값(꺼짐)으로 채우므로 그대로 열린다. Grain `size` 값은 범위가 같아 그대로 유효하다(의미만 unit → px).
- `PatternState`·`LockState` 구조 변경 없음. 새 생성기는 `generator: 'glyphs'`로 저장된다.
- Randomize는 시드·매개변수·팔레트만 바꾼다(Glyphs 매개변수 포함). 효과는 여전히 제외.

## 9. UI

- Effects 섹션: `EFFECTS`를 `group`으로 묶어 "Warp"와 "Texture" 소제목(작은 대문자 `.group-title`)을 두고, 그 안은 기존과 같은 체크박스 + 컨트롤. 안내 문구 "Applied top to bottom" 유지.
- 생성기 드롭다운에 Glyphs 추가(Rings 다음).
- Output 줄 `Effects: N on`은 Warp 포함 개수.

## 10. 검증

| 대상 | 단위 테스트(Node) | 브라우저 |
|---|---|---|
| resample | nearest 정수 이동 = 정확 복사, bilinear 중간점 = 이웃 평균, 감기(경계 밖 좌표) | |
| Wave | amplitude 0 → 동일; 균일 이미지 불변; 한 줄 이미지의 열별 최댓값 위치 = `y0 + A·sin(...)` ±1; 타일 2장 이어 붙여 periods 2 = 1장 periods 1의 왼쪽 절반(이음새); 알파 255 | Zigzag + Wave 3×3 이음새 연속 |
| Bands | shift 0 → 동일; alternate 4띠 세로선 위치; progressive `i·S mod W`; taper 1 → 중앙 띠가 가장 얇고 높이 합 = H; random 시드 결정적; 알파 | Gradient Bars + Bands taper 0.8 "Boogie" 확인 |
| Fold | `px(x,y) == px(W−1−x,y)`; 왼쪽 절반 불변; both는 4방 대칭 | |
| Shade | strength 0 → 동일; 회색 200·dark·strength 100 → 중앙 행 0, 행 0 ≈ 200; light → 중앙 255; 행 0과 행 H−1 차 ≤ 2; axis x 전치 | Gradient Bars + Fold + Shade(이미지 18 구도) |
| Grain | pxPerUnit 2·size 2 → 2 px 블록(4 px 아님); 기존 결정성·진폭 테스트 유지 | 배율 4에서 1 px 입자 |
| Glyphs | 타일 크기 공식; 시드 결정성·시드별 차이; 모든 rect가 타일 안·슬롯 안; 200 시드에서 글리프 채움 비율 0.02–0.9; `symmetry: mirror`면 점유 격자 좌우 대칭; sequence 색 순환·mono 단색; 계열 필터별 생성 성공 | Randomize 연타로 형태 다양성, 내보내기 |
| 해시 생략 | 기본 효과 → 해시에 `effects` 없음; 하나 켜면 그 항목만; 디코드 왕복 = 전체 상태 | Copy link 길이 |
| 하프톤 부분 셀 | 20×12 회색 128 이미지에서 부분 셀 잉크 비율이 완전 셀과 ±0.2 이내; 검정은 전부 잉크 | |
| UI(jsdom) | §7 목록 | Effects 패널 소제목·순서 |
| 전체 | `npm test && npm run lint && npm run build` | 라이브 첫 화면·콘솔 오류 0 |

## 11. 구현 순서

1. `post/resample.ts` + `EffectDef.group` + `EFFECTS` 순서 자리 + Effects 패널 그룹 소제목.
2. Wave, Bands.
3. Fold, Shade.
4. Grain px + 하프톤 부분 셀 + §6.4 테스트.
5. `encodeState` 기본값 생략 + `namePrefix`.
6. jsdom 하네스 + UI 테스트 3파일.
7. Glyphs 생성기.
8. 브라우저 검증, 스크린샷 3장(`effects-wave-zigzag.png`, `effects-bands-boogie.png`, `09-glyphs.png`), README 영·한, 최종 리뷰 후 재배포.

## 12. 결정 기록

| 결정 | 대안 | 이유 |
|---|---|---|
| 2차 변조를 후처리 체인의 Warp 효과 그룹(래스터)으로 | Scene IR 기하 변조(벡터 보존), 생성기별 매개변수 | 생성기 9종 모두에 적용되고 이음새를 타일 주기로 보장하며 기존 효과 엔진을 재사용한다. 그라데이션 페인트와 명암 변조는 IR로 표현할 수 없다(사용자 선택) |
| Grain 크기를 출력 px로 | unit 0.25 확장, 단위 선택 | 필름 그레인은 출력 픽셀 단위가 자연스럽고 8192 px 내보내기에서도 세밀하다. 미리보기/내보내기 일치 예외는 README에 명시(사용자 선택) |
| Glyphs는 원시 도형 문법 | 26개 고정 라이브러리 | 참고 형태의 계열을 유지하면서 변형이 무한하다(사용자 선택) |
| 보류 항목은 v1.2 소형 4건 + jsdom 하네스 | v1.1 소형, Web Worker | Worker는 작업량이 크고 4 MP 상한이 이미 있다(사용자 선택) |
| Warp 순서 bands → wave → fold → shade 고정 | 사용자 정렬 | 재배열 → 굽힘 → 대칭 → 색의 순서가 참고 구도를 모두 만든다. 정렬 UI는 범위 밖 |
| Wave·Shade의 `periods`는 정수 | 실수 파장 | 정수 주기만 타일 이음새를 보장한다 |
