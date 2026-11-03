import { cardPictureUrl, pictureUrl, sizedPictureUrl, type CatalogEntry, type CatalogGame } from "@pbgo/catalog"
import type { GalleryMedia } from "@pbgo/ui/gallery"
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
 * the image CDN of the platform's Sanity project, sized for the page (`pictureUrl`). A picture the game does not have is left out and the
 * frame stays plain. The game's card and its page both draw this one picture, so both come from here.
 */
export function gamePicture(game: CatalogGame) {
  return { logo: cardPictureUrl(game) ?? undefined, background: pictureUrl(game, "background") ?? undefined }
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

/** How wide the image CDN is asked for a picture of the gallery: the viewer's, and a tile's. */
const GALLERY_WIDTH = 1200
const GALLERY_THUMB_WIDTH = 320

/**
 * The pictures and the clips that follow the cover of a game's page, as the gallery (`MediaGallery`) takes them: each picture sized for the viewer and for its tile, a clip as its file
 * and, when it has one, its poster sized the same two ways. A clip with no poster is drawn from its first frame, by the gallery.
 */
export function galleryMedia(game: Pick<CatalogGame, "gallery">): GalleryMedia[] {
  return game.gallery.map((item): GalleryMedia => {
    if (item.kind === "image") return { kind: "image", src: sizedPictureUrl(item.url, GALLERY_WIDTH), thumb: sizedPictureUrl(item.url, GALLERY_THUMB_WIDTH), caption: item.caption }
    const { poster } = item
    return {
      kind: "video",
      src: item.url,
      poster: poster ? sizedPictureUrl(poster, GALLERY_WIDTH) : undefined,
      thumb: poster ? sizedPictureUrl(poster, GALLERY_THUMB_WIDTH) : undefined,
      caption: item.caption,
    }
  })
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
