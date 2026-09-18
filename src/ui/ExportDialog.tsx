import { useState } from 'react'
import type { Scene } from '../core/scene'
import type { PostOptions } from '../render/canvas'
import type { ExportFormat, ExportMode, ExportSettings } from '../render/export'
import { MAX_DIM, SIZE_PRESETS, clampTileScale, exceedsLimit, exportImage, outputSize } from '../render/export'

interface Props {
  open: boolean
  scene: Scene
  generator: string
  seed: number
  previewScale: number
  post: PostOptions
  onClose(): void
}

export function ExportDialog({ open, scene, generator, seed, previewScale, post, onClose }: Props) {
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
  // canvas 모드의 반복 타일은 MAX_DIM 안으로 낮춰 그리므로 안내도 같은 배율로 표시한다
  const tileScale = clampTileScale(scene, previewScale)

  const run = async () => {
    setBusy(true)
    setError(null)
    try {
      await exportImage(scene, generator, seed, settings, post)
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
        // 필드를 비운 순간 Number('') === 0이 커밋되지 않게 한다
        if (e.target.value === '') return
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
            <div className="info">
              Tile scale follows the preview: {tileScale.toFixed(2)}× ({Math.round(scene.width * tileScale)} × {Math.round(scene.height * tileScale)} px per tile)
              {tileScale < previewScale ? ` (clamped to ${MAX_DIM}px)` : ''}
            </div>
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
