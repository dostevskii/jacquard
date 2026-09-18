import { useEffect, useMemo, useState } from 'react'
import type { PatternState } from './core/state'
import { decodeState, encodeState } from './core/state'
import type { ParamValue } from './core/params'
import { defaultParams } from './core/params'
import { DEFAULT_PALETTE, ensurePaletteLength } from './core/palettes'
import { clampSwatchLocks, clearParamLocks, emptyLocks, lockParam, toggleParamLock, toggleSeedLock } from './core/locks'
import { randomizeAll, randomParamValue } from './core/random'
import { mulberry32, randomSeed } from './core/prng'
import { DEFAULT_GENERATOR_ID, GENERATORS, generateScene, getGenerator } from './generators'
import { effectInfos } from './post'
import type { PostOptions } from './render/canvas'
import { tilePixelSize } from './render/canvas'
import { TopBar } from './ui/TopBar'
import { ControlPanel } from './ui/ControlPanel'
import { PalettePanel } from './ui/PalettePanel'
import { ExportDialog } from './ui/ExportDialog'
import { Preview } from './ui/Preview'
import type { ViewMode } from './ui/Preview'
import type { Theme } from './ui/theme'
import { applyTheme, browserStorage, loadTheme, saveTheme } from './ui/theme'

const resolve = (id: string) => {
  const g = getGenerator(id)
  return g ? { params: g.params, minColors: g.minColors } : undefined
}

export default function App() {
  const [pattern, setPattern] = useState<PatternState>(() =>
    decodeState(window.location.hash, resolve, { generator: DEFAULT_GENERATOR_ID, palette: DEFAULT_PALETTE, effectDefs: effectInfos() }),
  )
  const [view, setView] = useState<ViewMode>('fill')
  const [scale, setScale] = useState(1)
  const [exportOpen, setExportOpen] = useState(false)
  const [theme, setTheme] = useState<Theme>(() => loadTheme(browserStorage()))

  const generator = getGenerator(pattern.generator) ?? GENERATORS[0]
  const scene = useMemo(() => generateScene(pattern), [pattern])
  const tilePx = tilePixelSize(scene, scale)
  // 참조가 그대로여야 Preview의 그리기 효과가 매 렌더마다 다시 돌지 않는다
  const post: PostOptions = useMemo(
    () => ({ effects: pattern.effects, seed: pattern.seed, palette: pattern.palette }),
    [pattern.effects, pattern.seed, pattern.palette],
  )

  useEffect(() => {
    const t = setTimeout(() => {
      window.history.replaceState(null, '', `#${encodeState(pattern)}`)
    }, 300)
    return () => clearTimeout(t)
  }, [pattern])

  useEffect(() => {
    applyTheme(theme)
    saveTheme(browserStorage(), theme)
  }, [theme])

  const toggleTheme = () => setTheme((t) => (t === 'light' ? 'dark' : 'light'))

  // 사용자가 값을 실제로 바꾸면 그 매개변수는 잠긴다. 값이 그대로면 잠그지 않는다
  const setParam = (key: string, value: ParamValue) =>
    setPattern((p) => ({
      ...p,
      params: { ...p.params, [key]: value },
      locks: value === p.params[key] ? p.locks : lockParam(p.locks, key),
    }))

  // 개별 주사위: 값만 바꾸고 잠금은 건드리지 않는다
  const randomizeParam = (key: string) =>
    setPattern((p) => {
      const def = getGenerator(p.generator)?.params.find((d) => d.key === key)
      if (!def) return p
      return { ...p, params: { ...p.params, [key]: randomParamValue(def, mulberry32(randomSeed())) } }
    })

  const onToggleParamLock = (key: string) => setPattern((p) => ({ ...p, locks: toggleParamLock(p.locks, key) }))

  // 시드를 직접 입력해 값이 실제로 바뀌면 시드가 잠긴다
  const setSeed = (seed: number) =>
    setPattern((p) => ({ ...p, seed, locks: seed === p.seed ? p.locks : { ...p.locks, seed: true } }))
  const randomizeSeedOnly = () => setPattern((p) => ({ ...p, seed: randomSeed() }))
  const onToggleSeedLock = () => setPattern((p) => ({ ...p, locks: toggleSeedLock(p.locks) }))
  // 전역 Randomize: 잠기지 않은 시드·매개변수·스와치만
  const randomizeEverything = () =>
    setPattern((p) => randomizeAll(p, getGenerator(p.generator)?.params ?? [], mulberry32(randomSeed())))
  // 자동 잠금이 쌓여 Randomize가 아무것도 바꾸지 못할 때 한 번에 푼다
  const anyLocked = pattern.locks.seed || pattern.locks.params.length > 0 || pattern.locks.palette.length > 0
  const unlockAll = () => setPattern((p) => ({ ...p, locks: emptyLocks() }))

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

  return (
    <div className="app">
      <TopBar
        generators={GENERATORS}
        generatorId={pattern.generator}
        seed={pattern.seed}
        seedLocked={pattern.locks.seed}
        onGeneratorChange={selectGenerator}
        onSeedChange={setSeed}
        onRandomSeed={randomizeSeedOnly}
        onToggleSeedLock={onToggleSeedLock}
        onRandomizeAll={randomizeEverything}
        onUnlockAll={unlockAll}
        anyLocked={anyLocked}
        onCopyLink={() => navigator.clipboard.writeText(window.location.href)}
        onExport={() => setExportOpen(true)}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
      <div className="body">
        <ControlPanel
          generator={generator}
          params={pattern.params}
          lockedKeys={pattern.locks.params}
          onParamChange={setParam}
          onToggleLock={onToggleParamLock}
          onRandomizeParam={randomizeParam}
          scene={scene}
          tilePx={tilePx}
        >
          <PalettePanel
            palette={pattern.palette}
            locks={pattern.locks}
            minColors={generator.minColors}
            onChange={(palette, locks) => setPattern((p) => ({ ...p, palette, locks }))}
          />
        </ControlPanel>
        <Preview
          scene={scene}
          view={view}
          scale={scale}
          onViewChange={setView}
          onScaleChange={setScale}
          theme={theme}
          post={post}
        />
      </div>
      <ExportDialog
        open={exportOpen}
        scene={scene}
        generator={pattern.generator}
        seed={pattern.seed}
        previewScale={scale}
        post={post}
        onClose={() => setExportOpen(false)}
      />
    </div>
  )
}
