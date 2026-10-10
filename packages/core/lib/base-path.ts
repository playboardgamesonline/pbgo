/**
 * Base path of the game app when it is served under the hub (e.g. `/courtisans` on playboardgamesonline.app).
 * Empty when the game runs on its own domain. Set with `NEXT_PUBLIC_BASE_PATH`, read by `next.config` (`basePath`).
 *
 * Next.js already prefixes `<Link>`, `router.push`, `redirect` and metadata files. Everything else that builds a
 * root-relative URL by hand (fetch, `<a>`, `<img>`, `<iframe>`, audio files, `window.location`) goes through `withBase`.
 */
export const BASE_PATH = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/+$/, "")

/** Prefixes a root-relative path with the base path. Leaves absolute URLs and already-prefixed paths unchanged. */
export function withBase(path: string): string {
  if (!BASE_PATH || !path.startsWith("/") || path.startsWith("//")) return path
  if (path === BASE_PATH || path.startsWith(`${BASE_PATH}/`) || path.startsWith(`${BASE_PATH}?`)) return path
  return path === "/" ? BASE_PATH : `${BASE_PATH}${path}`
}
