/**
 * 目录层：把 data/catalog.json 的原始记录归一化成界面直接用得上的形状。
 *
 * 原始记录来自 dsh-pick 的 catalog.json，字段是压缩过的短名：
 *   n 包名 · v 版本 · d 描述 · w 周下载 · m 月下载 · cat 分类 · kw 关键词
 *   repo / home 仓库地址 · deep 去噪指标 · inst 本地安装信息
 *
 * 这里做三件事，都在数据层完成，界面不重复算：
 *   1. 补齐外链（npm / GitHub）
 *   2. 把 deep 里的指标提成扁平字段，界面不用层层判空
 *   3. 提供按指标排序、按分类过滤的选择器
 */

import rawCatalog from '../../data/catalog.json'
import rawIntro from '../../data/intro.json'

/** 排序指标。'w' 是唯一有全量数据的口径，其余只在 deep 覆盖的包里排。 */
export const METRICS = ['base', 'w', 'growth', 's']

/** 每个指标的说明文案，跟指标定义放在一起，避免分散到界面里 */
export const METRIC_META = {
  base: {
    label: '日常基线',
    cap: '日常基线已扣掉版本发布日与次日的拉取虚高，比原始下载量更接近真实使用量。',
    needsDeep: true,
  },
  w: {
    label: '周下载',
    cap: '原始周下载量，含 CI、镜像、爬虫等非人类流量，不等于用户数。',
    needsDeep: false,
  },
  growth: {
    label: '增速最快',
    cap: '近 7 日环比。只看增速会被小体量插件占满，配合基线和周下载一起看。',
    needsDeep: true,
  },
  s: {
    label: '健康度',
    cap: '健康度 = 日常基线 40% + 增速 25% + 新鲜度 20% + 版本节奏 15%，满分 100。',
    needsDeep: true,
  },
}

/** 榜单只展示前 N 名 */
export const TOP_N = 40

/* ---------------- 归一化 ---------------- */

/** 仓库地址 → GitHub 主页；不是 GitHub 就返回空串 */
function toGitHubUrl(repo, home) {
  let r = String(repo || '')
    .replace(/^git\+/, '')
    .replace(/\.git$/, '')
  if (r && !/^https?:\/\//.test(r)) r = ''
  const candidate = r || home || ''
  return /github\.com/.test(candidate) ? candidate : ''
}

/** 从 GitHub 地址取 owner，取不到退回 scoped 包名的第一段 */
export function ownerOf(record) {
  const m = String(record.ghUrl || '').match(/github\.com[/:]([^/\s]+)/i)
  if (m) return m[1]
  const scoped = String(record.name || '').match(/^@([^/]+)\//)
  return scoped ? scoped[1] : ''
}

/** 一条原始记录 → 界面记录 */
function normalize(record, introMap) {
  const deep = record.deep || null
  return {
    name: record.n,
    version: record.v,
    desc: record.d || '',
    weekly: record.w,
    monthly: record.m,
    cat: record.cat || '',
    keywords: record.kw || [],
    npmUrl: 'https://www.npmjs.com/package/' + String(record.n).replace('/', '%2F'),
    ghUrl: toGitHubUrl(record.repo, record.home),
    installed: record.inst || null,
    intro: introMap[record.n] || '',
    // 去噪指标：没有就整块是 null，界面据此判断该行能不能参与排
    deep: deep
      ? {
          base: deep.base,
          growth: deep.growth ?? null,
          cadence: deep.cadence ?? null,
          age: deep.age ?? null,
          lastRelease: deep.lastRelease || '',
          versions: deep.versions ?? null,
          score: deep.s,
        }
      : null,
  }
}

/* ---------------- 组装 ---------------- */

const records = Object.values(rawCatalog.packages)
  .filter((r) => r && r.n)
  .map((r) => normalize(r, rawIntro))

/** 全部插件，按周下载降序（也是默认的稳定顺序） */
export const plugins = records.slice().sort((a, b) => (b.weekly || 0) - (a.weekly || 0))

/** 目录元信息 */
export const catalogMeta = {
  anchor: rawCatalog.anchor,
  total: rawCatalog.total,
  deepCount: rawCatalog.deepCount,
  introCount: Object.keys(rawIntro).length,
  withDeep: records.filter((r) => r.deep).length,
}

/** 分类清单（按名字排序，过滤空分类） */
export const categories = [...new Set(records.map((r) => r.cat))]
  .filter(Boolean)
  .sort((a, b) => a.localeCompare(b, 'zh-CN'))

/* ---------------- 选择器 ---------------- */

/** 取某个指标的排序值；缺失的 growth 排到最后而不是当 0 */
function metricValue(record, metric) {
  if (metric === 'w') return record.weekly ?? -Infinity
  if (!record.deep) return -Infinity
  if (metric === 'growth') return record.deep.growth ?? -Infinity
  if (metric === 'base') return record.deep.base ?? -Infinity
  if (metric === 's') return record.deep.score ?? -Infinity
  return -Infinity
}

/**
 * 榜单选择器：这是界面唯一的数据入口。
 * @param {{metric: string, category?: string}} options
 * @returns {{
 *   rows: Array<{rank:number, plugin:object, value:number}>,
 *   poolSize: number,
 *   needsDeep: boolean,
 *   truncated: boolean,
 * }}
 */
export function selectRanking({ metric, category = '' } = {}) {
  const meta = METRIC_META[metric] || METRIC_META.base
  const needsDeep = meta.needsDeep

  let pool = plugins
  if (category) pool = pool.filter((r) => r.cat === category)
  if (needsDeep) pool = pool.filter((r) => r.deep)

  const sorted = pool
    .map((plugin) => ({ plugin, value: metricValue(plugin, metric) }))
    .sort((a, b) => b.value - a.value)

  const rows = sorted.slice(0, TOP_N).map((row, i) => ({ ...row, rank: i + 1 }))
  return {
    rows,
    poolSize: pool.length,
    needsDeep,
    truncated: pool.length > TOP_N,
  }
}

/** 页脚 / 报头用的口径说明，跟数据在一起，界面对号入座即可 */
export function selectFacts() {
  return {
    anchor: catalogMeta.anchor,
    total: catalogMeta.total,
    introCount: catalogMeta.introCount,
    withDeep: catalogMeta.withDeep,
    topN: TOP_N,
  }
}
