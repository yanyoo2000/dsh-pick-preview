/* 构建收尾：把单文件产物复制到仓库根目录的 index.html，作为 GitHub Pages 入口 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..')
const CANDIDATES = ['app.html', 'index.html'].map((f) => path.join(ROOT, 'dist', f))
const src = CANDIDATES.find((p) => fs.existsSync(p))
const dst = path.join(ROOT, 'index.html')

if (!src) {
  console.error('找不到构建产物（dist/app.html），先跑 npm run build')
  process.exit(1)
}
fs.copyFileSync(src, dst)

const kb = (p) => (fs.statSync(p).size / 1024).toFixed(0)
console.log(`入口：index.html  ${kb(dst)} KB（单文件，样式/脚本/数据全部内联）`)
