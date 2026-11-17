// What the flow asks of the platform's Sanity itself: only whether documents are published, from the public API (the dataset is public: no token), to check what the
// skill said it published rather than take its word for it.

/** The platform's own Sanity project: the hub's catalog and editorial (`docs/platform-sanity.md`). */
export const PLATFORM_SANITY = { projectId: "mhgqs6fe", dataset: "production" } as const

const API_VERSION = "v2025-02-19"

/**
 * The ids, among `ids`, that the public API does not show as published. `null` when it could not be read (offline, a refusal): the caller says so and does not
 * take the silence for a yes. The API is read directly, not through the CDN, which keeps an answer for about a minute.
 */
export async function missingPublished(ids: readonly string[], options: { base?: string; fetchImpl?: typeof fetch; timeoutMs?: number } = {}): Promise<string[] | null> {
  if (ids.length === 0) return []
  const doFetch = options.fetchImpl ?? fetch
  // `base` is where a test points the call instead (PBGO_SANITY_API_BASE): the platform's own API otherwise
  const base = (options.base || `https://${PLATFORM_SANITY.projectId}.api.sanity.io`).replace(/\/$/, "")
  const url = `${base}/${API_VERSION}/data/query/${PLATFORM_SANITY.dataset}?perspective=published&query=${encodeURIComponent("*[_id in $ids]._id")}&%24ids=${encodeURIComponent(JSON.stringify(ids))}`
  try {
    const response = await doFetch(url, { signal: AbortSignal.timeout(options.timeoutMs ?? 10_000) })
    if (!response.ok) return null
    const body = (await response.json()) as { result?: unknown }
    if (!Array.isArray(body.result)) return null
    const found = new Set(body.result.filter((id): id is string => typeof id === "string"))
    return ids.filter((id) => !found.has(id))
  } catch {
    return null
  }
}
