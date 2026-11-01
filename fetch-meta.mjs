/* 抓 npm registry 完整元数据：完整 description（目录里被截到 160）+ 重点包的 README */
import fs from 'node:fs'
import path from 'node:path'

const HOME = process.env.USERPROFILE || process.env.HOME
const CAT = path.join(HOME, '.dsh/dsh-pick/catalog.json')
const OUT = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\//, '')), 'npm-meta.json')

const cat = JSON.parse(fs.readFileSync(CAT, 'utf8'))
const all = Object.values(cat.packages).sort((a, b) => b.w - a.w)

// 重点包：周下载 Top 300 + 每个分类前 12 + 已装的
const TOP_N = 300
const picked = new Set(all.slice(0, TOP_N).map(r => r.n))
const byCat = new Map()
for (const r of all) {
  const n = byCat.get(r.cat) || 0
  if (n < 12) picked.add(r.n)
  byCat.set(r.cat, n + 1)
}
const NM = path.join(HOME, '.dsh/profiles/desktop/node_modules')
if (fs.existsSync(NM)) {
  for (const e of fs.readdirSync(NM)) {
    if (e.startsWith('@')) for (const s of fs.readdirSync(path.join(NM, e))) picked.add(`${e}/${s}`)
    else picked.add(e)
  }
}
const want = new Set(picked)

console.log(`总包 ${all.length}，要抓 README 的重点包 ${[...want].filter(n => cat.packages[n]).length}`)

const out = {}
let done = 0, fail = 0
const LIMIT = 14
let idx = 0

async function worker() {
  while (idx < all.length) {
    const r = all[idx++]
    const name = r.n
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch('https://registry.npmjs.org/' + encodeURIComponent(name), {
          headers: { accept: 'application/json' },
          signal: AbortSignal.timeout(20000),
        })
        if (res.status === 404) { out[name] = { missing: true }; break }
        if (!res.ok) throw new Error('HTTP ' + res.status)
        const j = await res.json()
        const latest = j['dist-tags'] && j['dist-tags'].latest
        out[name] = {
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
        if (attempt === 2) { out[name] = { error: String(e.message) }; fail++ }
        else await new Promise(r2 => setTimeout(r2, 400 * (attempt + 1)))
      }
    }
    if (++done % 200 === 0) console.log(`  ${done}/${all.length}  失败 ${fail}`)
  }
}

await Promise.all(Array.from({ length: LIMIT }, worker))
fs.writeFileSync(OUT, JSON.stringify(out))
const withReadme = Object.values(out).filter(x => x.readme).length
const ok = Object.values(out).filter(x => x.desc).length
console.log(`完成 ${Object.keys(out).length} 个；有描述 ${ok}；带 README ${withReadme}；失败 ${fail}`)
console.log(`输出 ${OUT} ${(fs.statSync(OUT).size / 1e6).toFixed(1)} MB`)
