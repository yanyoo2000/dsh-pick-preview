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
