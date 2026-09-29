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

export async function loadWebAnalytics(): Promise<WebAnalytics | { error: string } | null> {
  if (!token) return null
  if (!projectId) return { error: "VERCEL_PROJECT_ID introuvable (ajoutez VERCEL_ANALYTICS_PROJECT_ID)." }
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
      topPages: pages.data.map((p) => ({ route: p.route || "(autre)", pageviews: p.pageviews })),
      countries: countries.data.map((c) => ({ country: c.country || "(autre)", visitors: c.visitors })),
    }
  } catch (e) {
    return { error: `${(e as Error).message} — Web Analytics est-il activé sur le projet ?` }
  }
}

export type Site = { id: string; name: string; url: string | null; state: string | null; deployedAt: number | null; visitors7d: number | null }

type Project = {
  id: string
  name: string
  targets?: { production?: { alias?: string[]; url?: string; readyState?: string; createdAt?: number } }
  latestDeployments?: { readyState?: string; createdAt?: number; url?: string; target?: string | null }[]
}

export async function loadSites(): Promise<Site[] | { error: string } | null> {
  if (!token) return null
  try {
    const { projects } = await get<{ projects: Project[] }>("/v10/projects", { limit: "30" })
    return await Promise.all(
      projects.map(async (p) => {
        const prod = p.targets?.production
        const latest = prod ?? p.latestDeployments?.find((d) => d.target === "production") ?? p.latestDeployments?.[0]
        const host = prod?.alias?.find((a) => !a.includes("-git-")) ?? prod?.alias?.[0] ?? latest?.url
        const visitors7d = await get<{ data: { visitors: number } }>("/v1/query/web-analytics/visits/count", { projectId: p.id, since: day(6), until: day(0) })
          .then((r) => r.data.visitors)
          .catch(() => null)
        return { id: p.id, name: p.name, url: host ? `https://${host}` : null, state: latest?.readyState ?? null, deployedAt: latest?.createdAt ?? null, visitors7d }
      }),
    )
  } catch (e) {
    return { error: (e as Error).message }
  }
}
