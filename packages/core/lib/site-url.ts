/** Public origin of the site (hub and games): `NEXT_PUBLIC_SITE_URL`, else the production domain. No trailing slash. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://playboardgamesonline.app").replace(/\/+$/, "")

/** Absolute URL of a game: `<SITE_URL>/<slug>`. */
export const gameUrl = (slug: string) => `${SITE_URL}/${slug}`

/** Id of the share image (`generateImageMetadata` of `app/[game]/opengraph-image.tsx`), so its URL is known. */
export const SHARE_IMAGE_ID = "share"

/** Path of a game's share image: `/<slug>/opengraph-image/share`. */
export const shareImagePath = (slug: string) => `/${slug}/opengraph-image/${SHARE_IMAGE_ID}`

/** Absolute URL of a game's share image. */
export const shareImageUrl = (slug: string) => `${SITE_URL}${shareImagePath(slug)}`
