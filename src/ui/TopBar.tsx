import { useEffect, useRef, useState } from 'react'
import type { GeneratorDef } from '../generators/types'
import { MAX_SEED } from '../core/prng'
import { DiceButton, DiceIcon } from './DiceButton'
import { LockButton, LockIcon } from './LockButton'
import type { Theme } from './theme'

interface Props {
  generators: GeneratorDef[]
  generatorId: string
  seed: number
  seedLocked: boolean
  onGeneratorChange(id: string): void
  onSeedChange(seed: number): void
  onRandomSeed(): void
  onToggleSeedLock(): void
  onRandomizeAll(): void
  onUnlockAll(): void
  anyLocked: boolean
  onCopyLink(): Promise<void> | void
  onExport(): void
  theme: Theme
  onToggleTheme(): void
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
    // 편집하지 않은 채 blur/Enter만 한 경우에는 시드를 다시 확정하지 않는다(의도치 않은 자동 잠금 방지)
    if (seedDraft === null) return
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
      <label className={`seed${p.seedLocked ? ' locked' : ''}`}>
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
      <DiceButton onClick={p.onRandomSeed} title="Randomize seed" />
      <LockButton locked={p.seedLocked} onToggle={p.onToggleSeedLock} label="the seed" />
      <button type="button" className="btn randomize" title="Randomize everything that is not locked" onClick={p.onRandomizeAll}>
        <DiceIcon /> Randomize
      </button>
      <button type="button" className="btn unlock-all" title="Unlock every value, color and the seed" onClick={p.onUnlockAll} disabled={!p.anyLocked}>
        <LockIcon locked={false} /> Unlock all
      </button>
      <div className="spacer" />
      <button
        type="button"
        className="icon-btn theme"
        title={p.theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
        aria-label={p.theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
        onClick={p.onToggleTheme}
      >
        {p.theme === 'light' ? (
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M11.5 9.5A5 5 0 0 1 6.5 4.5a5 5 0 0 0 5 8 5 5 0 0 0 3-1z" fill="currentColor" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
            <circle cx="8" cy="8" r="3" fill="currentColor" />
            <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.5 1.5M11.5 11.5 13 13M3 13l1.5-1.5M11.5 4.5 13 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        )}
      </button>
      <button type="button" className="btn" onClick={copyLink}>{COPY_LABEL[copied]}</button>
      <button type="button" className="btn primary" onClick={p.onExport}>Export</button>
    </header>
  )
}
