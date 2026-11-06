/* 预处理：把 README 压成摘要段，生成交给 AI 的输入（A 档含 README 摘录，B 档只有描述）
 *
 * 默认只处理 data/catalog.json 里还没有中文介绍的包（增量）。
 * 加 --all 重做全量。
 */
import fs from 'node:fs'
import path from 'node:path'
import { readData, writeJsonPretty, buildGenInput, WORK_DIR } from './_shared.mjs'

const ALL = process.argv.includes('--all')

const catalog = readData('catalog.json')
const meta = readData('npm-meta.json')

let existing = {}
if (!ALL) {
  try {
    existing = readData('intro.json')
  } catch {
    existing = {}
  }
}

const records = Object.values(catalog.packages)
  .filter((r) => r && r.n)
  .filter((r) => ALL || !existing[r.n])
  .sort((a, b) => b.w - a.w)

const rows = records.map((r) => buildGenInput(r, meta))
const A = rows.filter((x) => x.readme.length > 80)
const B = rows.filter((x) => x.readme.length <= 80)

fs.mkdirSync(WORK_DIR, { recursive: true })
writeJsonPretty(path.join(WORK_DIR, 'gen-input.json'), {
  all: rows,
  A: A.map((x) => x.n),
  B: B.map((x) => x.n),
})

console.log(`待生成 ${rows.length} 条；A 档（有 README 摘录）${A.length}；B 档 ${B.length}`)
if (A.length) {
  console.log(`A 档平均摘录 ${Math.round(A.reduce((s, x) => s + x.readme.length, 0) / A.length)} 字`)
  console.log('--- A 档样本 ---')
  for (const x of A.slice(0, 2)) console.log(x.n, '|', x.readme.slice(0, 240), '\n')
}
console.log(`\n下一步：node scripts/split.mjs`)
