import { Avatar } from './Avatar.jsx'
import { LinkButtons } from './Links.jsx'
import { ageText, isStale, num, pct } from '../data/format.js'

/**
 * 表格列固定，含义不随排序变化；当前排法用表头高亮 + 数值橙色标出来。
 *
 * 早先的版本是「第 4 列的数值跟着排序指标变」，结果按周下载排时第 4、5 列
 * 印的是同一个数，按增速排时「基线」表头下面装的是增速。列稳定下来就没这问题了。
 */

/** 更新一格：最近一次发版 + 平均发版节奏 */
function MaintCell({ deep }) {
  if (!deep) return <td className="r mt">—</td>
  const title = `最近一次发版 ${deep.lastRelease}${deep.cadence === null ? '' : ` · 平均 ${deep.cadence} 天发一个版本`}`
  return (
    <td className="r mt" title={title}>
      <div className={isStale(deep.age) ? 'stale' : undefined}>{ageText(deep.age)}</div>
      {deep.cadence === null ? null : <div className="sub">{deep.cadence}天/版</div>}
    </td>
  )
}

/** 一行的数据列。当前排序指标对应的那格加粗变色。 */
function DataCells({ plugin, metric }) {
  const deep = plugin.deep
  const growth = deep ? deep.growth : null
  const tone = growth === null ? '' : growth >= 0 ? ' up' : ' down'

  return (
    <>
      <td className={`r${metric === 'base' ? ' sorted' : ''}`}>
        {deep ? num(deep.base) : '—'}
      </td>
      <td className={`r${metric === 'w' ? ' sorted' : ''}`}>{num(plugin.weekly)}</td>
      <td className={`r${tone}${metric === 'growth' ? ' sorted' : ''}`}>{pct(growth)}</td>
      <td className={`r${metric === 's' ? ' sorted' : ''}`}>{deep ? deep.score : '—'}</td>
    </>
  )
}

/**
 * 榜单表格。
 * rows 已经排好序、已经截断，这里只负责画。
 */
export function RankTable({ rows, metric, emptyText }) {
  const head = (key, label, extra = '') => (
    <th className={`r${extra}${metric === key ? ' sorted' : ''}`}>{label}</th>
  )

  return (
    <div className="tblwrap">
      <table className="rank">
        <thead>
          <tr>
            <th>排名</th>
            <th>插件</th>
            <th>分类</th>
            {head('base', '基线')}
            {head('w', '周下载')}
            {head('growth', '环比')}
            {head('s', '健康')}
            <th className="r" title="最近一次发版 · 平均几天发一个版本">
              更新
            </th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={9} className="empty">
                {emptyText}
              </td>
            </tr>
          ) : (
            rows.map(({ rank, plugin }) => (
              <tr key={plugin.name}>
                <td>{String(rank).padStart(2, '0')}</td>
                <td className="nm">
                  <div className="nm-wrap">
                    <Avatar plugin={plugin} />
                    <div className="nm-main">
                      <div className="nm-t">
                        {plugin.name} <span className="v">v{plugin.version}</span>
                      </div>
                      {plugin.intro ? <div className="nm-sub">{plugin.intro}</div> : null}
                    </div>
                  </div>
                </td>
                <td>
                  <span className="catpill">{plugin.cat}</span>
                </td>
                <DataCells plugin={plugin} metric={metric} />
                <MaintCell deep={plugin.deep} />
                <LinkButtons plugin={plugin} />
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
