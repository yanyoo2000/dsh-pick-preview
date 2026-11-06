import { GitHubIcon, NpmIcon } from './Icons.jsx'

/** 行尾两个外链：GitHub（有才有）与 npm */
export function LinkButtons({ plugin }) {
  return (
    <td className="lks">
      {plugin.ghUrl ? (
        <a
          className="lk ic"
          href={plugin.ghUrl}
          target="_blank"
          rel="noopener"
          title={`GitHub：${plugin.ghUrl}`}
          aria-label="GitHub"
        >
          <GitHubIcon />
        </a>
      ) : null}
      <a
        className="lk ic"
        href={plugin.npmUrl}
        target="_blank"
        rel="noopener"
        title={`npm：${plugin.npmUrl}`}
        aria-label="npm"
      >
        <NpmIcon />
      </a>
    </td>
  )
}
