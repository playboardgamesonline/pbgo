/** Dataset of every game's Sanity project. The project id comes from the `@pbgo/games` registry (`sanityProjectId`). */
export const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET ?? "production"
export const apiVersion = "2026-09-27"

/** Environment variable of a game's Sanity write token: `SANITY_API_WRITE_TOKEN_<SLUG>` (`sky-team` → `SKY_TEAM`). */
export const writeTokenName = (slug: string) => `SANITY_API_WRITE_TOKEN_${slug.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`

/** A real project id (not empty, not a `__SANITY_PROJECT_ID__` placeholder). */
export const isProjectId = (id: string | null | undefined): id is string => !!id && /^[a-z0-9-]+$/.test(id)
