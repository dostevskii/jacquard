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
