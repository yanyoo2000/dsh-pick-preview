/* dsh-pick 选插件面板 · 离线界面复刻
   视觉与渲染逻辑照原版 web/panel.html + web/panel.js；
   数据源换成内联目录，+AI / 安装 / 刷新 这三个动作在离线环境里只给本地提示。 */

const CAT = window.__DSH_PICK_CATALOG__
const INSTALLED = new Set(window.__DSH_PICK_INSTALLED__ || [])
const INTRO = window.__DSH_PICK_INTRO__ || {}   // 包名 → 一段中文介绍
const IN_DSH = true          // 展示插件内嵌形态：卡片上带 +AI 与安装按钮
const CAN_INSTALL = true
const MARKET_COMPAT = false  // 没有插件市场接口，兼容性那一行不显示（原版同样如此）

let cands = []
let picked = []
let byScore = []
const $ = s => document.querySelector(s)
const WATCH_KEY = 'dsh-pick-watch-v1'

const PALETTE = ['#2f6bff', '#00a39a', '#f5a524', '#e2557b', '#8b5cf6', '#0f9d58', '#d97a06']
const colorOf = i => PALETTE[i % PALETTE.length]

const num = n => (n === null || n === undefined) ? '—' : Number(n).toLocaleString('en-US')
const pct = n => (n === null || n === undefined) ? '—' : (n >= 0 ? '+' : '') + Math.round(n * 100) + '%'
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

/* ---------------- 需求 → 搜索词（照 lib/words.js） ---------------- */
const STOP = new Set(['什么', '怎么', '如何', '可以', '一个', '我想', '我要', '需要', '有没有',
  'what', 'how', 'the', 'and', 'for', 'with', 'can', 'you', 'help', 'please', '插件', '东西', '工具', '功能'])

const SYNONYMS = {
  '数据库': ['sql', 'database', 'db', 'postgres', 'mysql', 'sqlite', 'redis', 'mongo'],
  '微信': ['wechat', 'wecom', 'weixin'],
  '企业微信': ['wecom', 'wechat'],
  '飞书': ['feishu', 'lark'],
  '通知': ['notify', 'notification', 'message', 'im'],
  '记忆': ['memory', 'context', 'recall', 'session'],
  '搜索': ['search', 'web-search', 'retrieval'],
  '远程': ['remote', 'ssh', 'vps', 'server'],
  '服务器': ['server', 'vps', 'ssh', 'host'],
  '部署': ['deploy', 'install', 'setup', 'self-hosted'],
  '美化': ['theme', 'skin', 'wallpaper', 'appearance', 'ui'],
  '界面': ['web-ui', 'ui', 'sidebar', 'theme', 'appearance'],
  '终端': ['terminal', 'tui', 'shell', 'cli'],
  '费用': ['cost', 'billing', 'usage', 'price', 'quota'],
  '统计': ['stats', 'meter', 'usage', 'audit'],
  '图片': ['image', 'vision', 'generation'],
  '视频': ['video', 'live', 'camera'],
  '语音': ['voice', 'audio', 'tts'],
  '安全': ['security', 'sandbox', 'auth', 'permission', 'safety'],
  '权限': ['permission', 'auth', 'approval'],
  '审查': ['review', 'audit', 'lint', 'diff'],
  '代码': ['code', 'git', 'diff', 'review', 'repo'],
  '文档': ['markdown', 'office', 'pdf', 'doc', 'note'],
  '模型': ['model', 'llm', 'provider', 'gateway'],
  '网关': ['gateway', 'router', 'proxy'],
  '插件': ['plugin', 'marketplace', 'install'],
  '智能体': ['agent', 'subagent', 'team'],
  '自动化': ['automation', 'workflow', 'schedule', 'task'],
  '备份': ['backup', 'archive', 'restore'],
  '导入': ['import', 'export', 'migrate'],
  '翻译': ['translate', 'i18n', 'lang'],
  '墙纸': ['wallpaper', 'background', 'skin'],
  '文件': ['file', 'fs', 'edit'],
  '管理': ['manager', 'manage', 'admin'],
}
const FILLER = /我想|我要|想要|帮我|给我|有没有|能不能|有什么|一个|一款|装个|装一个|安装|需要|什么|怎么|如何|可以|插件|工具|东西|功能|哪个|哪些|好用|推荐|的|吗|呢/g

function expandWords(need) {
  const raw = String(need || '').toLowerCase()
    .split(/[\s,，、。？?！!/；;：:()（）"'《》【】\[\]+]+/)
    .flatMap(w => (/[\u4e00-\u9fa5]/.test(w) ? w.replace(FILLER, ' ').split(/\s+/) : [w]))
    .map(w => w.trim())
    .filter(w => w.length >= 2 && !STOP.has(w))

  const best = new Map()
  const add = (w, weight) => { if ((best.get(w) || 0) < weight) best.set(w, weight) }
  for (const w of raw) {
    add(w, 3)
    const syn = SYNONYMS[w]
    if (syn) for (const s of syn) add(s, 2)
    if (/[\u4e00-\u9fa5]/.test(w)) {
      for (const key of Object.keys(SYNONYMS)) {
        if (key !== w && w.includes(key)) {
          add(key, 3)
          for (const s of SYNONYMS[key]) add(s, 2)
        }
      }
      if (w.length >= 4) for (let i = 0; i + 2 <= w.length; i++) add(w.slice(i, i + 2), 1)
    }
  }
  return [...best].map(([w, weight]) => ({ w, weight }))
}

/* ---------------- 提示条 ---------------- */
let toastTimer = 0
function toast(text, command) {
  const el = $('#toast')
  el.innerHTML = esc(text) + (command ? `<code>${esc(command)}</code>` : '')
  el.classList.add('on')
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => el.classList.remove('on'), command ? 9000 : 3500)
}

/* ---------------- +AI：把这一块整理成一段话 ---------------- */
const dataAsOf = () => `（dsh-pick 数据，截止 ${CAT.anchor}；下载量含 CI / 镜像流量，不等于用户数）`
const TAIL = '需要更多数据可以用 pick_search / pick_stats / pick_compare 查。先只分析，不要安装。'
const needLine = () => {
  const need = $('#need').value.trim()
  return need ? `我的需求：${need}` : null
}

function factLine(r) {
  const d = r.deep
  return [
    `周下载 ${num(r.w)}`,
    d ? `日常基线 ${num(d.base)}` : '无去噪指标（周下载 Top 之外）',
    d ? `近 7 日环比 ${pct(d.growth)}` : '',
    d && d.cadence != null ? `${d.cadence} 天/版` : '',
    d && d.age != null ? `${d.age} 天前更新` : '',
    d ? `健康度 ${d.s}` : '',
    r.rank ? `总榜 #${r.rank}` : '',
  ].filter(Boolean).join(' · ')
}

function askCard(r) {
  return [
    `帮我看看 DSH 插件 ${r.n}（v${r.v}，${r.cat}）值不值得装。`,
    needLine(),
    `简介：${String(r.d || '').slice(0, 200)}`,
    `数据${dataAsOf()}：${factLine(r)}`,
    '',
    `请说说它适不适合我、有什么风险、有没有更好的替代。${TAIL}`,
  ].filter(x => x != null).join('\n')
}

function askCands() {
  return [
    `我在找 DSH 插件，需求是「${$('#need').value.trim()}」。dsh-pick 找到这些候选${dataAsOf()}：`,
    ...cands.map((r, i) => `${i + 1}. ${r.n}（${r.cat}）— ${factLine(r)} — ${String(r.d || '').slice(0, 80)}`),
    '',
    `请帮我挑出最合适的 1~2 个并说明理由，不合适的也说一句为什么。${TAIL}`,
  ].join('\n')
}

function askVerdict() {
  const rows = picked.map(n => CAT.packages[n]).filter(Boolean)
  const rule = $('#verdicts').innerText.trim().replace(/\n+/g, ' / ')
  return [
    `帮我在这几个 DSH 插件里做个选择${dataAsOf()}。`,
    needLine(),
    ...rows.map(r => `- ${r.n}（${r.cat}）：${factLine(r)}`),
    rule ? `dsh-pick 的规则结论（只按数字算的，仅供参考）：${rule}` : null,
    '',
    `请结合我的需求重新判断：选哪个、为什么、什么情况下该选别的。${TAIL}`,
  ].filter(x => x != null).join('\n')
}

function askWatch() {
  const rows = watch().map(watchRec).filter(Boolean)
  return [
    `帮我看看我关注的这些 DSH 插件最近怎么样${dataAsOf()}：`,
    ...rows.map(r => `- ${r.n}（${r.cat}）：${factLine(r)}`),
    '',
    `谁在涨、谁停更了、有没有该换掉的？${TAIL}`,
  ].join('\n')
}

/** 原版把这段话交给外层写进对话；离线版复制到剪贴板，让人看得到它到底产出什么 */
function askAI(text, label) {
  let copied = false
  try { copied = Boolean(navigator.clipboard && navigator.clipboard.writeText) } catch { copied = false }
  if (copied) navigator.clipboard.writeText(text).catch(() => {})
  console.log('[dsh-pick · 会发到对话的内容]\n' + text)
  const flat = text.replace(/\s+/g, ' ').trim()
  const short = flat.length > 96 ? flat.slice(0, 96) + '…' : flat
  toast(`原版会把这段（${text.length} 字）发到当前 DSH 对话${copied ? '，这里已复制到剪贴板' : ''}：${short}`)
}

/* ---------------- 能不能装 ---------------- */
const COMPAT = new Map()
const HOST_VERSION = null

function sameKindInstalled(r) {
  if (!r.cat || r.cat === '其他' || INSTALLED.has(r.n)) return []
  return [...INSTALLED].filter(n => n !== r.n && n !== 'dsh-pick' && CAT.packages[n] && CAT.packages[n].cat === r.cat)
}

function installCheck(r) {
  const warn = []
  const good = []
  let ok = true
  const inst = r.inst
  if (inst && !inst.b) { ok = false; warn.push('没声明 dsh.bundle，DSH 装不了') }
  if (inst && inst.p && inst.p !== 'web') { ok = false; warn.push(`${inst.p} 客户端插件，装进这里可能让 DSH 起不来`) }
  const c = MARKET_COMPAT ? COMPAT.get(r.n) : null
  if (c && c.status === 'incompatible') {
    ok = false
    warn.push(`和你的 DSH${HOST_VERSION ? ' ' + HOST_VERSION : ''} 不兼容${c.requirement ? `（需要 ${c.requirement}）` : ''}`)
  } else if (c && c.status === 'compatible' && ok) {
    good.push(`兼容你的 DSH${HOST_VERSION ? ' ' + HOST_VERSION : ''}`)
  }
  const same = sameKindInstalled(r)
  if (same.length) warn.push(`你已装同类：${same.join('、')}`)
  return { ok, warn, good }
}

function checkRow(r, { skipSame = false } = {}) {
  if (!IN_DSH) return ''
  let { warn, good } = installCheck(r)
  // 全部插件页卡多，「你已装同类」会铺满整屏；那里只留装不掉的硬性原因
  if (skipSame) warn = warn.filter(t => !t.startsWith('你已装同类'))
  if (!warn.length && !good.length) return ''
  return `<div class="chk">` +
    good.map(t => `<span class="good">✓ ${esc(t)}</span>`).join('') +
    warn.map(t => `<span class="warn">⚠ ${esc(t)}</span>`).join('') +
    `</div>`
}

function installArea(r) {
  if (!IN_DSH) return ''
  if (INSTALLED.has(r.n)) return '<span class="badge-in">✓ 已安装</span>'
  if (!CAN_INSTALL) return ''
  if (!installCheck(r).ok) return '<span class="badge-no" title="原因见卡片上的提醒">不能安装</span>'
  return `<button class="inst" data-install="${esc(r.n)}" title="用 DSH 的插件管理器安装">安装</button>`
}

function onInstallClick(btn) {
  const name = btn.dataset.install
  if (!btn.classList.contains('confirm')) {
    btn.classList.add('confirm')
    btn.textContent = '确认安装？'
    setTimeout(() => {
      if (btn.isConnected && btn.classList.contains('confirm') && !btn.disabled) {
        btn.classList.remove('confirm'); btn.textContent = '安装'
      }
    }, 4000)
    return
  }
  btn.classList.remove('confirm')
  btn.textContent = '安装'
  toast(`原版会交给 DSH 的插件管理器执行，装完重启 DSH 生效：`, `dsh plugin --profile web add ${name}`)
}

/* ---------------- 介绍：中文一段话 + npm 原文一行 ---------------- */
function introOf(rec) { return INTRO[rec.n] || '' }

function aboutBlock(rec) {
  const zh = introOf(rec)
  return (zh ? `<div class="zh" title="${esc(zh)}">${esc(zh)}</div>` : '') +
    `<div class="src" title="${esc(rec.d || '')}">${esc(rec.d)}</div>`
}

/* ---------------- 全部插件 ---------------- */
let ALL_PAGE = 0
const ALL_SIZE = 48

function buildAllCat() {
  const sel = $('#allCat')
  const cats = [...new Set(Object.values(CAT.packages).map(p => p.cat))].filter(Boolean).sort()
  sel.innerHTML = '<option value="">全部分类</option>' + cats.map(c => `<option>${esc(c)}</option>`).join('')
}

function allCard(r) {
  const d = r.deep
  return `<div class="cand plain">` +
    `<div class="body">` +
      `<div class="nm">${esc(r.n)} <span class="v">v${esc(r.v)}</span>` +
        `<span class="rel">${esc(r.cat)}</span>` +
        (d ? '<span class="ok" title="有去噪指标">✓ 可比较</span>' : '<span class="nook" title="周下载 Top 之外，缺基线/环比/节奏">仅基础</span>') +
      `</div>` +
      `<div class="rk">${rankText(r)}</div>` +
      aboutBlock(r) +
      `<div class="kv">` +
        `<span>周 <b>${num(r.w)}</b></span>` +
        `<span>月 <b>${num(r.m)}</b></span>` +
        (d ? `<span>基线 <b>${num(d.base)}</b></span><span>环比 <b>${pct(d.growth)}</b></span>` : '') +
      `</div>` +
      checkRow(r, { skipSame: true }) +
      `<div class="links">${linkBtns(r)}<span class="sp"></span>${installArea(r)}</div>` +
    `</div></div>`
}

function renderAll() {
  const q = $('#allQ').value.trim().toLowerCase()
  const cat = $('#allCat').value
  const sort = $('#allSort').value

  let rows = Object.values(CAT.packages).filter(r => (!cat || r.cat === cat))
  if (q) {
    rows = rows.filter(r => {
      const hay = (r.n + ' ' + introOf(r) + ' ' + (r.kw || []).join(' ') + ' ' + (r.d || '')).toLowerCase()
      return hay.includes(q)
    })
  }
  const val = r => sort === 'base' ? (r.deep ? r.deep.base : -1)
    : sort === 's' ? (r.deep ? r.deep.s : -1)
    : sort === 'age' ? (r.deep && r.deep.age != null ? -r.deep.age : -1e9)
    : r.w
  rows.sort((a, b) => val(b) - val(a))

  const total = rows.length
  const pages = Math.max(1, Math.ceil(total / ALL_SIZE))
  if (ALL_PAGE > pages - 1) ALL_PAGE = 0
  const slice = rows.slice(ALL_PAGE * ALL_SIZE, (ALL_PAGE + 1) * ALL_SIZE)

  $('#allCount').textContent = `${num(total)} 个${q || cat ? ' · 已筛选' : ''}`
  $('#allList').innerHTML = slice.length
    ? slice.map(allCard).join('')
    : '<div class="empty">没有匹配的插件，换个词试试。</div>'
  renderPager(pages)
}

function renderPager(pages) {
  const host = $('#allPager')
  if (pages <= 1) { host.innerHTML = ''; return }
  const btn = (p, label, cls) => `<button data-p="${p}"${cls || ''}>${label}</button>`
  const parts = [ALL_PAGE > 0 ? btn(ALL_PAGE - 1, '上一页') : btn(0, '上一页', ' disabled')]
  const nums = new Set([0, pages - 1, ALL_PAGE, ALL_PAGE - 1, ALL_PAGE + 1])
  const list = [...nums].filter(n => n >= 0 && n < pages).sort((a, b) => a - b)
  let last = -1
  for (const n of list) {
    if (last >= 0 && n - last > 1) parts.push('<span class="gap">…</span>')
    parts.push(btn(n, String(n + 1), n === ALL_PAGE ? ' class="on"' : ''))
    last = n
  }
  parts.push(ALL_PAGE < pages - 1 ? btn(ALL_PAGE + 1, '下一页') : btn(pages - 1, '下一页', ' disabled'))
  host.innerHTML = parts.join('')
}

/* ---------------- 排名文案与外链 ---------------- */
function rankText(rec) {
  if (!rec.rank) return ''
  const total = `总榜 #<b>${num(rec.rank)}</b>`
  const cat = rec.crank ? ` · ${esc(rec.cat)} #<b>${num(rec.crank)}</b>` : ''
  return total + cat
}

const GH_SVG = '<svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.4 7.4 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A7.99 7.99 0 0 0 16 8c0-4.42-3.58-8-8-8z"/></svg>'
const NPM_SVG = '<svg viewBox="0 0 16 16" width="13" height="13"><path fill="#cb3837" d="M0 0h16v16H0z"/><path fill="#fff" d="M3 3h10v10h-2.5V5.5H8V13H3z"/></svg>'

function linkBtns(rec, { icon = false } = {}) {
  const npm = rec.npmUrl || ('https://www.npmjs.com/package/' + rec.n)
  const cls = icon ? 'lk ic' : 'lk'
  let h = ''
  if (rec.ghUrl) {
    h += `<a class="${cls}" href="${esc(rec.ghUrl)}" target="_blank" rel="noopener" title="GitHub：${esc(rec.ghUrl)}" aria-label="GitHub">${GH_SVG}${icon ? '' : 'GitHub'}</a>`
  }
  h += `<a class="${cls}" href="${esc(npm)}" target="_blank" rel="noopener" title="npm：${esc(npm)}" aria-label="npm">${NPM_SVG}${icon ? '' : 'npm'}</a>`
  return h
}

function ageText(age) {
  if (age == null) return '—'
  if (age <= 0) return '今天'
  if (age === 1) return '昨天'
  if (age < 60) return `${age}天前`
  return `${Math.round(age / 30)}个月前`
}

function maintCell(d) {
  if (!d) return '<td class="r mt">—</td>'
  const stale = d.age != null && d.age > 90
  const cad = d.cadence == null ? '' : `<div class="sub">${d.cadence}天/版</div>`
  return `<td class="r mt" title="最近一次发版 ${d.lastRelease || ''}${d.cadence == null ? '' : ` · 平均 ${d.cadence} 天发一个版本`}">` +
    `<div${stale ? ' class="stale"' : ''}>${ageText(d.age)}</div>${cad}</td>`
}

/* ---------------- 搜索 ---------------- */
function searchByNeed(need, limit = 10) {
  const terms = expandWords(need)
  if (!terms.length || !CAT) return []

  const maxWeight = terms.reduce((t, s) => t + s.weight, 0)
  const out = []
  for (const rec of Object.values(CAT.packages)) {
    // 介绍文本也参与匹配：原版只搜包名 / 关键词 / 描述，中文需求常常落空
    const hay = ((rec.n || '') + ' ' + (rec.kw || []).join(' ') + ' ' + (rec.d || '') + ' ' + introOf(rec)).toLowerCase()
    let hit = 0, any = false
    for (const t of terms) if (hay.includes(t.w)) { hit += t.weight; any = true }
    if (!any) continue
    const relevance = hit / maxWeight
    const pop = Math.log10(Math.max(rec.w, 1)) / 6
    out.push({ rec, relevance, score: relevance * 0.85 + pop * 0.15 })
  }
  out.sort((a, b) => b.score - a.score)
  return out.slice(0, limit).map(x => x.rec)
}

/* ---------------- 启动 ---------------- */
function boot() {
  const deepN = Object.values(CAT.packages).filter(p => p.deep).length
  $('#meta').innerHTML =
    `目录 <b>${num(CAT.total)}</b> 个插件 · 去噪指标 <b>${num(deepN)}</b> 个<br>` +
    `数据截止 <b>${CAT.anchor}</b>（npm 统计滞后约 5 天）`

  $('#foot').innerHTML =
    `<b>口径：</b>下载量含 CI、镜像、爬虫等非人类流量，不等于用户数；<b>日常基线</b>= 扣掉版本发布日与次日后的每日中位数，比原始下载量更接近真实使用量。<br>` +
    `<b>介绍：</b>每段中文介绍由该插件自己的 npm 描述和 README 整理而成，讲用途和主要能力——不是官方文档，具体用法以插件仓库为准。<br>` +
    `<b>覆盖范围：</b>npm 上带 <code>dsh-plugin</code> 关键字的 ${num(CAT.total)} 个包，全部配了介绍；去噪指标只算了周下载 Top ${num(deepN)}。<br>` +
    `<b>本页：</b>原版面板的离线复刻（同 CSS、同渲染逻辑、同一份目录数据），另加了「全部」页签和每个插件的介绍。原版装在 DSH 里时，「+AI」把内容发到当前对话、「安装」交给 DSH 插件管理器；离线版这两处只做提示。`

  buildCategoryFilter()
  buildAllCat()
  renderRank()
  renderAll()
  renderWatch()
  bindEvents()

  // 首屏演示一次完整流程，省得看到空页面
  $('#need').value = '记忆'
  doSearch()
}

function bindEvents() {
  $('#btnFind').addEventListener('click', doSearch)
  $('#need').addEventListener('keydown', e => { if (e.key === 'Enter') doSearch() })

  document.querySelectorAll('.examples .chip').forEach(c => {
    c.addEventListener('click', () => { $('#need').value = c.textContent; doSearch() })
  })

  document.querySelectorAll('#tabs button').forEach(b => {
    b.addEventListener('click', () => {
      document.querySelectorAll('#tabs button').forEach(x => x.classList.toggle('on', x === b))
      const t = b.dataset.tab
      document.querySelectorAll('#tabs button').forEach(x => $('#tab-' + x.dataset.tab).classList.toggle('hidden', x.dataset.tab !== t))
    })
  })

  document.querySelectorAll('#rankFilters .chip').forEach(c => {
    c.addEventListener('click', () => {
      document.querySelectorAll('#rankFilters .chip').forEach(x => x.classList.toggle('on', x === c))
      renderRank()
    })
  })
  $('#rankCat').addEventListener('change', renderRank)

  // 全部插件页
  let allTimer = 0
  $('#allQ').addEventListener('input', () => {
    clearTimeout(allTimer)
    allTimer = setTimeout(() => { ALL_PAGE = 0; renderAll() }, 160)
  })
  $('#allCat').addEventListener('change', () => { ALL_PAGE = 0; renderAll() })
  $('#allSort').addEventListener('change', () => { ALL_PAGE = 0; renderAll() })
  $('#allPager').addEventListener('click', e => {
    const b = e.target.closest('button[data-p]')
    if (!b || b.disabled) return
    ALL_PAGE = Number(b.dataset.p)
    renderAll()
    $('#allList').scrollIntoView({ block: 'start', behavior: 'smooth' })
  })
  $('#allList').addEventListener('click', e => {
    const inst = e.target.closest('[data-install]')
    if (inst) { e.stopPropagation(); onInstallClick(inst) }
  })

  $('#aiCands').addEventListener('click', () => cands.length && askAI(askCands()))
  $('#aiVerdict').addEventListener('click', () => picked.length >= 2 && askAI(askVerdict()))
  $('#aiWatch').addEventListener('click', () => watch().length && askAI(askWatch()))
  $('#btnWatchRefresh').addEventListener('click', refreshWatch)

  $('#btnExport').addEventListener('click', exportHtml)
  $('#btnWatch').addEventListener('click', addPickedToWatch)
}

/* ---------------- 第 2 步：候选 ---------------- */
function doSearch() {
  const need = $('#need').value.trim()
  if (!need) return
  cands = searchByNeed(need, 10)
  renderCands(need)
}

function renderCands(need) {
  const host = $('#cands')
  host.innerHTML = ''
  if (!cands.length) {
    host.innerHTML = '<div class="empty">目录里没找到相关的。换个说法试试，比如「数据库」「微信」「记忆」。</div>'
    $('#secCand').classList.remove('hidden')
    return
  }

  cands.forEach((rec, i) => {
    const on = picked.includes(rec.n)
    const d = rec.deep
    const el = document.createElement('div')
    el.className = 'cand' + (on ? ' on' : '')
    el.innerHTML =
      `<div class="box">${on ? '✓' : ''}</div>` +
      `<div class="body">` +
        `<div class="nm">${esc(rec.n)} <span class="v">v${esc(rec.v)}</span>` +
        `<span class="rel">${esc(rec.cat)}</span>` +
        (d ? '<span class="ok" title="有去噪指标，可参与健康度比较">✓ 可比较</span>' : '<span class="nook" title="未进入去噪范围（周下载 Top 之外），缺基线/环比/节奏">仅基础</span>') +
        `</div>` +
        `<div class="rk">${rankText(rec)}</div>` +
        aboutBlock(rec) +
        `<div class="kv">` +
          `<span>周 <b>${num(rec.w)}</b></span>` +
          `<span>月 <b>${num(rec.m)}</b></span>` +
          (d ? `<span>基线 <b>${num(d.base)}</b></span><span>环比 <b>${pct(d.growth)}</b></span>` : '') +
        `</div>` +
        checkRow(rec) +
        `<div class="links">${linkBtns(rec)}<span class="sp"></span>${installArea(rec)}` +
          (IN_DSH ? `<button class="ai" data-ask title="把这个插件的数据发到对话里问 AI">+AI</button>` : '') +
        `</div>` +
      `</div>`
    el.addEventListener('click', e => {
      const ask = e.target.closest('[data-ask]')
      if (ask) { e.stopPropagation(); askAI(askCard(rec)); return }
      const inst = e.target.closest('[data-install]')
      if (inst) { e.stopPropagation(); onInstallClick(inst); return }
      if (e.target.closest('a')) return
      togglePick(rec.n)
    })
    host.appendChild(el)
  })

  $('#secCand').classList.remove('hidden')
  $('#candCount').textContent = `「${esc(need)}」命中 ${cands.length} 个 · 已选 ${picked.length}`
}

function togglePick(name) {
  if (picked.includes(name)) picked = picked.filter(x => x !== name)
  else {
    if (picked.length >= 6) { toast('最多比较 6 个'); return }
    picked.push(name)
  }
  renderCands($('#need').value.trim())
  renderCompare()
}

/* ---------------- 第 3 步：比较 ---------------- */
const ROWS = [
  { k: 'w',      label: '周下载',      get: r => r.w,            fmt: num,  best: 'max' },
  { k: 'm',      label: '月下载',      get: r => r.m,            fmt: num,  best: 'max' },
  { k: 'base',   label: '日常基线',    get: r => r.deep && r.deep.base, fmt: num, best: 'max' },
  { k: 'growth', label: '近 7 日环比', get: r => r.deep && r.deep.growth, fmt: pct, best: 'max' },
  { k: 'ver',    label: '版本数',      get: r => r.deep && r.deep.versions, fmt: num, best: 'max' },
  { k: 'cad',    label: '版本节奏',    get: r => r.deep && r.deep.cadence, fmt: r => r == null ? '—' : r + ' 天/版', best: 'min' },
  { k: 'age',    label: '最近更新',    get: r => r.deep && r.deep.age, fmt: r => r == null ? '—' : r + ' 天前', best: 'min' },
  { k: 's',      label: '健康度',      get: r => r.deep && r.deep.s, fmt: num, best: 'max' },
]

function renderCompare() {
  const sec = $('#secCmp')
  if (picked.length < 2) {
    sec.classList.add('hidden')
    $('#secVerdict').classList.add('hidden')
    $('#candCount').textContent = `「${esc($('#need').value.trim())}」命中 ${cands.length} 个 · 已选 ${picked.length}（选满 2 个开始比较）`
    return
  }

  const rows = picked.map(n => CAT.packages[n]).filter(Boolean)
  const missingDeep = rows.filter(r => !r.deep).length

  $('#cmpHead').innerHTML = '<tr><th>指标</th>' +
    rows.map((r, i) => `<th><i style="background:${colorOf(picked.indexOf(r.n))}"></i>${esc(r.n)}</th>`).join('') +
    '</tr>'

  let body = ''
  for (const row of ROWS) {
    const vals = rows.map(r => row.get(r))
    const valid = vals.filter(v => v !== null && v !== undefined && !Number.isNaN(v))
    let bestV = null
    if (valid.length) bestV = row.best === 'max' ? Math.max(...valid) : Math.min(...valid)

    body += `<tr><td>${row.label}</td>` + vals.map(v => {
      const isBest = bestV !== null && v === bestV
      const cls = v === null || v === undefined ? 'miss' : (isBest ? 'best num' : 'num')
      return `<td class="${cls}">${row.fmt(v)}</td>`
    }).join('') + '</tr>'
  }
  $('#cmpBody').innerHTML = body

  $('#cmpNote').innerHTML =
    `健康度 = 日常基线 40% + 增速 25% + 新鲜度 20% + 版本节奏 15%，满分 100。` +
    (missingDeep ? `<br><span style="color:var(--warn-text)">其中 ${missingDeep} 个未进入深挖范围（周下载 Top 榜外），去噪指标缺失，无法参与健康度比较。</span>` : '')

  sec.classList.remove('hidden')
  renderVerdict()
}

/* ---------------- 第 4 步：结论 ---------------- */
function renderVerdict() {
  const rows = picked.map(n => CAT.packages[n]).filter(Boolean)
  const withDeep = rows.filter(r => r.deep)
  const noDeep = rows.filter(r => !r.deep)

  if (withDeep.length < 2) {
    $('#verdicts').innerHTML =
      `<div class="verdict alt" style="margin:0"><h4>给不出结论</h4><p>` +
      `已选 ${rows.length} 个，其中 <b>${withDeep.length}</b> 个有去噪指标。` +
      (noDeep.length ? `<b>${noDeep.map(r => esc(r.n)).join('、')}</b> 未进入去噪范围（周下载 Top 之外），缺日常基线、环比、版本节奏，无法参与健康度比较。<br>` : '') +
      `至少需要 2 个带「✓ 可比较」标记的包。上面排行榜里按「日常基线 / 健康度」排序的就是这批。</p></div>`
    $('#secVerdict').classList.remove('hidden')
    return
  }

  byScore = withDeep.slice().sort((a, b) => b.deep.s - a.deep.s)
  const win = byScore[0]
  const others = byScore.slice(1)
  const alt = others.slice().sort((a, b) => b.deep.base - a.deep.base)[0]
  const no = byScore[byScore.length - 1]

  const winName = esc(win.n)
  const html = []

  html.push(`<div class="verdict win"><h4>✅ 首选 ${winName}</h4><p>` +
    `日常基线 <b>${num(win.deep.base)}</b> 次/天（已扣掉发布拉取），` +
    `近 7 日环比 <b>${pct(win.deep.growth)}</b>，` +
    `${win.deep.versions} 个版本、约 <b>${win.deep.cadence === null ? '—' : win.deep.cadence + ' 天'}</b>一个，` +
    `最近更新在 <b>${win.deep.age} 天前</b>，健康度 <b>${win.deep.s}</b>。` +
    `${win.deep.growth !== null && win.deep.growth > 0 ? '仍在涨。' : '体量最大且维护稳定。'}</p></div>`)

  if (alt && alt !== win) {
    html.push(`<div class="verdict alt"><h4>⚡ 备选 ${esc(alt.n)}</h4><p>` +
      `日常基线 <b>${num(alt.deep.base)}</b> 次/天，环比 <b>${pct(alt.deep.growth)}</b>，` +
      `最近更新 <b>${alt.deep.age} 天前</b>，健康度 <b>${alt.deep.s}</b>。` +
      (alt.deep.growth !== null && alt.deep.growth > (win.deep.growth || 0)
        ? '如果你更看重势头而不是体量，选它。'
        : '如果你更看重大家已经在用的稳定度，可以改选它。') + `</p></div>`)
  }

  if (no !== win && byScore.length >= 3) {
    const baseTxt = no.deep.base > 0
      ? `，日常基线 ${num(no.deep.base)} 次/天，只有首选的 ${Math.round(no.deep.base / Math.max(win.deep.base, 1) * 100)}%`
      : `，日常基线为 0 次/天`
    html.push(`<div class="verdict no"><h4>⚠️ 不推荐 ${esc(no.n)}</h4><p>` +
      `健康度 <b>${no.deep.s}</b>（本组最低）` +
      (no.deep.age > 90 ? `，<b>${no.deep.age} 天没发新版本</b>，可能已进入维护停滞。` : '') +
      baseTxt + `。</p></div>`)
  }

  $('#verdicts').innerHTML = html.join('')
  $('#secVerdict').classList.remove('hidden')
}

/* ---------------- 排行榜 ---------------- */
function buildCategoryFilter() {
  const sel = $('#rankCat')
  const cats = [...new Set(Object.values(CAT.packages).map(p => p.cat))].filter(Boolean).sort()
  sel.innerHTML = '<option value="">全部分类</option>' + cats.map(c => `<option>${esc(c)}</option>`).join('')
}

function renderRank() {
  const metric = document.querySelector('#rankFilters .chip.on').dataset.m
  const cat = $('#rankCat').value
  const onlyDeep = metric !== 'w'

  let rows = Object.values(CAT.packages).filter(r => (!cat || r.cat === cat) && (!onlyDeep || r.deep))
  const val = r => metric === 'base' ? r.deep.base
    : metric === 'growth' ? (r.deep.growth === null ? -Infinity : r.deep.growth)
    : metric === 's' ? r.deep.s
    : r.w
  rows.sort((a, b) => val(b) - val(a))
  rows = rows.slice(0, 40)

  $('#rankBody').innerHTML = rows.map((r, i) => {
    const d = r.deep
    const g = d ? d.growth : null
    return `<tr>` +
      `<td style="color:var(--t3)">${i + 1}</td>` +
      `<td class="nm">${esc(r.n)} <span style="color:var(--t3);font-weight:400;font-size:11px">v${esc(r.v)}</span>` +
        (introOf(r) ? `<div class="nm-sub" title="${esc(introOf(r))}">${esc(introOf(r))}</div>` : '') +
      `</td>` +
      `<td><span class="catpill">${esc(r.cat)}</span></td>` +
      `<td class="r"><b>${num(val(r))}</b></td>` +
      `<td class="r">${num(r.w)}</td>` +
      `<td class="r ${g === null ? '' : (g >= 0 ? 'up' : 'down')}">${pct(g)}</td>` +
      maintCell(d) +
      `<td class="lks">${linkBtns(r, { icon: true })}</td>` +
      `</tr>`
  }).join('')
}

/* ---------------- 我的监控 ---------------- */
function watch() {
  try { return JSON.parse(localStorage.getItem(WATCH_KEY)) || [] } catch { return [] }
}
function saveWatch(list) { try { localStorage.setItem(WATCH_KEY, JSON.stringify(list)) } catch { /* 存不下就只这次有效 */ } }

function addPickedToWatch() {
  const list = watch()
  for (const n of picked) if (!list.includes(n)) list.push(n)
  saveWatch(list.slice(0, 30))
  renderWatch()
  toast('已加入我的监控：' + picked.join('、'))
}

function watchRec(n) {
  return CAT.packages[n] || null
}

function refreshWatch() {
  const list = watch()
  if (!list.length) return
  const btn = $('#btnWatchRefresh')
  btn.disabled = true
  btn.textContent = '刷新中…'
  setTimeout(() => {
    btn.disabled = false
    btn.textContent = '↻ 刷新'
    renderWatch()
    toast(`已刷新 ${list.length} 个插件（离线预览：数据来自本地目录，npm 实时查询在原版里）`)
  }, 600)
}

function renderWatch() {
  const list = watch()
  $('#watchCount').textContent = list.length ? ` (${list.length})` : ''
  $('#btnWatchRefresh').classList.toggle('hidden', !list.length)
  $('#watchAsOf').innerHTML = !list.length ? ''
    : `现在显示的是目录数据（截止 <b>${esc(CAT.anchor)}</b>）。`
  const host = $('#watchList')
  if (!list.length) {
    host.innerHTML = '<div class="empty">还没有监控的插件。在「选插件」里挑几个，点「加入我的监控」。</div>'
    $('#watchChart').innerHTML = ''
    return
  }

  host.innerHTML = list.map(n => {
    const r = watchRec(n)
    if (!r) return `<div class="mon"><span class="nm">${esc(n)}</span><span style="color:var(--t3);font-size:11.5px">不在目录中，点「刷新」去 npm 查</span><button class="x" data-rm="${esc(n)}">×</button></div>`
    const d = r.deep
    return `<div class="mon">` +
      `<span class="nm">${esc(n)}${r.v ? ` <span style="color:var(--t3);font-weight:400;font-size:11px">v${esc(r.v)}</span>` : ''}` +
        (introOf(r) ? `<span class="mon-sub" title="${esc(introOf(r))}">${esc(introOf(r))}</span>` : '') +
      `</span>` +
      `<span class="mrank">${rankText(r)}</span>` +
      `<span style="font-size:11.5px;color:var(--t3)">${esc(r.cat)}</span>` +
      `<span style="font-size:12px"><b>${num(r.w)}</b>/周</span>` +
      `<span style="font-size:12px;color:var(--t2)">基线 ${d ? num(d.base) : '—'}</span>` +
      `<span style="font-size:12px;color:var(--t2)">${d ? ageText(d.age) + '发版' : ''}</span>` +
      `<span class="mlinks">${linkBtns(r, { icon: true })}</span>` +
      `<button class="x" data-rm="${esc(n)}">×</button></div>`
  }).join('')

  host.querySelectorAll('[data-rm]').forEach(b =>
    b.addEventListener('click', () => { saveWatch(watch().filter(x => x !== b.dataset.rm)); renderWatch() }))

  const rows = list.map(watchRec).filter(Boolean)
  const max = Math.max(...rows.map(r => r.w), 1)
  $('#watchChart').innerHTML = rows.map((r, i) => {
    const w = Math.max(Math.log10(r.w + 1) / Math.log10(max + 1) * 100, 1.5)
    return `<div class="hrow" style="display:grid;grid-template-columns:minmax(80px,38%) 1fr auto;align-items:center;gap:10px;padding:6px 0">` +
      `<div style="font-size:12px;color:var(--t2);text-align:right;white-space:nowrap;overflow:hidden;text-overflow:ellipsis"><i style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${colorOf(i)};margin-right:6px"></i>${esc(r.n)}${r.rank ? ` <span style="color:var(--t3);font-size:10px">#${num(r.rank)}</span>` : ''}</div>` +
      `<div style="height:14px;background:var(--soft);border-radius:4px"><div style="height:100%;width:${w}%;background:${colorOf(i)};border-radius:4px"></div></div>` +
      `<div style="font-size:12px;font-weight:650;text-align:right">${num(r.w)}</div></div>`
  }).join('')
}

/* ---------------- 导出结论（网页版） ---------------- */
function exportHtml() {
  const rows = picked.map(n => CAT.packages[n]).filter(Boolean)
  if (!rows.length) return
  const need = $('#need').value.trim()
  const verdicts = $('#verdicts').innerHTML

  const body = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8">
<title>dsh-pick 选型结论 · ${esc(need)}</title>
<style>body{font-family:-apple-system,"PingFang SC",sans-serif;max-width:860px;margin:40px auto;padding:0 20px;color:#1a1e26;line-height:1.7}
h1{font-size:20px}h2{font-size:15px;margin:26px 0 10px}
table{width:100%;border-collapse:collapse;font-size:13px}th,td{padding:9px 10px;border-bottom:1px solid #eee;text-align:right;white-space:nowrap}
th:first-child,td:first-child{text-align:left;color:#8b95a4}thead th{color:#1a1e26}
.verdict{border-radius:10px;padding:13px 15px;margin-bottom:10px;border:1px solid}
.win{background:#e7f6ee;border-color:#bfe6d1}.alt{background:#fdf3e3;border-color:#f2ddb6}.no{background:#fdecec;border-color:#f2cccc}
.verdict h4{margin:0 0 6px;font-size:13px}.verdict p{margin:0;font-size:12.5px;color:#58606e}
.foot{font-size:11.5px;color:#8b95a4;margin-top:28px;border-top:1px dashed #ddd;padding-top:12px}
.best{color:#0f9d58;font-weight:700}.miss{color:#b9c2ce}
</style></head><body>
<h1>dsh-pick 选型结论</h1>
<p style="color:#58606e;font-size:13px">需求：<b>${esc(need)}</b></p>
<h2>比较</h2>
<table><thead><tr><th>指标</th>${rows.map(r => `<th>${esc(r.n)}</th>`).join('')}</tr></thead><tbody>
${ROWS.map(row => {
    const vals = rows.map(r => row.get(r))
    const valid = vals.filter(v => v !== null && v !== undefined && !Number.isNaN(v))
    const bv = valid.length ? (row.best === 'max' ? Math.max(...valid) : Math.min(...valid)) : null
    return `<tr><td>${row.label}</td>` + vals.map(v =>
      `<td class="${v === null || v === undefined ? 'miss' : (v === bv ? 'best' : '')}">${row.fmt(v)}</td>`).join('') + '</tr>'
  }).join('')}
</tbody></table>
<h2>结论</h2>${verdicts}
<div class="foot">数据来源 api.npmjs.org / registry.npmjs.org，截止 <b>${CAT.anchor}</b>（npm 统计滞后约 5 天）。
下载量含 CI、镜像、爬虫等非人类流量，不等于用户数；<b>日常基线</b>＝扣掉版本发布日与次日后的每日中位数。
本页由 dsh-pick 面板导出。</div>
</body></html>`

  const blob = new Blob([body], { type: 'text/html' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `dsh-pick-${(need || '结论').slice(0, 12).replace(/\s+/g, '_')}.html`
  a.click()
  URL.revokeObjectURL(a.href)
}

/* 首次打开预置几条监控，方便直接看到「我的监控」长什么样（清空后就是原版的空状态） */
if (!watch().length) saveWatch(['dshmarket', 'dsh-cost-meter', '@michengai/dsh-skills-manager', '@nanmicoder/dsh-agent-teams', 'dsh-plugin-catalog'])

boot()
