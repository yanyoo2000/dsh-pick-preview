/* 预处理：把 README 压成摘要段，生成交给 AI 的输入清单（A 档含 README 摘录，B 档只有描述） */
import fs from 'node:fs'
import path from 'node:path'

const HOME = process.env.USERPROFILE || process.env.HOME
const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\//, ''))
const meta = JSON.parse(fs.readFileSync(path.join(HERE, 'npm-meta.json'), 'utf8'))
const cat = JSON.parse(fs.readFileSync(path.join(HOME, '.dsh/dsh-pick/catalog.json'), 'utf8'))
const all = Object.values(cat.packages).sort((a, b) => b.w - a.w)

/** README → 一段干净的中文/英文摘要 */
function excerpt(raw) {
  if (!raw) return ''
  let s = raw
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')            // 图片
    .replace(/\[!\[[^\]]*\]\([^)]*\)\]\([^)]*\)/g, ' ') // badge 链接
    .replace(/\[([^\]]{1,60})\]\([^)]*\)/g, '$1')      // 保留链接文字
    .replace(/^\s*\|.*\|\s*$/gm, ' ')                  // 表格行
    .replace(/^\s*```[\s\S]*?```/gm, ' ')
    .replace(/\n{2,}/g, '\n\n')
  // 去掉一级标题与纯英文 badge 行，取开头几段
  const paras = s.split(/\n\s*\n/).map(p => p.replace(/^#+\s*/, '').trim())
    .filter(p => p && p.length > 24 && !/^[\s\-=*_|]+$/.test(p) && !/^(badge|license|install|安装|npm i|pnpm)/i.test(p))
  const pickd = []
  let total = 0
  for (const p of paras) {
    if (total + p.length > 900) break
    pickd.push(p)
    total += p.length
  }
  return pickd.join(' ').replace(/\s+/g, ' ').slice(0, 900)
}

const out = []
for (const r of all) {
  const m = meta[r.n] || {}
  const desc = (m.desc || r.d || '').replace(/\s+/g, ' ').trim()
  const kw = (m.keywords && m.keywords.length ? m.keywords : (r.kw || [])).filter(k => !/^(dsh|deepseek|harness|plugin)$/i.test(k)).slice(0, 8)
  out.push({
    n: r.n, cat: r.cat, w: r.w,
    desc: desc.slice(0, 300),
    kw: kw.join(','),
    readme: excerpt(m.readme || ''),
  })
}

const A = out.filter(x => x.readme.length > 80)
const B = out.filter(x => x.readme.length <= 80)
fs.writeFileSync(path.join(HERE, 'gen-input.json'), JSON.stringify({ all: out, A: A.map(x => x.n), B: B.map(x => x.n) }))
console.log(`总数 ${out.length}；A 档（有 README 摘录）${A.length}；B 档 ${B.length}`)
console.log(`A 档平均摘录 ${Math.round(A.reduce((s, x) => s + x.readme.length, 0) / A.length)} 字`)
console.log('--- A 档样本 ---')
for (const x of A.slice(0, 2)) console.log(x.n, '|', x.readme.slice(0, 320), '\n')
