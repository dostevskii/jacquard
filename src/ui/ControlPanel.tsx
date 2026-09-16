import type { ReactNode } from 'react'
import type { GeneratorDef } from '../generators/types'
import type { Params, ParamValue } from '../core/params'
import type { Scene } from '../core/scene'
import type { TilePx } from '../render/canvas'
import { ParamControl } from './ParamControl'

interface Props {
  generator: GeneratorDef
  params: Params
  lockedKeys: string[]
  onParamChange(key: string, value: ParamValue): void
  onToggleLock(key: string): void
  onRandomizeParam(key: string): void
  scene: Scene
  tilePx: TilePx
  children?: ReactNode
}

export function ControlPanel({ generator, params, lockedKeys, onParamChange, onToggleLock, onRandomizeParam, scene, tilePx, children }: Props) {
  return (
    <aside className="panel">
      <section className="panel-section">
        <h2>Parameters</h2>
        {generator.params.map((def) => (
          <ParamControl
            key={def.key}
            def={def}
            value={params[def.key] ?? def.default}
            locked={lockedKeys.includes(def.key)}
            onChange={(v) => onParamChange(def.key, v)}
            onToggleLock={() => onToggleLock(def.key)}
            onRandomize={() => onRandomizeParam(def.key)}
          />
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
