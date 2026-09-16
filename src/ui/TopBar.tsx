import { useEffect, useRef, useState } from 'react'
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

type CopyState = 'idle' | 'ok' | 'fail'

const COPY_LABEL: Record<CopyState, string> = {
  idle: 'Copy link',
  ok: 'Copied',
  fail: 'Copy failed',
}

export function TopBar(p: Props) {
  const [copied, setCopied] = useState<CopyState>('idle')
  // 입력 중에만 draft를 들고 있고, 확정되면 null로 되돌려 바깥 시드(주사위 버튼)를 그대로 따라간다
  const [seedDraft, setSeedDraft] = useState<string | null>(null)
  const copyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const seedText = seedDraft ?? String(p.seed)

  useEffect(() => () => clearTimeout(copyTimer.current), [])

  const commitSeed = () => {
    setSeedDraft(null)
    const n = Number(seedText)
    if (seedText.trim() !== '' && Number.isInteger(n) && n >= 0 && n <= MAX_SEED) p.onSeedChange(n)
  }

  const copyLink = async () => {
    let next: CopyState
    try {
      await p.onCopyLink()
      next = 'ok'
    } catch {
      next = 'fail'
    }
    setCopied(next)
    clearTimeout(copyTimer.current)
    copyTimer.current = setTimeout(() => setCopied('idle'), 1200)
  }

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
          type="text"
          inputMode="numeric"
          value={seedText}
          onChange={(e) => setSeedDraft(e.target.value)}
          onBlur={commitSeed}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitSeed()
          }}
        />
      </label>
      <button type="button" className="btn" title="Random seed" onClick={p.onRandomSeed}>🎲</button>
      <div className="spacer" />
      <button type="button" className="btn" onClick={copyLink}>{COPY_LABEL[copied]}</button>
      <button type="button" className="btn primary" onClick={p.onExport}>Export</button>
    </header>
  )
}
