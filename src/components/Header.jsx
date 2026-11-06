import { MoonIcon, SunIcon } from './Icons.jsx'
import { num } from '../data/format.js'

/** 报头：标题、口径摘要、明暗切换 */
export function Header({ facts, theme, onToggleTheme }) {
  const nextLabel = theme === 'dark' ? '切换到亮色主题' : '切换到暗色主题'
  return (
    <div className="bar">
      <div className="top">
        <div className="logo">Pick</div>
        <div>
          <h1>
            DSH 插件<span className="hl">排行</span>
          </h1>
          <div className="tagline">按去噪后的指标排：谁在被真正使用，一眼看得出来。</div>
        </div>
        <div className="meta">
          目录 <b>{num(facts.total)}</b> 个插件 · 去噪指标 <b>{num(facts.withDeep)}</b> 个
          <br />
          数据截止 <b>{facts.anchor}</b>（npm 统计滞后约 5 天）
        </div>
        <button className="theme" type="button" onClick={onToggleTheme} aria-label={nextLabel} title={nextLabel}>
          <SunIcon />
          <MoonIcon />
        </button>
      </div>
    </div>
  )
}
