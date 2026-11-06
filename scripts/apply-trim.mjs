/* 把压缩后的长介绍合并进 data/intro.json
 *
 * 用法：把模型压缩结果放到 .work/out/<批次id>.json，格式 [{"n":"包名","s":"更短的介绍"}]
 * 默认读 trim-* 批次，也可以用参数指定：node scripts/apply-trim.mjs trim-3 trim-4
 */
import fs from 'node:fs'
import path from 'node:path'
import { WORK_DIR, readData, writeData, stripFence, reportLengths } from './_shared.mjs'

const ids = process.argv.slice(2).filter((a) => !a.startsWith('-'))
const targets = ids.length ? ids : ['trim-1', 'trim-2']

const intro = readData('intro.json')
let n = 0

for (const id of targets) {
  const file = path.join(WORK_DIR, 'out', id + '.json')
  if (!fs.existsSync(file)) {
    console.log(`缺 ${id}，跳过`)
    continue
  }
  let rows
  try {
    rows = JSON.parse(stripFence(fs.readFileSync(file, 'utf8')))
  } catch (e) {
    console.log(`${id} 解析失败：${e.message}`)
    continue
  }
  for (const x of rows) {
    if (x && x.n && x.s) {
      intro[x.n] = String(x.s).trim()
      n++
    }
  }
}

writeData('intro.json', intro)

const L = reportLengths(intro)
console.log(`压缩 ${n} 条；最长 ${L.max}；超过 180 字的 ${Object.values(intro).filter((s) => s.length > 180).length}；覆盖 ${Object.keys(intro).length}`)
