import { sanityAssetUrl } from "../../../sanity/media"

/**
 * `GET /api/media?url=`: same-origin proxy of the assets of the games' Sanity projects (fonts, sounds, SVG), shared by
 * every game. It only serves `cdn.sanity.io` assets of the projects given here: core never imports the games, so
 * `apps/web` passes the `sanityProjectId` of each game of the registry.
 */
export function mediaRoute(projectIds: readonly (string | null | undefined)[]) {
  return async function GET(request: Request) {
    const url = sanityAssetUrl(new URL(request.url).searchParams.get("url"), projectIds)
    if (!url) return new Response("URL not allowed", { status: 400 })
    const res = await fetch(url.href, { next: { revalidate: 86400 } })
    if (!res.ok || !res.body) return new Response("Not found", { status: 404 })
    return new Response(res.body, {
      headers: {
        "Content-Type": res.headers.get("content-type") ?? "application/octet-stream",
        "Cache-Control": "public, max-age=86400, s-maxage=604800, immutable",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      },
    })
  }
}
