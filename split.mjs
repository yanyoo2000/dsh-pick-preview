/* 把输入拆成小批次文件，供并行生成用 */
import fs from 'node:fs'
import path from 'node:path'

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\//, ''))
const src = JSON.parse(fs.readFileSync(path.join(HERE, 'gen-input.json'), 'utf8'))
const byName = new Map(src.all.map(x => [x.n, x]))

const A_SIZE = 12, B_SIZE = 55
const dirB = path.join(HERE, 'batches'), dirO = path.join(HERE, 'out')
fs.rmSync(dirB, { recursive: true, force: true })
fs.rmSync(dirO, { recursive: true, force: true })
fs.mkdirSync(dirB, { recursive: true })
fs.mkdirSync(dirO, { recursive: true })

const manifest = []
const push = (kind, size, names) => {
  for (let i = 0; i < names.length; i += size) {
    const chunk = names.slice(i, i + size)
    const id = `${kind}-${String(manifest.filter(m => m.kind === kind).length + 1).padStart(3, '0')}`
    fs.writeFileSync(path.join(dirB, id + '.json'), JSON.stringify(chunk.map(n => byName.get(n))))
    manifest.push({ id, kind, size: chunk.length })
  }
}
push('a', A_SIZE, src.A)
push('b', B_SIZE, src.B)

fs.writeFileSync(path.join(HERE, 'manifest.json'), JSON.stringify(manifest, null, 1))
const a = manifest.filter(m => m.kind === 'a'), b = manifest.filter(m => m.kind === 'b')
console.log(`A 档 ${a.length} 批 / ${a.reduce((s, x) => s + x.size, 0)} 条`)
console.log(`B 档 ${b.length} 批 / ${b.reduce((s, x) => s + x.size, 0)} 条`)
console.log(`批次目录 ${dirB}`)
