/* 构建：把原版样式 + 精简目录 + 中文介绍 + 面板逻辑，拼成单文件 index.html
 *
 * 仓库里自带 panel.css 和 catalog.json，所以克隆下来直接 node build.mjs 就能重建，
 * 不依赖本机装没装 dsh-pick。要换新数据时，把新目录覆盖 catalog.json 即可。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const HOME = process.env.USERPROFILE || process.env.HOME
const PKG = path.join(HOME, '.dsh/profiles/desktop/node_modules/dsh-pick')

/* ---------- 1) 目录数据 ---------- */
const CANDIDATES = [
  path.join(HERE, 'catalog.json'),                  // 仓库自带（推荐）
  path.join(HOME, '.dsh/dsh-pick/catalog.json'),    // 插件的每日更新版
  path.join(PKG, 'data/catalog.json'),              // 插件包自带
]
const catalogPath = CANDIDATES.find(p => fs.existsSync(p))
if (!catalogPath) throw new Error('找不到 catalog.json')
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'))

/* ---------- 2) 归一化：排名与外链（照 lib/engine.js 的 normalize） ---------- */
const all = Object.values(catalog.packages).filter(r => r && r.n)
const byWeekly = all.slice().sort((a, b) => (b.w || 0) - (a.w || 0))
byWeekly.forEach((r, i) => { r.rank = i + 1 })
const byCat = new Map()
byWeekly.forEach(r => {
  if (!r.cat) return
  const n = (byCat.get(r.cat) || 0) + 1
  byCat.set(r.cat, n)
  r.crank = n
})
for (const r of all) {
  r.npmUrl = 'https://www.npmjs.com/package/' + r.n.replace('/', '%2F')
  let repo = (r.repo || '').replace(/^git\+/, '').replace(/\.git$/, '')
  if (repo && !/^https?:\/\//.test(repo)) repo = ''
  const gh = (repo || r.home || '')
  r.ghUrl = /github\.com/.test(gh) ? gh : ''
}

/* ---------- 3) 瘦身：只留页面要用的字段 ---------- */
const packages = {}
for (const r of all) {
  const d = r.deep
  packages[r.n] = {
    n: r.n, v: r.v, d: r.d, w: r.w, m: r.m, cat: r.cat,
    kw: r.kw || [],
    rank: r.rank, crank: r.crank, npmUrl: r.npmUrl, ghUrl: r.ghUrl,
    ...(d ? { deep: { base: d.base, growth: d.growth, cadence: d.cadence, age: d.age, lastRelease: d.lastRelease, versions: d.versions, s: d.s } } : {}),
    ...(r.inst ? { inst: r.inst } : {}),
  }
}
const slim = { anchor: catalog.anchor, total: catalog.total, deepCount: catalog.deepCount, packages }

/* ---------- 4) 本机装了哪些插件（用来显示「✓ 已安装 / 已装同类」） ---------- */
const NM = path.join(HOME, '.dsh/profiles/desktop/node_modules')
const installed = []
if (fs.existsSync(NM)) {
  for (const entry of fs.readdirSync(NM)) {
    const push = name => { if (packages[name] && !installed.includes(name)) installed.push(name) }
    try {
      if (entry.startsWith('@')) {
        for (const sub of fs.readdirSync(path.join(NM, entry))) push(`${entry}/${sub}`)
      } else push(entry)
    } catch { /* 读不动就跳过 */ }
  }
}

/* ---------- 5) 样式：仓库里的 panel.css（原版样式）+ extra.css（本页新增） ---------- */
function readPanelCss() {
  const local = path.join(HERE, 'panel.css')
  if (fs.existsSync(local)) return fs.readFileSync(local, 'utf8')
  const panelHtml = fs.readFileSync(path.join(PKG, 'web/panel.html'), 'utf8')
  return panelHtml.match(/<style>([\s\S]*?)<\/style>/)[1].trim()
}
const css = readPanelCss() + '\n\n' + fs.readFileSync(path.join(HERE, 'extra.css'), 'utf8')

/* ---------- 6) 中文介绍：包名 → 一段话 ---------- */
const intro = JSON.parse(fs.readFileSync(path.join(HERE, 'intro.json'), 'utf8'))

/* ---------- 7) 拼装 ---------- */
const json = o => JSON.stringify(o).replace(/</g, '\\u003c')
let html = fs.readFileSync(path.join(HERE, 'shell.html'), 'utf8')
html = html
  .replace('{{CSS}}', () => css)
  .replace('{{DATA}}', () => json(slim))
  .replace('{{INSTALLED}}', () => json(installed))
  .replace('{{INTRO}}', () => json(intro))
  .replace('{{JS}}', () => fs.readFileSync(path.join(HERE, 'panel.js'), 'utf8'))

const out = path.join(HERE, 'index.html')
fs.writeFileSync(out, html)
console.log(`目录：${catalogPath}（${catalog.anchor}，${catalog.total} 个包，${catalog.deepCount} 个带去噪指标）`)
console.log(`介绍：${Object.keys(intro).length} 条`)
console.log(`已装：${installed.join('、') || '（本机未检测到，不影响页面）'}`)
console.log(`输出：${out}  ${(fs.statSync(out).size / 1024).toFixed(0)} KB`)
