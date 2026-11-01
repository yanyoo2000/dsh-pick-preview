/* 插件排行 —— 只有一件事：按指标排，每行带一段中文介绍 */

const CAT = window.__DSH_PICK_CATALOG__
const INTRO = window.__DSH_PICK_INTRO__ || {}

const $ = s => document.querySelector(s)

const num = n => (n === null || n === undefined) ? '—' : Number(n).toLocaleString('en-US')
const pct = n => (n === null || n === undefined) ? '—' : (n >= 0 ? '+' : '') + Math.round(n * 100) + '%'
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

const introOf = rec => INTRO[rec.n] || ''

/* ---------------- 外链图标 ---------------- */
const GH_SVG = '<svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.4 7.4 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A7.99 7.99 0 0 0 16 8c0-4.42-3.58-8-8-8z"/></svg>'
const NPM_SVG = '<svg viewBox="0 0 16 16" width="12" height="12"><path fill="#cb3837" d="M0 0h16v16H0z"/><path fill="#fff" d="M3 3h10v10h-2.5V5.5H8V13H3z"/></svg>'

function linkBtns(rec) {
  const npm = rec.npmUrl || ('https://www.npmjs.com/package/' + rec.n)
  let h = ''
  if (rec.ghUrl) {
    h += `<a class="lk ic" href="${esc(rec.ghUrl)}" target="_blank" rel="noopener" title="GitHub：${esc(rec.ghUrl)}" aria-label="GitHub">${GH_SVG}</a>`
  }
  h += `<a class="lk ic" href="${esc(npm)}" target="_blank" rel="noopener" title="npm：${esc(npm)}" aria-label="npm">${NPM_SVG}</a>`
  return h
}

/* ---------------- 更新一格 ---------------- */
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

/* ---------------- 分类筛选 ---------------- */
function buildCategoryFilter() {
  const sel = $('#rankCat')
  const cats = [...new Set(Object.values(CAT.packages).map(p => p.cat))].filter(Boolean).sort()
  sel.innerHTML = '<option value="">全部分类</option>' + cats.map(c => `<option>${esc(c)}</option>`).join('')
}

/* ---------------- 榜单 ---------------- */
const CAP = {
  base: '日常基线已扣掉版本发布日与次日的拉取虚高，比原始下载量更接近真实使用量。',
  w: '原始周下载量，含 CI、镜像、爬虫等非人类流量，不等于用户数。',
  growth: '近 7 日环比。只看增速会被小体量插件占满，配合基线和周下载一起看。',
  s: '健康度 = 日常基线 40% + 增速 25% + 新鲜度 20% + 版本节奏 15%，满分 100。',
}

function renderRank() {
  const metric = document.querySelector('#rankFilters .chip.on').dataset.m
  const cat = $('#rankCat').value
  const onlyDeep = metric !== 'w'

  $('#rankCap').textContent = CAP[metric] || ''

  let rows = Object.values(CAT.packages).filter(r => (!cat || r.cat === cat) && (!onlyDeep || r.deep))
  const val = r => metric === 'base' ? r.deep.base
    : metric === 'growth' ? (r.deep.growth === null ? -Infinity : r.deep.growth)
    : metric === 's' ? r.deep.s
    : r.w
  rows.sort((a, b) => val(b) - val(a))
  rows = rows.slice(0, 40)

  if (!rows.length) {
    $('#rankBody').innerHTML = '<tr><td colspan="8" class="empty">这个分类下没有可排的插件。</td></tr>'
    return
  }

  $('#rankBody').innerHTML = rows.map((r, i) => {
    const d = r.deep
    const g = d ? d.growth : null
    const zh = introOf(r)
    return `<tr>` +
      `<td>${String(i + 1).padStart(2, '0')}</td>` +
      `<td class="nm">${esc(r.n)} <span class="v">v${esc(r.v)}</span>` +
        (zh ? `<div class="nm-sub">${esc(zh)}</div>` : '') +
      `</td>` +
      `<td><span class="catpill">${esc(r.cat)}</span></td>` +
      `<td class="r"><b>${num(val(r))}</b></td>` +
      `<td class="r">${num(r.w)}</td>` +
      `<td class="r ${g === null ? '' : (g >= 0 ? 'up' : 'down')}">${pct(g)}</td>` +
      maintCell(d) +
      `<td class="lks">${linkBtns(r)}</td>` +
      `</tr>`
  }).join('')
}

/* ---------------- 启动 ---------------- */
function boot() {
  const deepN = Object.values(CAT.packages).filter(p => p.deep).length
  $('#meta').innerHTML =
    `目录 <b>${num(CAT.total)}</b> 个插件 · 去噪指标 <b>${num(deepN)}</b> 个<br>` +
    `数据截止 <b>${CAT.anchor}</b>（npm 统计滞后约 5 天）`

  $('#foot').innerHTML =
    `<b>口径：</b>下载量含 CI、镜像、爬虫等非人类流量，不等于用户数；<b>日常基线</b>＝扣掉版本发布日与次日后的每日中位数。<br>` +
    `<b>介绍：</b>每段中文介绍由该插件自己的 npm 描述和 README 整理而成，讲用途和主要能力——不是官方文档，具体用法以插件仓库为准。<br>` +
    `<b>覆盖范围：</b>npm 上带 <code>dsh-plugin</code> 关键字的 ${num(CAT.total)} 个包；去噪指标只算了周下载 Top ${num(deepN)}，所以按基线 / 增速 / 健康度排时，只在有去噪指标的 ${num(deepN)} 个里排。`

  buildCategoryFilter()
  renderRank()

  document.querySelectorAll('#rankFilters .chip').forEach(c => {
    c.addEventListener('click', () => {
      document.querySelectorAll('#rankFilters .chip').forEach(x => x.classList.toggle('on', x === c))
      renderRank()
    })
  })
  $('#rankCat').addEventListener('change', renderRank)
}

boot()
