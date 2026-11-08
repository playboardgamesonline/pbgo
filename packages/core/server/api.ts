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

export async function readJson<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T
  } catch {
    throw new ApiError("INVALID_REQUEST")
  }
}
