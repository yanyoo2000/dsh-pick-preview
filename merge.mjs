/* 合并各批结果，校验覆盖率与条数，产出 intro.json */
import fs from 'node:fs'
import path from 'node:path'

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\//, ''))
const manifest = JSON.parse(fs.readFileSync(path.join(HERE, 'manifest.json'), 'utf8'))
const cat = JSON.parse(fs.readFileSync(path.join(process.env.USERPROFILE || process.env.HOME, '.dsh/dsh-pick/catalog.json'), 'utf8'))

const intro = {}
const problems = []
for (const m of manifest) {
  const want = JSON.parse(fs.readFileSync(path.join(HERE, 'batches', m.id + '.json'), 'utf8'))
  let got = []
  try {
    let raw = fs.readFileSync(path.join(HERE, 'out', m.id + '.json'), 'utf8').trim()
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
    else intro[it.n] = s
  }
  if (got.length !== want.length) problems.push(`${m.id}: 条数 ${got.length}/${want.length}`)
}

// 长度体检
const lens = Object.values(intro).map(s => s.length).sort((a, b) => a - b)
const tooLong = Object.entries(intro).filter(([, s]) => s.length > 220)
const tooShort = Object.entries(intro).filter(([, s]) => s.length < 8)
console.log(`覆盖 ${Object.keys(intro).length} / ${Object.keys(cat.packages).length}`)
console.log(`长度：最小 ${lens[0]}  中位 ${lens[lens.length >> 1]}  90% ${lens[Math.floor(lens.length * 0.9)]}  最大 ${lens[lens.length - 1]}`)
console.log(`异常：过长 ${tooLong.length}，过短 ${tooShort.length}，问题 ${problems.length}`)
if (problems.length) console.log(problems.slice(0, 20).join('\n'))

fs.writeFileSync(path.join(HERE, 'intro.json'), JSON.stringify(intro))
console.log(`写盘 intro.json ${(fs.statSync(path.join(HERE, 'intro.json')).size / 1024).toFixed(0)} KB`)

// 抽样给人看
const sample = ['dsh-mnemon', 'dsh-pet', 'dsh-ops', 'dsh-cost-meter', 'dsh-claude-style', '@nanmicoder/dsh-agent-teams']
console.log('\n=== 抽样 ===')
for (const n of sample) if (intro[n]) console.log(`【${n}】${intro[n]}\n`)
