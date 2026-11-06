/* 共用工具：数据管线各步骤都要用的路径、读盘、README 摘要 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..')
const DATA_DIR = path.join(ROOT, 'data')
export const WORK_DIR = path.join(ROOT, '.work')

/** dsh-pick 插件自己维护的最新目录（本地装了才有） */
export function pickCatalogPath() {
  const HOME = process.env.USERPROFILE || process.env.HOME
  return path.join(HOME, '.dsh', 'dsh-pick', 'catalog.json')
}

export const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'))
const writeJson = (p, v) => fs.writeFileSync(p, JSON.stringify(v))
export const writeJsonPretty = (p, v) => fs.writeFileSync(p, JSON.stringify(v, null, 1))

/** 读仓库里的数据文件 */
export const readData = (name) => readJson(path.join(DATA_DIR, name))
export const writeData = (name, value) => writeJson(path.join(DATA_DIR, name), value)

/**
 * README → 一段干净摘要。
 * 原实现有两个字面完全相同的副本，合并在这里。
 */
function excerptReadme(raw, limit = 900) {
  if (!raw) return ''
  const cleaned = String(raw)
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ') // 图片
    .replace(/\[!\[[^\]]*\]\([^)]*\)\]\([^)]*\)/g, ' ') // badge 链接
    .replace(/\[([^\]]{1,60})\]\([^)]*\)/g, '$1') // 保留链接文字
    .replace(/^\s*\|.*\|\s*$/gm, ' ') // 表格行
    .replace(/^\s*```[\s\S]*?```/gm, ' ')
    .replace(/\n{2,}/g, '\n\n')

  const paragraphs = cleaned
    .split(/\n\s*\n/)
    .map((p) => p.replace(/^#+\s*/, '').trim())
    .filter(
      (p) =>
        p &&
        p.length > 24 &&
        !/^[\s\-=*_|]+$/.test(p) &&
        !/^(badge|license|install|安装|npm i|pnpm)/i.test(p),
    )

  const picked = []
  let total = 0
  for (const p of paragraphs) {
    if (total + p.length > limit) break
    picked.push(p)
    total += p.length
  }
  return picked.join(' ').replace(/\s+/g, ' ').slice(0, limit)
}

/** 从 npm 元数据 + 目录记录拼出生成输入（两套 prep 的共同逻辑） */
export function buildGenInput(record, meta) {
  const m = meta[record.n] || {}
  const desc = String(m.desc || record.d || '')
    .replace(/\s+/g, ' ')
    .trim()
  const keywords = (m.keywords && m.keywords.length ? m.keywords : record.kw || [])
    .filter((k) => !/^(dsh|deepseek|harness|plugin)$/i.test(k))
    .slice(0, 8)
  return {
    n: record.n,
    cat: record.cat,
    w: record.w,
    desc: desc.slice(0, 300),
    kw: keywords.join(','),
    readme: excerptReadme(m.readme || ''),
  }
}

/** 剥掉模型偶尔套上的 ```json 围栏 */
export function stripFence(raw) {
  return raw
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/, '')
    .trim()
}

/** 把 out 目录里各批结果合并成 { 包名: 介绍 }，同时报告问题 */
export function collectBatches({ manifest, batchDir, outDir }) {
  const intro = {}
  const problems = []
  for (const m of manifest) {
    const want = readJson(path.join(batchDir, m.id + '.json'))
    let got = []
    try {
      got = JSON.parse(stripFence(fs.readFileSync(path.join(outDir, m.id + '.json'), 'utf8')))
    } catch (e) {
      problems.push(`${m.id}: 解析失败 ${e.message}`)
      continue
    }
    const byName = new Map(got.filter((x) => x && x.n).map((x) => [x.n, String(x.s || '').trim()]))
    for (const item of want) {
      const text = byName.get(item.n)
      if (!text) problems.push(`${m.id}: 缺 ${item.n}`)
      else intro[item.n] = text
    }
    if (got.length !== want.length) problems.push(`${m.id}: 条数 ${got.length}/${want.length}`)
  }
  return { intro, problems }
}

/** 介绍长度体检 */
export function reportLengths(intro) {
  const lens = Object.values(intro)
    .map((s) => s.length)
    .sort((a, b) => a - b)
  if (!lens.length) return { min: 0, median: 0, max: 0, tooLong: 0, tooShort: 0 }
  return {
    min: lens[0],
    median: lens[lens.length >> 1],
    max: lens[lens.length - 1],
    tooLong: Object.values(intro).filter((s) => s.length > 220).length,
    tooShort: Object.values(intro).filter((s) => s.length < 8).length,
  }
}
