import type { NextRequest } from "next/server"

const ORIGIN = "https://cdn.sanity.io/"

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url")
  if (!url?.startsWith(ORIGIN)) return new Response("URL non autorisée", { status: 400 })
  const res = await fetch(url, { next: { revalidate: 86400 } })
  if (!res.ok || !res.body) return new Response("Introuvable", { status: 404 })
  return new Response(res.body, {
    headers: {
      "Content-Type": res.headers.get("content-type") ?? "application/octet-stream",
      "Cache-Control": "public, max-age=86400, s-maxage=604800, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    },
  })
}
