declare const errorCode: unique symbol

/**
 * An error code of the API (`GAME_FULL`, `RANK_TOO_LOW`): capitals and underscores, which is all a code the site makes is. It is a brand on a string, so that
 * an event cannot be given any other text: `errorCodeOf` is the one way to get one.
 */
export type ErrorCode = string & { readonly [errorCode]: true }

/** What every code of ours looks like. */
const CODE = /^[A-Z][A-Z0-9_]{1,39}$/

/** The code of an error, or `UNKNOWN` when what it holds is not one (a message, a name, anything a person could have typed). */
export function errorCodeOf(value: unknown): ErrorCode {
  return (typeof value === "string" && CODE.test(value) ? value : "UNKNOWN") as ErrorCode
}
