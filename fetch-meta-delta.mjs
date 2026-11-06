/* 只抓新增包的 npm 元数据，合并进已有的 npm-meta.json */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const HOME = process.env.USERPROFILE || process.env.HOME

const newCat = JSON.parse(fs.readFileSync(path.join(HOME, '.dsh/dsh-pick/catalog.json'), 'utf8'))
const oldCat = JSON.parse(fs.readFileSync(path.join(HERE, 'catalog.json'), 'utf8'))
const metaPath = path.join(HERE, 'npm-meta.json')
const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'))

const oldNames = new Set(Object.keys(oldCat.packages))
const fresh = Object.values(newCat.packages).filter(r => !oldNames.has(r.n)).sort((a, b) => b.w - a.w)

// 要抓 README 的：新增里周下载 Top 120 + 每个分类前 6 + 带去噪指标的
const want = new Set(fresh.slice(0, 120).map(r => r.n))
const byCat = new Map()
for (const r of fresh) {
  const n = byCat.get(r.cat) || 0
  if (n < 6) want.add(r.n)
  byCat.set(r.cat, n + 1)
}
for (const r of fresh) if (r.deep) want.add(r.n)

console.log(`新增 ${fresh.length} 个，要抓 README 的 ${want.size} 个`)
console.log(`已有元数据 ${Object.keys(meta).length} 条`)

let done = 0, fail = 0, idx = 0
async function worker() {
  while (idx < fresh.length) {
    const r = fresh[idx++]
    const name = r.n
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch('https://registry.npmjs.org/' + encodeURIComponent(name), {
          headers: { accept: 'application/json' },
          signal: AbortSignal.timeout(20000),
        })
        if (res.status === 404) { meta[name] = { missing: true }; break }
        if (!res.ok) throw new Error('HTTP ' + res.status)
        const j = await res.json()
        const latest = j['dist-tags'] && j['dist-tags'].latest
        meta[name] = {
          desc: j.description || '',
          readme: want.has(name) ? String(j.readme || '').slice(0, 6000) : '',
          keywords: Array.isArray(j.keywords) ? j.keywords.slice(0, 12) : [],
          repo: (j.repository && (j.repository.url || j.repository)) || '',
          home: j.homepage || '',
          latest,
          published: j.time && latest ? j.time[latest] : '',
        }
        break
      } catch (e) {
        if (attempt === 2) { fail++; }
        else await new Promise(x => setTimeout(x, 400 * (attempt + 1)))
      }
    }
    if (++done % 100 === 0) console.log(`  ${done}/${fresh.length}  失败 ${fail}`)
  }
}
await Promise.all(Array.from({ length: 12 }, worker))

fs.writeFileSync(metaPath, JSON.stringify(meta))
const withReadme = fresh.filter(r => (meta[r.n] || {}).readme).length
console.log(`完成 ${fresh.length}；带 README ${withReadme}；失败 ${fail}`)
console.log(`元数据总数 ${Object.keys(meta).length}  ${(fs.statSync(metaPath).size / 1e6).toFixed(1)} MB`)
