/* 合并新一批介绍，校验覆盖率，更新 catalog.json 与 intro.json */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const HOME = process.env.USERPROFILE || process.env.HOME

const manifest = JSON.parse(fs.readFileSync(path.join(HERE, 'manifest2.json'), 'utf8'))
const newCat = JSON.parse(fs.readFileSync(path.join(HOME, '.dsh/dsh-pick/catalog.json'), 'utf8'))
const oldCat = JSON.parse(fs.readFileSync(path.join(HERE, 'catalog.json'), 'utf8'))
const oldIntro = JSON.parse(fs.readFileSync(path.join(HERE, 'intro.json'), 'utf8'))

/* ---- 1) 合并新生成的介绍 ---- */
const fresh = {}
const problems = []
for (const m of manifest) {
  const want = JSON.parse(fs.readFileSync(path.join(HERE, 'batches2', m.id + '.json'), 'utf8'))
  let got = []
  try {
    let raw = fs.readFileSync(path.join(HERE, 'out2', m.id + '.json'), 'utf8').trim()
    raw = raw.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
    got = JSON.parse(raw)
  } catch (e) {
    problems.push(`${m.id}: 解析失败 ${e.message}`)
    continue
  }
  const byName = new Map(got.filter(x => x && x.n).map(x => [x.n, String(x.s || '').trim()]))
  for (const it of want) {
    const s = byName.get(it.n)
    if (!s) problems.push(`${m.id}: 缺 ${it.n}`)
    else fresh[it.n] = s
  }
  if (got.length !== want.length) problems.push(`${m.id}: 条数 ${got.length}/${want.length}`)
}

/* ---- 2) 组装新的 catalog.json（结构同 build.mjs 需要的） ---- */
const packages = {}
for (const r of Object.values(newCat.packages)) {
  const d = r.deep
  packages[r.n] = {
    n: r.n, v: r.v, d: r.d, w: r.w, m: r.m, cat: r.cat, kw: r.kw || [],
    repo: r.repo || '', home: r.home || '',
    ...(d ? { deep: { base: d.base, growth: d.growth, cadence: d.cadence, age: d.age, lastRelease: d.lastRelease, versions: d.versions, s: d.s } } : {}),
    ...(r.inst ? { inst: r.inst } : {}),
  }
}
const slim = { anchor: newCat.anchor, total: newCat.total, deepCount: newCat.deepCount, packages }
fs.writeFileSync(path.join(HERE, 'catalog.json'), JSON.stringify(slim))

/* ---- 3) 组装新的 intro.json：留下来的复用旧介绍，新包用新介绍 ---- */
const intro = {}
let reused = 0, added = 0
for (const name of Object.keys(packages)) {
  if (fresh[name]) { intro[name] = fresh[name]; added++ }
  else if (oldIntro[name]) { intro[name] = oldIntro[name]; reused++ }
}
fs.writeFileSync(path.join(HERE, 'intro.json'), JSON.stringify(intro))

/* ---- 4) 体检 ---- */
const missing = Object.keys(packages).filter(n => !intro[n])
const lens = Object.values(intro).map(s => s.length).sort((a, b) => a - b)
console.log(`目录 anchor: ${oldCat.anchor} → ${newCat.anchor}`)
console.log(`包数 ${Object.keys(packages).length}（旧 ${Object.keys(oldCat.packages).length}）`)
console.log(`介绍 ${Object.keys(intro).length}：新写 ${added}，复用 ${reused}，缺 ${missing.length}`)
console.log(`长度 中位 ${lens[lens.length >> 1]}  最长 ${lens[lens.length - 1]}`)
if (missing.length) console.log('缺介绍：', missing.slice(0, 20).join(', '))
if (problems.length) console.log('问题：\n' + problems.slice(0, 20).join('\n'))
