import { cardPicture, pictureUrl, type CatalogEntry, type CatalogGame } from "@pbgo/catalog"
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
 * The picture of a game's card, as `GameCardVisual` (`@pbgo/ui/platform/game-card`) takes it, from the image CDN of the platform's Sanity project (PLT-114):
 * the one that `cardPicture` of the catalog chooses. A cover, else a background, fills the frame (`picture`) with nothing over it; a game that has neither
 * has its logo, else its icon, contained on the plain frame (`logo`); a game with none of them leaves the frame plain. Never two, so the card is told what to
 * draw and chooses nothing. The head of a game's page draws other pictures (`heroPicture`).
 */
export function gamePicture(game: CatalogGame): { picture?: string; logo?: string } {
  const drawn = cardPicture(game)
  if (!drawn) return {}
  return drawn.fills ? { picture: drawn.url } : { logo: drawn.url }
}

/** How wide the image CDN is asked for the pictures of a game's page head: its background across a wide screen, and its logo, drawn at 24rem at the most (twice that for a sharp one on a dense screen). The CDN never makes a picture bigger than its file. */
const HERO_BACKGROUND_WIDTH = 2400
const HERO_LOGO_WIDTH = 800

/**
 * The pictures of the head of a game's page: its background, which is the page's own across the whole width, and its logo, which stands in place of its name. Both are sized for that (`pictureUrl`), not as the card has them. Only the logo: a game that has
 * an icon and no logo has no picture of its name, and the head writes it. A picture the game does not have is left out.
 */
export function heroPicture(game: CatalogGame): { logo?: string; background?: string } {
  return { logo: pictureUrl(game, "logo", HERO_LOGO_WIDTH) ?? undefined, background: pictureUrl(game, "background", HERO_BACKGROUND_WIDTH) ?? undefined }
}

/**
 * Props of the hub's `GameCard` for an entry of the catalog, the same for every game: what its game in the Studio says (its name, its picture,
 * its players and its duration), then the card's variant, the one thing the registry decides: a live game is a "play" card, any other
 * a "Coming soon" one. The `order` of the Studio and the rest only sort the list, the card shows none of them. It goes to `/game/<slug>` like
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
