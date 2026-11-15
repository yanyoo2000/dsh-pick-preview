/* 抓 npm registry 完整元数据：完整 description（目录里被截到 160）+ 重点包的 README
 *
 * 默认只抓 data/catalog.json 里还没有元数据的包（增量）。
 * 加 --all 重新抓全量，覆盖已有记录。
 */
import fs from 'node:fs'
import path from 'node:path'
import { readData, writeData } from './_shared.mjs'

const ALL = process.argv.includes('--all')

const catalog = readData('catalog.json')
const all = Object.values(catalog.packages).sort((a, b) => b.w - a.w)

let meta = {}
if (!ALL) {
  try {
    meta = readData('npm-meta.json')
  } catch {
    meta = {}
  }
}

// 取 README 的范围：--readme-all 时全取（要给每个包写介绍），
// 否则只取重点包：周下载 Top 300 + 每个分类前 12 + 已装的
const README_ALL = process.argv.includes('--readme-all')
const TOP_N = 300
const picked = new Set(all.slice(0, TOP_N).map((r) => r.n))
const byCat = new Map()
for (const r of all) {
  const n = byCat.get(r.cat) || 0
  if (n < 12) picked.add(r.n)
  byCat.set(r.cat, n + 1)
}
const HOME = process.env.USERPROFILE || process.env.HOME
const NM = path.join(HOME, '.dsh', 'profiles', 'desktop', 'node_modules')
if (fs.existsSync(NM)) {
  for (const e of fs.readdirSync(NM)) {
    if (e.startsWith('@')) for (const s of fs.readdirSync(path.join(NM, e))) picked.add(`${e}/${s}`)
    else picked.add(e)
  }
}
const wantReadme = README_ALL ? new Set(all.map((r) => r.n)) : picked

/** 要抓的：没记录、404、没描述；--readme-all 模式下还补上「有记录但没存 README」的 */
const targets = all.filter((r) => {
  if (ALL) return true
  const m = meta[r.n]
  if (!m || m.missing || !m.desc) return true
  if (README_ALL && wantReadme.has(r.n) && !(m.readme && m.readme.length > 80)) return true
  return false
})

console.log(
  `目录共 ${all.length} 个包；本次要抓 ${targets.length} 个；其中取 README 的 ${wantReadme.size} 个`,
)

let done = 0
let fail = 0
let idx = 0
const SAVE_EVERY = 200

/** 边抓边存：中途断了重跑能接着来 */
function save() {
  writeData('npm-meta.json', meta)
}

async function fetchOne(name) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch('https://registry.npmjs.org/' + encodeURIComponent(name), {
        headers: { accept: 'application/json' },
        // 版本极多的包完整文档能到几十 MB，给足时间
        signal: AbortSignal.timeout(90000),
      })
      if (res.status === 404) return { missing: true }
      if (!res.ok) throw new Error('HTTP ' + res.status)
      const j = await res.json()
      const latest = j['dist-tags'] && j['dist-tags'].latest
      return {
        desc: j.description || '',
        readme: wantReadme.has(name) ? String(j.readme || '').slice(0, 6000) : '',
        keywords: Array.isArray(j.keywords) ? j.keywords.slice(0, 12) : [],
        repo: (j.repository && (j.repository.url || j.repository)) || '',
        home: j.homepage || '',
        latest,
        published: j.time && latest ? j.time[latest] : '',
      }
    } catch (e) {
      if (attempt === 2) throw e
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)))
    }
  }
}

async function worker() {
  while (idx < targets.length) {
    const record = targets[idx++]
    try {
      meta[record.n] = await fetchOne(record.n)
    } catch (e) {
      meta[record.n] = { error: String(e.message) }
      fail++
    }
    if (++done % SAVE_EVERY === 0) {
      save()
      console.log(`  ${done}/${targets.length}  失败 ${fail}`)
    }
  }
}

await Promise.all(Array.from({ length: 14 }, worker))

save()
const withReadme = Object.values(meta).filter((x) => x.readme).length
const ok = Object.values(meta).filter((x) => x.desc).length
const bad = Object.values(meta).filter((x) => x.error || x.missing).length
console.log(`元数据 ${Object.keys(meta).length} 条；有描述 ${ok}；带 README ${withReadme}`)
console.log(`本次失败 ${fail}；累计异常(404/报错) ${bad}`)
