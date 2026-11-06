/* 合并各批结果，校验覆盖率与长度，写回 data/intro.json
 *
 * 老介绍默认保留，只有本批产出的新介绍才覆盖——新增包走增量时不会把旧结果冲掉。
 */
import fs from 'node:fs'
import path from 'node:path'
import {
  WORK_DIR,
  readData,
  writeData,
  readJson,
  collectBatches,
  reportLengths,
  INTRO_MAX,
} from './_shared.mjs'

const catalog = readData('catalog.json')
const manifest = readJson(path.join(WORK_DIR, 'manifest.json'))

let intro = {}
try {
  intro = readData('intro.json')
} catch {
  intro = {}
}
const before = Object.keys(intro).length

const { intro: fresh, problems } = collectBatches({
  manifest,
  batchDir: path.join(WORK_DIR, 'batches'),
  outDir: path.join(WORK_DIR, 'out'),
})

let added = 0
let replaced = 0
for (const [name, text] of Object.entries(fresh)) {
  if (intro[name]) replaced++
  else added++
  intro[name] = text
}

// 目录里已经没有的包，介绍也删掉，避免 intro.json 越滚越大
const alive = new Set(Object.keys(catalog.packages))
const dropped = Object.keys(intro).filter((n) => !alive.has(n))
for (const n of dropped) delete intro[n]

writeData('intro.json', intro)

const missing = [...alive].filter((n) => !intro[n])
const L = reportLengths(intro)

console.log(`介绍 ${before} → ${Object.keys(intro).length}：新写 ${added}，覆盖 ${replaced}，清掉失效 ${dropped.length}`)
console.log(`长度：最短 ${L.min}  中位 ${L.median}  最长 ${L.max}`)
console.log(`异常：过长 ${L.tooLong}，过短 ${L.tooShort}，批处理问题 ${problems.length}`)
if (missing.length) console.log(`目录里还缺介绍 ${missing.length} 个：${missing.slice(0, 10).join(', ')}`)
if (problems.length) console.log('问题：\n' + problems.slice(0, 20).join('\n'))
if (L.tooLong) console.log(`\n有 ${L.tooLong} 条超过 ${INTRO_MAX} 字，可跑 node scripts/apply-trim.mjs 压缩`)

console.log('\n下一步：npm run build')
