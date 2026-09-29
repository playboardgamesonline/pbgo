export type EngineErrorCode =
  | "INVALID_PLAYERS"
  | "NOT_ENOUGH_MISSIONS"
  | "INVALID_PHASE"
  | "NOT_YOUR_TURN"
  | "UNKNOWN_CARD"
  | "ZONE_ALREADY_PLAYED"
  | "INVALID_TARGET"
  | "INVALID_ASSASSINATION"
  | "UNKNOWN_PLAYER"

export class EngineError extends Error {
  constructor(
    public code: EngineErrorCode,
    message?: string,
  ) {
    super(message ?? code)
    this.name = "EngineError"
  }
}
