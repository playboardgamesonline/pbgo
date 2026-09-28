import type { NextRequest } from "next/server"

const ORIGINE = "https://cdn.sanity.io/"

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url")
  if (!url?.startsWith(ORIGINE)) return new Response("URL non autorisée", { status: 400 })
  const reponse = await fetch(url, { next: { revalidate: 86400 } })
  if (!reponse.ok || !reponse.body) return new Response("Introuvable", { status: 404 })
  return new Response(reponse.body, {
    headers: {
      "Content-Type": reponse.headers.get("content-type") ?? "application/octet-stream",
      "Cache-Control": "public, max-age=86400, s-maxage=604800, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    },
  })
}
