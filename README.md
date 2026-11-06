# dsh-pick 插件排行

**在线预览：<https://yanyoo2000.github.io/dsh-pick-preview/>**

![插件排行](preview.jpg)

给 [dsh-pick](https://www.npmjs.com/package/dsh-pick) 的插件目录做的一份**榜单**：按去噪后的指标排，每个插件带一段中文介绍。

只有一件事——排名。没有搜索、没有对比、没有监控。

## 为什么

翻 dsh-pick 的源码能看出一条线：

- 目录构建时把 npm 描述 `slice(0, 160)` **截断**了（2,250 个包里 946 个原本更长）
- 剩下的是 npm 那种一句话营销文案，其中 **1,357 个是纯英文**
- 排行榜**根本没有描述列**——只有名字、分类、数字

所以榜单上那行东西不是「没写介绍」，是「介绍只剩这么点」。这里把它补回来，并且只围绕榜单这一件事。

## 排什么

四个指标，点一下换一种看法：

| | |
|---|---|
| 日常基线 | 扣掉版本发布日与次日后的每日中位数，最接近真实使用量（默认） |
| 周下载 | 原始数字，含 CI、镜像、爬虫流量 |
| 增速最快 | 近 7 日环比 |
| 健康度 | 基线 40% + 增速 25% + 新鲜度 20% + 节奏 15% |

外加 14 个分类筛选。按基线 / 增速 / 健康度排时，只在有去噪指标的 332 个里排（去噪只算了周下载 Top 332）。

表格列固定：排名 / 插件 / 分类 / 基线 / 周下载 / 环比 / 健康 / 更新 / 外链。当前排法用**表头点亮 + 数值转橙**标出来，列的含义不会随排序变化。

## 技术栈

React 19 + Vite 7，构建成**单个 index.html**（样式、脚本、数据全部内联），双击就能看。

## 结构：数据与界面分离

```
data/                数据源（JSON 快照，界面不认识它们）
  catalog.json         精简目录：2,250 个包的版本、下载量、分类、去噪指标
  intro.json           2,250 条中文介绍
  npm-meta.json        npm 原始元数据（复现 intro.json 用）

src/
  data/              ← 数据层，纯函数，不含任何 JSX
    catalog.js        归一化 + 选择器：selectRanking / selectFacts
    format.js         数字、百分比、时间的展示口径
    theme.js          明暗主题的读写
  hooks/             把数据层接到 React 的小钩子
  components/        展示层，只负责画，不排序、不过滤、不派生指标
  styles/theme.css   整套样式
  App.jsx            把三者接起来

scripts/            数据管线（与界面无关，改数据不进 React）
```

**分层规则**：界面组件从不 import `data/*.json`，只从 `src/data/catalog.js` 拿已经算好的行。换数据源（本地快照 → 远端接口 → dsh-pick 实时目录）只改数据层。

## 设计

视觉取自 [maibot.chat](https://maibot.chat/)：深底 + 点阵纹理、橙绿双色强调、方角描边控件、粗黑标题配彩色高亮、等宽数字。

| | |
|---|---|
| 底 | `#121212` + 点阵，不是渐变也不是玻璃 |
| 主色 | 橙 `#e97f0f`——标题高亮、排名序号、当前指标、主数字 |
| 次色 | 绿 `#80de41`——涨幅；跌用红 |
| 控件 | 方角、1px 描边、同色文字，不做圆角胶囊 |
| 字体 | 中文粗黑（PingFang / 雅黑），数字等宽 |
| 标题 | 白字 + 「排行」两字橙色带下划线高亮 |
| 外链 | 24px 描边小方块，悬停变橙 |
| 头像 | 每条取作者的 GitHub 头像，地址是 `github.com/&lt;owner&gt;.png`；取不到退回按用户名着色的字母块 |

一行就是一条：序号 / 作者头像 / 名字 / 介绍 / 分类 / 四个指标 / 更新 / 外链。

只做桌面，不做移动端适配。

## 介绍是怎么来的

1. 抓 npm registry 全部 2,250 个包的**完整元数据**（完整描述、关键词、发布时间）
2. 其中提到 README 的**提取摘要段**（那才是真正讲清"怎么用"的地方）
3. 分两档生成：
   - **精读**（有 README 摘录的）：读 README 摘录 + 描述 → 一段话，含前提条件（要 API Key、限某平台等）
   - **概括**（其余的）：按完整描述 + 关键词 → 一句话说清做什么
4. 超过 220 字的长介绍再做一次压缩

## 数据口径

- 目录快照：**2026-10-31**（npm 统计约滞后 5 天）
- 覆盖：npm 上带 `dsh-plugin` 关键字的 **2,250** 个包
- 去噪指标只算了周下载 Top **332**
- 下载量含 CI、镜像、爬虫等非人类流量，**不等于用户数**

## 开发与构建

```sh
npm install
npm run dev      # 本地开发，热更新
npm run build    # 产出 dist/app.html 并复制成根目录 index.html
npm run preview  # 预览构建结果
```

根目录的 `index.html` 是**构建产物**，别直接改；源入口是 `app.html`。

## 更新数据

```sh
node scripts/fetch-meta.mjs     # 抓新包的 npm 元数据（默认增量，--all 全量）
node scripts/prep.mjs           # 生成待写清单（默认只处理缺介绍的包）
node scripts/split.mjs          # 拆批次到 .work/batches
#   …… 逐批交给模型生成，产物放 .work/out/<批次id>.json，格式 [{"n":"包名","s":"介绍"}]
node scripts/merge.mjs          # 合并校验，写回 data/intro.json
node scripts/apply-trim.mjs     # 压缩过长介绍（可选）
npm run build                   # 重新构建
```

中间产物都在 `.work/`（已 gitignore）。想换新目录快照，覆盖 `data/catalog.json` 即可。

## 文件

```
app.html               Vite 源入口（别和根目录的 index.html 搞混）
index.html             构建产物，GitHub Pages 入口
vite.config.js         构建配置：单文件输出
preview.jpg            截图
data/                  数据源
src/                   源码（data / components / hooks / styles）
scripts/               数据管线 + 构建收尾
```

## 说明

不是 dsh-pick 的官方页面。介绍由各插件自己的 npm 描述和 README 整理而成，**不是官方文档**，具体用法以插件仓库为准。
