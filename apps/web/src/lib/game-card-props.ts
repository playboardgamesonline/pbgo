import { cardPictureUrl, pictureUrl, type CatalogEntry, type NotionGame } from "@pbgo/catalog"
import type { GameCardProps } from "@pbgo/ui/platform/game-card"

/** "2–5 players", "2 players", "2+ players" (a game whose maximum is not known). The platform speaks English; a game's own pages are localized by the game. */
export function playersLabel(players: { min: number; max: number | null } | undefined | null): string | undefined {
  if (!players) return undefined
  const { min, max } = players
  if (max === null) return `${min}+ players`
  return min === max ? `${max} player${max > 1 ? "s" : ""}` : `${min}–${max} players`
}

/** "30 min": a game gives its duration as one figure, in minutes. A figure it does not have is undefined. */
export function durationLabel(minutes: number | undefined | null): string | undefined {
  return minutes === undefined || minutes === null ? undefined : `${minutes} min`
}

/**
 * The picture of a game, as `GameCardVisual` (`@pbgo/ui/platform/game-card`) takes it: its logo (else its icon) and its background, from
 * the catalog's picture route, which serves what the game's Notion row holds. A picture the row does not have is left out and the frame
 * stays plain. The game's card and its page both draw this one picture, so both come from here.
 */
export function gamePicture(game: NotionGame) {
  return { logo: cardPictureUrl(game) ?? undefined, background: pictureUrl(game, "background") ?? undefined }
}

/**
 * Props of the hub's `GameCard` for an entry of the catalog, the same for every game: what its Notion row says (its name, its picture,
 * its players and its duration), then the card's variant, the one thing the registry decides: a live game is a "play" card, any other
 * a "Coming soon" one. Status, priority and the rest only sort the list, the card shows none of them. It goes to `/game/<slug>` like
 * every card: every game of the catalog has a page there, whose button enters the game when it is live.
 */
export function catalogCardProps(entry: CatalogEntry): GameCardProps {
  const { game } = entry
  return {
    variant: entry.live ? "play" : "soon",
    href: `/game/${entry.slug}`,
    name: game.name,
    ...gamePicture(game),
    players: playersLabel(game.players),
    duration: durationLabel(game.duration),
  }
}
