/** 明暗主题：读写 localStorage + 同步 documentElement，React 只关心一个字符串 */
export const THEME_KEY = 'dsh-pick-theme'

/** 当前实际生效的是亮还是暗 */
export function currentTheme() {
  const forced = document.documentElement.getAttribute('data-theme')
  if (forced === 'light' || forced === 'dark') return forced
  return prefersLight() ? 'light' : 'dark'
}

function prefersLight() {
  return Boolean(window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches)
}

/** 没手动选过就跟随系统，并把当前值定下来（之后系统变了也不动，避免和用户的选择打架） */
export function readSavedTheme() {
  let saved = null
  try {
    saved = localStorage.getItem(THEME_KEY)
  } catch {
    /* 隐私模式读不到，当没存过 */
  }
  return saved === 'light' || saved === 'dark' ? saved : null
}

export function applyTheme(next) {
  document.documentElement.setAttribute('data-theme', next)
  try {
    localStorage.setItem(THEME_KEY, next)
  } catch {
    /* 存不下就只管这次 */
  }
}

/** 初始主题：用户选过的优先，否则跟随系统 */
export function initialTheme() {
  return readSavedTheme() || (prefersLight() ? 'light' : 'dark')
}
