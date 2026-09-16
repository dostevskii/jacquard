import { describe, it, expect } from 'vitest'
import type { ThemeStore } from './theme'
import { loadTheme, saveTheme, THEME_KEY } from './theme'

function store(initial: Record<string, string> = {}): ThemeStore & { data: Record<string, string> } {
  const data = { ...initial }
  return { data, getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = v } }
}

describe('loadTheme', () => {
  it('defaults to light when nothing is stored, the store is missing, or the value is junk', () => {
    expect(loadTheme(store())).toBe('light')
    expect(loadTheme(null)).toBe('light')
    expect(loadTheme(store({ [THEME_KEY]: 'blue' }))).toBe('light')
  })
  it('returns dark only for the exact value "dark"', () => {
    expect(loadTheme(store({ [THEME_KEY]: 'dark' }))).toBe('dark')
    expect(loadTheme(store({ [THEME_KEY]: 'Dark' }))).toBe('light')
  })
  it('survives a throwing store', () => {
    const bad: ThemeStore = { getItem: () => { throw new Error('denied') }, setItem: () => { throw new Error('denied') } }
    expect(loadTheme(bad)).toBe('light')
    expect(() => saveTheme(bad, 'dark')).not.toThrow()
  })
})

describe('saveTheme', () => {
  it('writes the theme under THEME_KEY and ignores a missing store', () => {
    const s = store()
    saveTheme(s, 'dark')
    expect(s.data[THEME_KEY]).toBe('dark')
    expect(() => saveTheme(null, 'light')).not.toThrow()
  })
})
