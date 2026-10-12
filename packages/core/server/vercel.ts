import "server-only"

const API = "https://api.vercel.com"
const token = process.env.VERCEL_TOKEN
const teamId = process.env.VERCEL_TEAM_ID
const projectId = process.env.VERCEL_ANALYTICS_PROJECT_ID ?? process.env.VERCEL_PROJECT_ID

export const vercelConfigured = !!token

async function get<T>(path: string, params: Record<string, string | undefined>): Promise<T> {
  const url = new URL(path, API)
  for (const [k, v] of Object.entries({ ...params, teamId })) if (v) url.searchParams.set(k, v)
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, next: { revalidate: 300 } })
  if (!res.ok) throw new Error(`Vercel ${res.status}`)
  return (await res.json()) as T
}

const day = (offset: number) => new Date(Date.now() - offset * 86_400_000).toISOString().slice(0, 10)

export type WebAnalytics = {
  pageviews: number
  visitors: number
  perDay: { date: string; pageviews: number; visitors: number }[]
  topPages: { route: string; pageviews: number }[]
  countries: { country: string; visitors: number }[]
}

type Aggregate<T> = { data: (T & { pageviews: number; visitors: number })[] }

/** Web Analytics of the whole site (every game shares the one Vercel project), last 30 days. */
export async function loadWebAnalytics(): Promise<WebAnalytics | { error: string } | null> {
  if (!token) return null
  if (!projectId) return { error: "VERCEL_PROJECT_ID not found (set VERCEL_ANALYTICS_PROJECT_ID)." }
  const range = { projectId, since: day(29), until: day(0) }
  try {
    const [daily, pages, countries] = await Promise.all([
      get<Aggregate<{ timestamp: string }>>("/v1/query/web-analytics/visits/aggregate", { ...range, by: "day" }),
      get<Aggregate<{ route: string }>>("/v1/query/web-analytics/visits/aggregate", { ...range, by: "route", limit: "5" }),
      get<Aggregate<{ country: string }>>("/v1/query/web-analytics/visits/aggregate", { ...range, by: "country", limit: "5" }),
    ])
    const perDay = daily.data.map((d) => ({ date: d.timestamp.slice(0, 10), pageviews: d.pageviews, visitors: d.visitors }))
    return {
      pageviews: perDay.reduce((t, d) => t + d.pageviews, 0),
      visitors: perDay.reduce((t, d) => t + d.visitors, 0),
      perDay,
      topPages: pages.data.map((p) => ({ route: p.route || "(other)", pageviews: p.pageviews })),
      countries: countries.data.map((c) => ({ country: c.country || "(other)", visitors: c.visitors })),
    }
  } catch (e) {
    return { error: `${(e as Error).message}. Is Web Analytics enabled on the project?` }
  }
}
