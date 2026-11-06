/* 把压缩后的长介绍合并进 intro.json */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const intro = JSON.parse(fs.readFileSync(path.join(HERE, 'intro.json'), 'utf8'))

const clean = raw => raw.trim()
  .replace(/^```(?:json)?/i, '')
  .replace(/```$/, '')
  .trim()

let n = 0
for (const id of ['trim-1', 'trim-2']) {
  const f = path.join(HERE, 'out2', id + '.json')
  if (!fs.existsSync(f)) { console.log(`缺 ${id}`); continue }
  let arr
  try { arr = JSON.parse(clean(fs.readFileSync(f, 'utf8'))) }
  catch (e) { console.log(`${id} 解析失败：${e.message}`); continue }
  for (const x of arr) if (x && x.n && x.s) { intro[x.n] = String(x.s).trim(); n++ }
}

fs.writeFileSync(path.join(HERE, 'intro.json'), JSON.stringify(intro))
const L = Object.values(intro).map(s => s.length).sort((a, b) => a - b)
console.log(`压缩 ${n} 条；最长 ${L[L.length - 1]}；>180 的 ${Object.values(intro).filter(s => s.length > 180).length}；覆盖 ${Object.keys(intro).length}`)
