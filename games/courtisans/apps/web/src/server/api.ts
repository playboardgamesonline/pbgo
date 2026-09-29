import "server-only"
import { EngineError } from "@courtisans/engine"

export class ApiError extends Error {
  constructor(
    public code: string,
    public status = 400,
  ) {
    super(code)
  }
}

export function handle<A extends unknown[]>(fn: (...args: A) => Promise<unknown>) {
  return async (...args: A) => {
    try {
      return Response.json(await fn(...args))
    } catch (error) {
      if (error instanceof ApiError) return Response.json({ erreur: error.code }, { status: error.status })
      if (error instanceof EngineError) return Response.json({ erreur: error.code }, { status: 400 })
      console.error(error)
      return Response.json({ erreur: "ERREUR_SERVEUR" }, { status: 500 })
    }
  }
}

export async function lireJson<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T
  } catch {
    throw new ApiError("REQUETE_INVALIDE")
  }
}
