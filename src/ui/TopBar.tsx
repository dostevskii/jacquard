import { useState } from 'react'
import type { GeneratorDef } from '../generators/types'
import { MAX_SEED } from '../core/prng'

interface Props {
  generators: GeneratorDef[]
  generatorId: string
  seed: number
  onGeneratorChange(id: string): void
  onSeedChange(seed: number): void
  onRandomSeed(): void
  onCopyLink(): Promise<void> | void
  onExport(): void
}

export function TopBar(p: Props) {
  const [copied, setCopied] = useState(false)
  return (
    <header className="topbar">
      <div className="brand">Jacquard</div>
      <select className="select" value={p.generatorId} onChange={(e) => p.onGeneratorChange(e.target.value)} aria-label="Generator">
        {p.generators.map((g) => (
          <option key={g.id} value={g.id}>{g.name}</option>
        ))}
      </select>
      <label className="seed">
        Seed
        <input
          type="number"
          min={0}
          max={MAX_SEED}
          value={p.seed}
          onChange={(e) => {
            const n = Number(e.target.value)
            if (Number.isInteger(n) && n >= 0 && n <= MAX_SEED) p.onSeedChange(n)
          }}
        />
      </label>
      <button type="button" className="btn" title="Random seed" onClick={p.onRandomSeed}>🎲</button>
      <div className="spacer" />
      <button
        type="button"
        className="btn"
        onClick={async () => {
          await p.onCopyLink()
          setCopied(true)
          setTimeout(() => setCopied(false), 1200)
        }}
      >
        {copied ? 'Copied' : 'Copy link'}
      </button>
      <button type="button" className="btn primary" onClick={p.onExport}>Export</button>
    </header>
  )
}
