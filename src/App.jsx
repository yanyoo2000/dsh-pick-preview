import { useMemo, useState } from 'react'
import { Header } from './components/Header.jsx'
import { MetricCaption, MetricTabs } from './components/MetricTabs.jsx'
import { RankTable } from './components/RankTable.jsx'
import { Footer } from './components/Footer.jsx'
import { useTheme } from './hooks/useTheme.js'
import { categories, selectFacts, selectRanking, sources } from './data/catalog.js'

const facts = selectFacts()

export default function App() {
  const [metric, setMetric] = useState('base')
  const [category, setCategory] = useState('')
  const [source, setSource] = useState('')
  const { theme, toggle } = useTheme()

  // 界面不自己排序、不自己过滤——全部交给数据层的选择器
  const ranking = useMemo(
    () => selectRanking({ metric, category, source }),
    [metric, category, source],
  )

  const emptyText = ranking.needsDeep
    ? category || source
      ? '当前筛选下没有带去噪指标的插件，换到「周下载」或「综合分」可以看到全部。'
      : '没有可排的插件。'
    : category || source
      ? '当前筛选下没有插件。'
      : '没有可排的插件。'

  return (
    <div className="wrap">
      <Header facts={facts} theme={theme} onToggleTheme={toggle} />

      <div className="section">
        <MetricTabs
          metric={metric}
          onMetricChange={setMetric}
          category={category}
          categories={categories}
          onCategoryChange={setCategory}
          source={source}
          sources={sources}
          onSourceChange={setSource}
        />
        <MetricCaption metric={metric} />
        <RankTable rows={ranking.rows} metric={metric} emptyText={emptyText} />
      </div>

      <Footer facts={facts} />
    </div>
  )
}
