import { getHubFigures } from "@/lib/hub-stats"

// The two figures of the home that come from the database, for its browser to refresh (`LiveStats`): the players online and the members, as `getHubFigures` counts them (kept half a minute and a minute).
// Public, and cheap: the answer is two numbers, the edge keeps it a few seconds more, and a figure that cannot be counted is null (never made up). Read per request, so never static.
export const dynamic = "force-dynamic"

export async function GET() {
  return Response.json(await getHubFigures(), { headers: { "Cache-Control": "public, s-maxage=15, stale-while-revalidate=30" } })
}
