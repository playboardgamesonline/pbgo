/**
 * The codes an engine refuses with when the refusal means the same in every game. The platform words them (`CORE_ERROR_MESSAGES` of core: English in the code, translated apart), so an
 * engine throws one with no message to write, and its binding does not list it in `ERROR_CODES`. A refusal that only its game can explain is a code of its own: listed there, worded in Sanity.
 */
export const SHARED_ERROR_CODES = [
  "INVALID_PLAYERS", // the table cannot be played: a number of players outside the bounds, an empty id, the same id twice
  "INVALID_ACTION", // the action is malformed, or is not one of the game's
  "INVALID_PHASE", // the action is one of the game's, but the game is not at a stage that takes it
  "GAME_OVER", // the game has ended: nothing more can be played
  "NOT_YOUR_TURN", // the action belongs to another player, or to nobody
  "NOT_WAITING", // the game does not wait for this player (the kit throws it too)
  "UNKNOWN_PLAYER", // the player is not at the table
  "UNKNOWN_CARD", // the card is not in the player's hand
  "INVALID_TARGET", // the player the action aims at cannot be chosen
  "INVALID_TEXT", // a text a player wrote is empty, too long or not a text (`cleanText` throws it)
  "INVALID_NUMBER", // a number a player chose is not a number, is outside the range or is off the steps (`cleanNumber` throws it)
  "INVALID_CHOICE", // an option a player chose is not one of the options (`cleanChoice` and `cleanChoices` throw it)
  "AUTOPLAY_UNSUPPORTED", // the engine cannot play for this player (the kit throws it)
] as const
export type SharedErrorCode = (typeof SHARED_ERROR_CODES)[number]

export const isSharedErrorCode = (code: string): code is SharedErrorCode => (SHARED_ERROR_CODES as readonly string[]).includes(code)

export class EngineError extends Error {
  constructor(
    /** A shared code, or one of the game's own (listed in the `ERROR_CODES` of its binding) */
    public code: SharedErrorCode | (string & {}),
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
