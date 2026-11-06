import "server-only"
import { createHash, randomBytes } from "node:crypto"

/**
 * A guest's identity at the tables of a game comes in two halves, so that what everybody sees can never be what proves who someone is:
 *
 * - the SECRET, in the game's `<slug>_player` cookie: 32 random bytes in base64url, 43 characters. It is the only credential. It goes to
 *   the one browser it was made for (`Set-Cookie`) and comes back with that browser's requests: no response, page, row, event or log holds it.
 * - the PLAYER ID, which the rest of the code knows (`getPlayerId`): the seat in `games.players`, `host_id`, the engine's `PlayerInfo.id`,
 *   `meId`, the chat, the presence, the votes, the statistics and the feedback. It is the first 128 bits of the SHA-256 of the secret, in hex.
 *   A table hands it to whoever reads it, so it is public; it proves nothing, since the server only takes a secret for a cookie
 *   (`isPlayerSecret`) and no hash can be turned back into the secret it came from.
 *
 * Server only: a client component that imports this fails the build, which keeps the secret out of every bundle.
 */

const SECRET = /^[A-Za-z0-9_-]{43}$/

/**
 * True for a value that `newPlayerSecret` could have made, the only kind of value the server takes for a cookie. A player id is not
 * one, and neither is a UUID: before the two halves were told apart the cookie held the player id itself, a value that every table it
 * seated still shows.
 */
export const isPlayerSecret = (value: string): boolean => SECRET.test(value)

export const newPlayerSecret = (): string => randomBytes(32).toString("base64url")

/** The player id of a secret in a game: the same at every table of the game, different in another game. */
export const playerIdOf = (slug: string, secret: string): string =>
  createHash("sha256").update(`pbgo:player:${slug}:${secret}`).digest("hex").slice(0, 32)
