import { GAMES } from "@/games"
import { SITE_DESCRIPTION, SITE_NAME } from "@/site"

export default function Home() {
  const games = GAMES.filter((g) => g.listed)
  return (
    <main className="page">
      <header className="hero">
        <p className="eyebrow">{SITE_NAME}</p>
        <h1>Board games online, with friends.</h1>
        <p className="lead">{SITE_DESCRIPTION}</p>
      </header>
      <ul className="games">
        {games.map((game) => (
          <li key={game.slug}>
            {/* Plain <a>: each game is a separate app (multi-zones), so navigation is a full page load. */}
            <a className="card" href={`/${game.slug}`}>
              <span className="name">{game.name}</span>
              <span className="tagline">{game.tagline}</span>
              <span className="meta">
                {game.players.min}–{game.players.max} players
              </span>
            </a>
          </li>
        ))}
      </ul>
    </main>
  )
}
