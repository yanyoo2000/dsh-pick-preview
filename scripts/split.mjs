/* 把输入拆成小批次文件，供并行生成用 */
import fs from 'node:fs'
import path from 'node:path'
import { readJson, writeJsonPretty, WORK_DIR } from './_shared.mjs'

const A_SIZE = 12
const B_SIZE = 55

const src = readJson(path.join(WORK_DIR, 'gen-input.json'))
const byName = new Map(src.all.map((x) => [x.n, x]))

const batchDir = path.join(WORK_DIR, 'batches')
const outDir = path.join(WORK_DIR, 'out')
for (const dir of [batchDir, outDir]) {
  fs.rmSync(dir, { recursive: true, force: true })
  fs.mkdirSync(dir, { recursive: true })
}

const manifest = []
const push = (kind, size, names) => {
  for (let i = 0; i < names.length; i += size) {
    const chunk = names.slice(i, i + size)
    const id = `${kind}-${String(manifest.filter((m) => m.kind === kind).length + 1).padStart(3, '0')}`
    fs.writeFileSync(path.join(batchDir, id + '.json'), JSON.stringify(chunk.map((n) => byName.get(n))))
    manifest.push({ id, kind, size: chunk.length })
  }
}
push('a', A_SIZE, src.A)
push('b', B_SIZE, src.B)

writeJsonPretty(path.join(WORK_DIR, 'manifest.json'), manifest)

const count = (kind) => {
  const list = manifest.filter((m) => m.kind === kind)
  return `${list.length} 批 / ${list.reduce((s, x) => s + x.size, 0)} 条`
}
console.log(`A 档 ${count('a')}`)
console.log(`B 档 ${count('b')}`)
console.log(`批次：${batchDir}`)
console.log(`模型产物放这里：${outDir}/<批次id>.json，格式 [{"n":"包名","s":"介绍"}]`)
