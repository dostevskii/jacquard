import type { ParamValue } from '../core/params'
import { bool, defaultParams } from '../core/params'
import type { EffectsState } from '../core/state'
import { EFFECTS } from '../post'
import { ParamControl } from './ParamControl'

interface Props {
  effects: EffectsState
  onParamChange(id: string, key: string, value: ParamValue): void
  onRandomizeParam(id: string, key: string): void
}

export function EffectsPanel({ effects, onParamChange, onRandomizeParam }: Props) {
  return (
    <section className="panel-section">
      <h2>Effects</h2>
      <div className="info">Applied top to bottom</div>
      {EFFECTS.map((def) => {
        const p = effects[def.id] ?? defaultParams(def.params)
        const enabled = bool(p, 'enabled')
        return (
          <div key={def.id} className={`effect${enabled ? ' on' : ''}`}>
            <label className="effect-head">
              <input type="checkbox" checked={enabled} onChange={(e) => onParamChange(def.id, 'enabled', e.target.checked)} />
              <span>{def.name}</span>
            </label>
            {enabled ? (
              <div className="effect-body">
                {def.params
                  .filter((d) => d.key !== 'enabled')
                  .map((d) => (
                    <ParamControl
                      key={d.key}
                      def={d}
                      value={p[d.key] ?? d.default}
                      lockable={false}
                      onChange={(v) => onParamChange(def.id, d.key, v)}
                      onRandomize={() => onRandomizeParam(def.id, d.key)}
                    />
                  ))}
              </div>
            ) : null}
          </div>
        )
      })}
    </section>
  )
}
