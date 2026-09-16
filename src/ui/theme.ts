export type Theme = 'light' | 'dark'

export const THEME_KEY = 'jacquard-theme'

export interface ThemeStore {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

/** 저장값이 정확히 'dark'일 때만 다크. 그 외(없음·깨짐·접근 불가)는 라이트 */
export function loadTheme(store: ThemeStore | null): Theme {
  try {
    return store?.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

export function saveTheme(store: ThemeStore | null, theme: Theme): void {
  try {
    store?.setItem(THEME_KEY, theme)
  } catch {
    // 사생활 모드 등으로 저장이 막히면 조용히 넘어간다
  }
}

export function browserStorage(): ThemeStore | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme
}
