export class EngineError extends Error {
  constructor(
    public code: string,
    message?: string,
  ) {
    super(message ?? code)
    this.name = "EngineError"
  }
}

/**
 * True for an `EngineError` from engine-kit or from a game engine that defines its own class with the same shape
 * (`name === "EngineError"` and a string `code`). `instanceof` alone misses those, since one app now serves every game.
 */
export const isEngineError = (error: unknown): error is EngineError =>
  error instanceof Error && error.name === "EngineError" && typeof (error as { code?: unknown }).code === "string"
