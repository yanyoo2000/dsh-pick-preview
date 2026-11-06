import { useCallback, useEffect, useState } from 'react'
import { applyTheme, currentTheme, initialTheme } from '../data/theme.js'

/** 主题状态：只对外暴露当前值和切换函数，DOM 与 localStorage 细节留在数据层 */
export function useTheme() {
  const [theme, setTheme] = useState(initialTheme)

  // 首帧把 data-theme 落定，之后切换才不会有闪动
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  const toggle = useCallback(() => {
    const next = currentTheme() === 'dark' ? 'light' : 'dark'
    applyTheme(next)
    setTheme(next)
  }, [])

  return { theme, toggle }
}
