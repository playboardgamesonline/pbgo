import { cardPictureUrl, pictureUrl, type PlannedGame } from "@pbgo/catalog"
import type { GameEntry } from "@pbgo/core/lib/binding"
import type { CardArt } from "@pbgo/core/sanity/cover"

/** "2–5 players", "2 players", "2+ players" (a planned game whose maximum is not known). The platform speaks English; a game's own pages are localized by the game. */
export function playersLabel(players: { min: number; max: number | null } | undefined | null): string | undefined {
  if (!players) return undefined
  const { min, max } = players
  if (max === null) return `${min}+ players`
  return min === max ? `${max} player${max > 1 ? "s" : ""}` : `${min}–${max} players`
}

/** "30 min", "20–40 min". */
export function durationLabel(duration: GameEntry["duration"]): string | undefined {
  if (!duration) return undefined
  const { min, max } = duration
  return min === max ? `${max} min` : `${min}–${max} min`
}

/**
 * The picture of a live game, as `GameCardVisual` (`@pbgo/ui/platform/game-card`) takes it: its logo and its background, which `art`
 * carries, read from the game's Sanity project by `gameCardArt()` (`@pbgo/core/sanity/cover`). A picture the game does not have yet
 * is left out and the frame stays plain. The game's card and its page both draw this one picture, so both come from here.
 */
export function livePicture(art?: Partial<CardArt>) {
  return { logo: art?.logo ?? undefined, background: art?.background ?? undefined }
}

/** The picture of a game to come: its logo (else its icon) and its background, from the catalog's picture route; one the row does not have is left out. */
export function plannedPicture(game: PlannedGame) {
  return { logo: cardPictureUrl(game) ?? undefined, background: pictureUrl(game, "background") ?? undefined }
}

/**
 * Props of the hub's `GameCard` (`@pbgo/ui/platform/game-card`) for a game of the registry: its name, its players and its duration,
 * and its picture (`livePicture`). The card goes to the game's page on the hub, `/game/<slug>`, whose "Create a game" button goes on
 * to the game's own site.
 */
export function gameCardProps(game: GameEntry, art?: Partial<CardArt>) {
  return {
    href: `/game/${game.slug}`,
    name: game.name,
    ...livePicture(art),
    players: playersLabel(game.players),
    duration: durationLabel(game.duration),
  }
}

/**
 * The players and the duration of a planned game, worded like a live game's. Its Notion row gives the duration as one figure
 * (minutes), the registry gives a range: "30 min". A figure the row does not have is undefined.
 */
export function plannedFacts(game: Pick<PlannedGame, "players" | "duration">) {
  return {
    players: playersLabel(game.players),
    duration: game.duration === null ? undefined : durationLabel({ min: game.duration, max: game.duration }),
  }
}

/**
 * Props of the hub's `GameCard` for a planned game of the catalog (a "Coming soon" card), built like a live one: its name, its
 * picture (`plannedPicture`) on the same grey frame, then its players and its duration. Status, priority and the rest only sort the
 * list, the card shows none of them. It goes to `/game/<slug>` like every card: every game of the catalog has a page there.
 */
export function plannedCardProps(game: PlannedGame) {
  return {
    variant: "soon" as const,
    href: `/game/${game.slug}`,
    name: game.name,
    ...plannedPicture(game),
    ...plannedFacts(game),
  }
}
