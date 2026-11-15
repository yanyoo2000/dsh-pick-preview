/**
 * 目录层：把 data/catalog.json 的原始记录归一化成界面直接用得上的形状。
 *
 * 原始记录来自 dsh-pick 的 catalog.json，字段是压缩过的短名：
 *   n 包名 · v 版本 · d 描述 · w 周下载 · m 月下载 · cat 分类 · kw 关键词
 *   t 发布时刻 · repo / home 仓库地址 · inst 安装信息
 *   gh GitHub 事实 · sc 综合分 · src 收录来源 · deep 去噪指标
 *
 * 这里做三件事，都在数据层完成，界面不重复算：
 *   1. 补齐外链（npm / GitHub）
 *   2. 把 deep / gh 里的指标提成扁平字段，界面不用层层判空
 *   3. 提供按指标排序、按分类 / 来源过滤的选择器
 */

import rawCatalog from '../../data/catalog.json'
import rawIntro from '../../data/intro.json'

/** 排序指标。'w' / 'stars' / 'sc' 覆盖面广；base / growth 只在 deep 覆盖的包里排。 */
export const METRICS = ['base', 'w', 'growth', 's', 'stars', 'sc']

/** 每个指标的说明文案，跟指标定义放在一起，避免分散到界面里 */
export const METRIC_META = {
  base: {
    label: '日常基线',
    cap: '日常基线已扣掉版本发布日与次日的拉取虚高，比原始下载量更接近真实使用量。只覆盖周下载 Top 332。',
    needsDeep: true,
    value: (r) => r.deep?.base ?? -Infinity,
    sortHeader: 'base',
  },
  w: {
    label: '周下载',
    cap: '原始周下载量，含 CI、镜像、爬虫等非人类流量，不等于用户数。全量覆盖。',
    needsDeep: false,
    value: (r) => r.weekly ?? -Infinity,
    sortHeader: 'w',
  },
  growth: {
    label: '增速最快',
    cap: '近 7 日环比。只看增速会被小体量插件占满，配合基线和周下载一起看。只覆盖周下载 Top 332。',
    needsDeep: true,
    value: (r) => r.deep?.growth ?? -Infinity,
    sortHeader: 'growth',
  },
  s: {
    label: '健康度',
    cap: '健康度 = 日常基线 40% + 增速 25% + 新鲜度 20% + 版本节奏 15%，满分 100。只覆盖周下载 Top 332。',
    needsDeep: true,
    value: (r) => r.deep?.score ?? -Infinity,
    sortHeader: 's',
  },
  stars: {
    label: 'GitHub 星标',
    cap: '仓库星标数。没有 GitHub 仓库的包不参与这个排法。',
    needsDeep: false,
    value: (r) => r.stars ?? -Infinity,
    sortHeader: 'stars',
  },
  sc: {
    label: '综合分',
    cap: 'dsh-pick 的综合分：使用 40% + 星标 20% + 维护 20% + 共识 10% + 健康 10%，满分 100。',
    needsDeep: false,
    value: (r) => r.score ?? -Infinity,
    sortHeader: 'sc',
  },
}

/** 榜单只展示前 N 名 */
export const TOP_N = 40

/**
 * 收录来源：同一个包可能同时出现在插件市场、社区目录、插件商店里。
 *
 * 注意这里只有 src 字段的真实取值。catalog.json 的 boards.official 里那 18 个
 * 官方插件（@deepseek-ai/…）不在 packages 里——它们不带 dsh-plugin 关键字——
 * 所以「官方」不是一个可筛的来源。
 */
export const SOURCE_LABELS = {
  dshmarket: '市场',
  shop: '商店',
  'dsh-m': '社区',
}

/* ---------------- 归一化 ---------------- */

/** 仓库地址 → GitHub 主页；不是 GitHub 就返回空串 */
function toGitHubUrl(repo, home, ghRepo) {
  let r = String(repo || '')
    .replace(/^git\+/, '')
    .replace(/\.git$/, '')
  if (r && !/^https?:\/\//.test(r)) r = ''
  const candidate = r || home || ''
  if (/github\.com/.test(candidate)) return candidate
  // gh.repo 是 owner/name 形式，没有 URL 时用它拼
  if (ghRepo && /^[\w.-]+\/[\w.-]+$/.test(ghRepo)) return 'https://github.com/' + ghRepo
  return ''
}

/** 从 GitHub 地址取 owner，取不到退回 gh.repo 的前段、再退回 scoped 包名 */
export function ownerOf(record) {
  const m = String(record.ghUrl || '').match(/github\.com[/:]([^/\s]+)/i)
  if (m) return m[1]
  if (record.ghRepo) return record.ghRepo.split('/')[0]
  const scoped = String(record.name || '').match(/^@([^/]+)\//)
  return scoped ? scoped[1] : ''
}

/** 一条原始记录 → 界面记录 */
function normalize(record, introMap) {
  const deep = record.deep || null
  const gh = record.gh || null
  return {
    name: record.n,
    version: record.v,
    desc: record.d || '',
    weekly: record.w,
    monthly: record.m,
    cat: record.cat || '',
    keywords: record.kw || [],
    published: record.t || '',
    npmUrl: 'https://www.npmjs.com/package/' + String(record.n).replace('/', '%2F'),
    ghUrl: toGitHubUrl(record.repo, record.home, gh && gh.repo),
    ghRepo: (gh && gh.repo) || '',
    installed: record.inst || null,
    intro: introMap[record.n] || '',
    // GitHub 事实：星标 / fork / 未关闭 issue / 最近提交 / 归档 / 许可证
    stars: gh && gh.s != null ? gh.s : null,
    forks: gh && gh.f != null ? gh.f : null,
    openIssues: gh && gh.i != null ? gh.i : null,
    lastPush: (gh && gh.p) || '',
    archived: Boolean(gh && gh.a),
    license: (gh && gh.l) || '',
    // 综合分与收录来源
    score: record.sc ?? null,
    sources: Array.isArray(record.src) ? record.src : [],
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
          // 30 天每日下载；null 是 npm 统计断档那几天，画图时跳过
          daily: Array.isArray(deep.daily) ? deep.daily : null,
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
  asOf: rawCatalog.asOf,
  total: rawCatalog.total,
  deepCount: rawCatalog.deepCount,
  introCount: Object.keys(rawIntro).length,
  withDeep: records.filter((r) => r.deep).length,
  withStars: records.filter((r) => r.stars != null).length,
  withScore: records.filter((r) => r.score != null).length,
}

/** 分类清单（按名字排序，过滤空分类） */
export const categories = [...new Set(records.map((r) => r.cat))]
  .filter(Boolean)
  .sort((a, b) => a.localeCompare(b, 'zh-CN'))

/** 收录来源清单（只保留实际出现的） */
export const sources = Object.keys(SOURCE_LABELS).filter((k) =>
  records.some((r) => r.sources.includes(k)),
)

/* ---------------- 选择器 ---------------- */

/**
 * 榜单选择器：这是界面唯一的数据入口。
 * @param {{metric: string, category?: string, source?: string}} options
 * @returns {{
 *   rows: Array<{rank:number, plugin:object, value:number}>,
 *   poolSize: number,
 *   needsDeep: boolean,
 *   truncated: boolean,
 * }}
 */
export function selectRanking({ metric, category = '', source = '' } = {}) {
  const meta = METRIC_META[metric] || METRIC_META.base
  const needsDeep = meta.needsDeep

  let pool = plugins
  if (category) pool = pool.filter((r) => r.cat === category)
  if (source) pool = pool.filter((r) => r.sources.includes(source))
  if (needsDeep) pool = pool.filter((r) => r.deep)

  const sorted = pool
    .map((plugin) => ({ plugin, value: meta.value(plugin) }))
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
    withStars: catalogMeta.withStars,
    withScore: catalogMeta.withScore,
    topN: TOP_N,
  }
}
