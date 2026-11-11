import { pictureUrl, type CatalogGame } from "@pbgo/catalog"

/** How wide the image CDN is asked for a thumbnail of a game: a few dozen pixels on the page, twice that for a sharp one on a dense screen. */
const THUMB_WIDTH = 240

/**
 * The picture of a game for `CoverTile`, as the hub's cards choose it (PLT-114) and sized for a small frame: the cover, else the background, which fill the frame (`picture`); else the logo, else the icon, contained on it (`logo`); none for a game with none of them.
 */
export function gameThumb(game: Pick<CatalogGame, "pictures">): { picture?: string; logo?: string } {
  const picture = pictureUrl(game, "cover", THUMB_WIDTH) ?? pictureUrl(game, "background", THUMB_WIDTH)
  if (picture) return { picture }
  const logo = pictureUrl(game, "logo", THUMB_WIDTH) ?? pictureUrl(game, "icon", THUMB_WIDTH)
  return logo ? { logo } : {}
}
