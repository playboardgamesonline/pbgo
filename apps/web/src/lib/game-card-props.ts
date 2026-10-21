import type { GameEntry } from "@pbgo/core/lib/binding"

/** "2–5 players", "2 players". The platform speaks English; a game's own pages are localized by the game. */
export function playersLabel(players: GameEntry["players"]): string | undefined {
  if (!players) return undefined
  const { min, max } = players
  return min === max ? `${max} player${max > 1 ? "s" : ""}` : `${min}–${max} players`
}

/** "30 min", "20–40 min". */
export function durationLabel(duration: GameEntry["duration"]): string | undefined {
  if (!duration) return undefined
  const { min, max } = duration
  return min === max ? `${max} min` : `${min}–${max} min`
}

/**
 * Props of the hub's `GameCard` (`@pbgo/ui/platform/game-card`) for a game of the registry. `cover` is the card's art, read from the
 * game's Sanity project by `gameCover()` (`@pbgo/core/sanity/cover`); without one the card shows its neutral placeholder.
 */
export function gameCardProps(game: GameEntry, cover?: string | null) {
  return {
    href: `/${game.slug}`,
    name: game.name,
    tagline: game.tagline,
    visual: cover ?? undefined,
    players: playersLabel(game.players),
    duration: durationLabel(game.duration),
  }
}
