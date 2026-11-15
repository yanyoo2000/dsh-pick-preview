import { METRIC_META, METRICS, SOURCE_LABELS } from '../data/catalog.js'

/** 指标切换：一排下划线小签 + 右侧分类 / 来源下拉 */
export function MetricTabs({
  metric,
  onMetricChange,
  category,
  categories,
  onCategoryChange,
  source,
  sources,
  onSourceChange,
}) {
  return (
    <div className="filters">
      <div className="chips">
        {METRICS.map((key) => (
          <button
            key={key}
            type="button"
            className={`chip${key === metric ? ' on' : ''}`}
            data-m={key}
            aria-pressed={key === metric}
            onClick={() => onMetricChange(key)}
          >
            {METRIC_META[key].label}
          </button>
        ))}
      </div>
      <div className="selects">
        <select value={category} onChange={(e) => onCategoryChange(e.target.value)} aria-label="按分类筛选">
          <option value="">全部分类</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select value={source} onChange={(e) => onSourceChange(e.target.value)} aria-label="按收录来源筛选">
          <option value="">全部来源</option>
          {sources.map((s) => (
            <option key={s} value={s}>
              {SOURCE_LABELS[s] || s}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}

/** 当前排法的一句话说明 */
export function MetricCaption({ metric }) {
  return <p className="cap">{METRIC_META[metric]?.cap || ''}</p>
}
