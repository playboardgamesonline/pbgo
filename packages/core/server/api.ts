import "server-only"
import { isEngineError } from "@pbgo/engine-kit"

export class ApiError extends Error {
  constructor(
    public code: string,
    public status = 400,
    /** Extra response headers (e.g. `Retry-After` on a 429) */
    public headers?: Record<string, string>,
  ) {
    super(code)
  }
}

/** The refusal of an action on a table that is not in play: the game has ended, or has not started. */
export const notPlaying = (row: { status: string }) => new ApiError(row.status === "over" ? "GAME_OVER" : "GAME_NOT_STARTED", 409)

export function handle<A extends unknown[]>(fn: (...args: A) => Promise<unknown>) {
  return async (...args: A) => {
    try {
      return Response.json(await fn(...args))
    } catch (error) {
      if (error instanceof ApiError) return Response.json({ error: error.code }, { status: error.status, headers: error.headers })
      if (isEngineError(error)) return Response.json({ error: error.code }, { status: 400 })
      console.error(error)
      return Response.json({ error: "SERVER_ERROR" }, { status: 500 })
    }
  }
}

/** A request that changes an account on the strength of its cookie must come from this site: a browser says where a request comes from, and a form of another site is refused. A client that says nothing is a script, which has no cookie of ours to abuse. */
export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin")
  if (origin && origin !== new URL(request.url).origin) throw new ApiError("CROSS_ORIGIN", 403)
}

export async function readJson<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T
  } catch {
    throw new ApiError("INVALID_REQUEST")
  }
}
