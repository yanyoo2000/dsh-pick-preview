import { METRIC_META, METRICS } from '../data/catalog.js'

/** 指标切换：一排下划线小签 + 右侧分类下拉 */
export function MetricTabs({ metric, onMetricChange, category, categories, onCategoryChange }) {
  return (
    <div className="filters">
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
      <select value={category} onChange={(e) => onCategoryChange(e.target.value)} aria-label="按分类筛选">
        <option value="">全部分类</option>
        {categories.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
    </div>
  )
}

/** 当前排法的一句话说明 */
export function MetricCaption({ metric }) {
  return <p className="cap">{METRIC_META[metric]?.cap || ''}</p>
}
