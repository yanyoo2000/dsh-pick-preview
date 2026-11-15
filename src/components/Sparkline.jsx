/**
 * 30 天每日下载量的迷你趋势线。
 *
 * 数据里有 null（npm 统计断档那几天），画的时候断开、不插值——
 * 硬连起来会让人以为那几天真有数据。
 *
 * 只画形状不画坐标轴：它的作用是「一眼看出是涨是跌还是抖」，
 * 具体数值看旁边的数字列。
 */

const W = 78
const H = 22

/**
 * @param {{daily: (number|null)[], label?: string}} props
 */
export function Sparkline({ daily, title }) {
  if (!Array.isArray(daily) || daily.length < 2) return null

  const values = daily.map((v) => (typeof v === 'number' && Number.isFinite(v) ? v : null))
  const present = values.filter((v) => v !== null)
  if (present.length < 2) return null

  const max = Math.max(...present)
  const min = Math.min(...present)
  const span = max - min || 1

  const stepX = W / (values.length - 1)
  const yOf = (v) => H - ((v - min) / span) * H

  // 把连续的有点段切成若干折线段，null 处断开
  const segments = []
  let current = []
  values.forEach((v, i) => {
    if (v === null) {
      if (current.length > 1) segments.push(current)
      current = []
    } else {
      current.push([i * stepX, yOf(v)])
    }
  })
  if (current.length > 1) segments.push(current)

  const toPath = (pts) => pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')

  // 首尾对比决定颜色：涨绿跌红，持平灰
  const first = present[0]
  const last = present[present.length - 1]
  const trend = last > first * 1.05 ? 'up' : last < first * 0.95 ? 'down' : 'flat'

  return (
    <svg
      className={`spark ${trend}`}
      viewBox={`0 0 ${W} ${H}`}
      width={W}
      height={H}
      preserveAspectRatio="none"
      role="img"
      aria-label={title || '近 30 天每日下载量趋势'}
    >
      {segments.map((pts, i) => (
        <path key={i} d={toPath(pts)} fill="none" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
      ))}
    </svg>
  )
}
