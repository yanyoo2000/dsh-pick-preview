/* 为新包准备生成输入：从 npm-meta 提取描述与 README 摘要，拆成批次 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const HOME = process.env.USERPROFILE || process.env.HOME

const newCat = JSON.parse(fs.readFileSync(path.join(HOME, '.dsh/dsh-pick/catalog.json'), 'utf8'))
const oldCat = JSON.parse(fs.readFileSync(path.join(HERE, 'catalog.json'), 'utf8'))
const meta = JSON.parse(fs.readFileSync(path.join(HERE, 'npm-meta.json'), 'utf8'))

/** README → 一段干净摘要（同 prep.mjs） */
function excerpt(raw) {
  if (!raw) return ''
  let s = raw
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[!\[[^\]]*\]\([^)]*\)\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]{1,60})\]\([^)]*\)/g, '$1')
    .replace(/^\s*\|.*\|\s*$/gm, ' ')
    .replace(/^\s*```[\s\S]*?```/gm, ' ')
    .replace(/\n{2,}/g, '\n\n')
  const paras = s.split(/\n\s*\n/).map(p => p.replace(/^#+\s*/, '').trim())
    .filter(p => p && p.length > 24 && !/^[\s\-=*_|]+$/.test(p) && !/^(badge|license|install|安装|npm i|pnpm)/i.test(p))
  const out = []
  let total = 0
  for (const p of paras) {
    if (total + p.length > 900) break
    out.push(p)
    total += p.length
  }
  return out.join(' ').replace(/\s+/g, ' ').slice(0, 900)
}

const oldNames = new Set(Object.keys(oldCat.packages))
const fresh = Object.values(newCat.packages)
  .filter(r => !oldNames.has(r.n))
  .sort((a, b) => b.w - a.w)

const rows = fresh.map(r => {
  const m = meta[r.n] || {}
  const desc = (m.desc || r.d || '').replace(/\s+/g, ' ').trim()
  const kw = (m.keywords && m.keywords.length ? m.keywords : (r.kw || []))
    .filter(k => !/^(dsh|deepseek|harness|plugin)$/i.test(k)).slice(0, 8)
  return { n: r.n, cat: r.cat, w: r.w, desc: desc.slice(0, 300), kw: kw.join(','), readme: excerpt(m.readme || '') }
})

const A = rows.filter(x => x.readme.length > 80)
const B = rows.filter(x => x.readme.length <= 80)
console.log(`新增 ${rows.length}：A 档（有 README）${A.length}，B 档 ${B.length}`)

const dirB = path.join(HERE, 'batches2'), dirO = path.join(HERE, 'out2')
fs.rmSync(dirB, { recursive: true, force: true })
fs.rmSync(dirO, { recursive: true, force: true })
fs.mkdirSync(dirB, { recursive: true })
fs.mkdirSync(dirO, { recursive: true })

const manifest = []
const push = (kind, size, items) => {
  for (let i = 0; i < items.length; i += size) {
    const chunk = items.slice(i, i + size)
    const id = `${kind}-${String(manifest.filter(m => m.kind === kind).length + 1).padStart(3, '0')}`
    fs.writeFileSync(path.join(dirB, id + '.json'), JSON.stringify(chunk))
    manifest.push({ id, kind, size: chunk.length })
  }
}
push('a', 12, A)
push('b', 50, B)
fs.writeFileSync(path.join(HERE, 'manifest2.json'), JSON.stringify(manifest, null, 1))

const a = manifest.filter(m => m.kind === 'a'), b = manifest.filter(m => m.kind === 'b')
console.log(`A ${a.length} 批 / ${a.reduce((s, x) => s + x.size, 0)} 条`)
console.log(`B ${b.length} 批 / ${b.reduce((s, x) => s + x.size, 0)} 条`)
