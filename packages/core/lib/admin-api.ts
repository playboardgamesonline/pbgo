const MESSAGES: Record<string, string> = {
  ACCESS_DENIED: "Session expired, please log in again.",
  INVALID_CREDENTIALS: "Wrong login or password.",
  SANITY_TOKEN_MISSING: "Add this game's SANITY_API_WRITE_TOKEN_<SLUG> to save to Sanity.",
  SANITY_NOT_CONFIGURED: "Sanity is not configured for this game (sanityProjectId in the @pbgo/games registry).",
  INVALID_COLOR: "A color is not in the #rrggbb format.",
  INVALID_URL: "Links must start with http(s)://.",
  EMPTY_TITLE: "The title is required.",
  EMPTY_TEXT: "The text is empty.",
  INVALID_FILE: "This file format is not accepted.",
  FILE_TOO_LARGE: "File too large (4 MB max here): use the Sanity Studio or a link.",
  MIGRATION_MISSING: "The Supabase migration for tasks and feedback has not been applied yet.",
  SOUND_NOT_FOUND: "A sound file could not be read from the site.",
  INVALID_REQUEST: "Invalid request.",
  SERVER_ERROR: "Something went wrong.",
}

export class AdminApiError extends Error {
  constructor(public code: string) {
    super(MESSAGES[code] ?? MESSAGES.SERVER_ERROR!)
  }
}

/** Admin call: `route` is the full path, e.g. `/api/<slug>/admin/settings` (login and logout are shared: `/api/admin/login`). */
export async function adminRequest<T>(route: string, init?: RequestInit): Promise<T> {
  const isForm = init?.body instanceof FormData
  const res = await fetch(route, { ...init, headers: isForm ? undefined : { "Content-Type": "application/json" }, cache: "no-store" })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new AdminApiError((data as { error?: string }).error ?? "ERROR")
  return data as T
}
