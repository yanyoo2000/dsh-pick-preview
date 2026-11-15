/** 数字 / 百分比 / 时间的展示口径，纯函数，无 DOM */

const EM_DASH = '—'

/** 千分位整数；null / undefined 一律显示破折号 */
export function num(n) {
  if (n === null || n === undefined) return EM_DASH
  return Number(n).toLocaleString('en-US')
}

/** 增减百分比：0.92 → +92%；null → 破折号 */
export function pct(n) {
  if (n === null || n === undefined) return EM_DASH
  return (n >= 0 ? '+' : '') + Math.round(n * 100) + '%'
}

/**
 * 大数字压成一眼能读的写法：9631 → 9.6k，96313 → 96k
 *
 * 星标列宽只有 62px，四位数带千分位刚好放得下，五位以上才压。
 * 阈值定在 10000 是为了让 dshmarket 这种万级星标仍显示 12.4k 而不是 12k。
 */
export function compact(n) {
  if (n === null || n === undefined) return EM_DASH
  const v = Number(n)
  if (!Number.isFinite(v)) return EM_DASH
  if (Math.abs(v) < 10000) return Number(v).toLocaleString('en-US')
  if (Math.abs(v) < 1000000) return (v / 1000).toFixed(1).replace(/\.0$/, '') + 'k'
  return (v / 1000000).toFixed(1).replace(/\.0$/, '') + 'M'
}

/** 距今天数 → 人话 */
export function ageText(age) {
  if (age === null || age === undefined) return EM_DASH
  if (age <= 0) return '今天'
  if (age === 1) return '昨天'
  if (age < 60) return `${age}天前`
  return `${Math.round(age / 30)}个月前`
}

/** 超过 90 天没发版就算停滞，页面上标橙色 */
export const STALE_DAYS = 90
export function isStale(age) {
  return age !== null && age !== undefined && age > STALE_DAYS
}
