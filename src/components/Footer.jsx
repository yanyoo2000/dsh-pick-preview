import { num } from '../data/format.js'

/** 页脚：口径 / 介绍来源 / 覆盖范围三段说明 */
export function Footer({ facts }) {
  return (
    <div className="foot">
      <b>口径：</b>下载量含 CI、镜像、爬虫等非人类流量，不等于用户数；<b>日常基线</b>
      ＝扣掉版本发布日与次日后的每日中位数。
      <br />
      <b>介绍：</b>每段中文介绍由该插件自己的 npm 描述和 README 整理而成，讲用途和主要能力——不是官方文档，具体用法以插件仓库为准。
      <br />
      <b>覆盖范围：</b>npm 上带 <code>dsh-plugin</code> 关键字的 {num(facts.total)} 个包；去噪指标只算了周下载 Top{' '}
      {num(facts.withDeep)}，所以按基线 / 增速 / 健康度排时，只在有去噪指标的 {num(facts.withDeep)} 个里排。榜单每页展示前{' '}
      {facts.topN} 名。
    </div>
  )
}
