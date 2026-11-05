/** Public origin of the site (hub and games): `NEXT_PUBLIC_SITE_URL`, else the production domain. No trailing slash. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://playboardgamesonline.app").replace(/\/+$/, "")

/** Path of a game's page on the hub: `/game/<slug>`. A game has no home of its own: `/<slug>` shows it. */
export const gamePath = (slug: string) => `/game/${slug}`

/** Path of the hub's page of a table that waits for players: `/game/<slug>/<code>`, where the table's invitation link `/<slug>/game/<code>` leads. */
export const tablePath = (slug: string, code: string) => `/game/${slug}/${code}`

/** Absolute URL of a game: its page on the hub, `<SITE_URL>/game/<slug>`. */
export const gameUrl = (slug: string) => `${SITE_URL}${gamePath(slug)}`

/** Id of the share image (`generateImageMetadata` of `app/[game]/opengraph-image.tsx`), so its URL is known. */
export const SHARE_IMAGE_ID = "share"

/** Path of a game's share image: `/<slug>/opengraph-image/share`. */
export const shareImagePath = (slug: string) => `/${slug}/opengraph-image/${SHARE_IMAGE_ID}`

/** Absolute URL of a game's share image. */
export const shareImageUrl = (slug: string) => `${SITE_URL}${shareImagePath(slug)}`
