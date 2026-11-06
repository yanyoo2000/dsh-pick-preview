import { useState } from 'react'
import { ownerOf } from '../data/catalog.js'

/** 作者头像：有 GitHub 就取它的头像，失败或没有就退回带色字母块 */
export function Avatar({ plugin }) {
  const [broken, setBroken] = useState(false)
  const owner = ownerOf(plugin)
  const seed = owner || plugin.name || ''
  const initial = (owner || String(plugin.name || '').replace(/^@/, '')).slice(0, 2).toUpperCase()

  let hue = 0
  for (let i = 0; i < seed.length; i++) hue = (hue * 31 + seed.charCodeAt(i)) % 360

  const showImage = Boolean(owner) && !broken

  return (
    <span className="av" style={{ '--h': hue }} aria-hidden="true">
      <span className="av-t">{initial}</span>
      {showImage ? (
        <img
          src={`https://github.com/${encodeURIComponent(owner)}.png?size=96`}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setBroken(true)}
        />
      ) : null}
    </span>
  )
}
