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
import { PalettePanel } from './ui/PalettePanel'
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
        <ControlPanel generator={generator} params={pattern.params} onParamChange={setParam} scene={scene} tilePx={tilePx}>
          <PalettePanel
            palette={pattern.palette}
            minColors={generator.minColors}
            onChange={(palette) => setPattern((p) => ({ ...p, palette }))}
          />
        </ControlPanel>
        <Preview scene={scene} view={view} scale={scale} onViewChange={setView} onScaleChange={setScale} />
      </div>
    </div>
  )
}
