import type { OptionValues } from "@pbgo/engine-kit"
import type { PublicGame } from "./game-types"
import type { ChatMessage, ChatReaction } from "./chat"
import { missing } from "./missing"
import { isPreviewWindow } from "./preview"
import type { Profile } from "./profile"

/**
 * Error messages of the codes the platform words: the shared codes of the engines (`SHARED_ERROR_CODES` of engine-kit) and the codes of its own routes (English, the default
 * language; the others are `ERROR_TRANSLATIONS` of studio-kit), replaceable in the admin (Copy page). A game's own codes have no message here: they come from Sanity.
 */
export const CORE_ERROR_MESSAGES: Record<string, string> = {
  // What an engine refuses with, in every game
  INVALID_PLAYERS: "This game can't be played with this many players.",
  INVALID_ACTION: "This action isn't possible.",
  INVALID_PHASE: "This isn't possible at this stage of the game.",
  GAME_OVER: "The game is over.",
  NOT_YOUR_TURN: "It's not your turn.",
  NOT_WAITING: "The game is no longer waiting for this player: they played in the meantime.",
  UNKNOWN_PLAYER: "You are not a player of this game.",
  UNKNOWN_CARD: "This card is not in your hand.",
  INVALID_TARGET: "You can't choose this player.",
  AUTOPLAY_UNSUPPORTED: "This game can't play for this player.",
  // What the routes of a game refuse with
  INVALID_NICKNAME: "Pick a nickname.",
  INVALID_CODE: "This game code is not valid.",
  GAME_NOT_FOUND: "No game matches this code.",
  GAME_IN_PROGRESS: "This game has already started.",
  GAME_NOT_STARTED: "The game hasn't started yet.",
  GAME_NOT_OVER: "This game isn't over yet.",
  GAME_FULL: "This game is full.",
  HOST_ONLY: "Only the host can do that.",
  NOT_ENOUGH_PLAYERS: "More players are needed to start the game.",
  CODE_UNAVAILABLE: "Couldn't open the table, try again.",
  CONFLICT: "Someone played at the same time, try again.",
  DEBUG_DISABLED: "Debug is disabled on this server (DEBUG_GAMES=1).",
  NOT_STALLED: "The game is still moving: wait a little before playing for them.",
  TAKEOVER_UNSUPPORTED: "This game doesn't allow playing for an absent player.",
  INVALID_REQUEST: "This request isn't valid.",
  SERVER_ERROR: "Something went wrong.",
  EMPTY_TEXT: "Write your message first.",
  INVALID_EMAIL: "This email address is not valid.",
  INVALID_IMAGE: "This image can't be read (PNG, JPG or WebP).",
  FILE_TOO_BIG: "This screenshot is too large (3 MB maximum).",
  TOO_MANY_REQUESTS: "Too many submissions: try again in a moment.",
  RATE_LIMITED: "Too many requests: wait a few seconds before trying again.",
  FORBIDDEN: "Action refused.",
}

// The page shows one game at a time: `SkinProvider` sets the messages of its skin (Sanity, else the platform's translations of the core codes).
let overrides: Record<string, string> = {}

/** Called by `SkinProvider` with the messages of the skin shown. */
export function setErrorOverrides(messages: Record<string, string>) {
  overrides = messages
}

export class ApiClientError extends Error {
  constructor(public code: string) {
    super(overrides[code] ?? CORE_ERROR_MESSAGES[code] ?? missing(`errorMessages.${code}`))
  }
}

/** Admin previews: calls are not sent (the promise stays pending, no error shown). */
async function apiRequest<T = PublicGame>(path: string, init?: RequestInit): Promise<T> {
  if (isPreviewWindow()) return new Promise<T>(() => {})
  const response = await fetch(path, { ...init, headers: { "Content-Type": "application/json" }, cache: "no-store" })
  const data = await response.json().catch(() => ({ error: "SERVER_ERROR" }))
  if (!response.ok) throw new ApiClientError(data.error ?? "SERVER_ERROR")
  return data as T
}

const post = <T = PublicGame>(path: string, body?: unknown) => apiRequest<T>(path, { method: "POST", body: JSON.stringify(body ?? {}) })

/** Sends a request to a route of the current game (`/api/<slug>/...`) with the same error handling as the game calls. */
export const gameRequest = apiRequest

export type ClientDebugCommand = "start" | "turn" | "over" | (string & {})

function buildApi(slug: string) {
  const games = `/api/${slug}/games`
  return {
    /** `profile` is the nickname of a guest; a signed-in visitor sends none, the server sits them down as their account (`resolveSeat`). */
    create: (profile: Partial<Profile>) => post(games, profile),
    read: (code: string) => apiRequest(`${games}/${code}`),
    join: (code: string, profile: Partial<Profile>) => post(`${games}/${code}/join`, profile),
    leave: (code: string) => post(`${games}/${code}/leave`),
    options: (code: string, options: OptionValues) => post(`${games}/${code}/options`, { options }),
    start: (code: string) => post(`${games}/${code}/start`),
    /** "I'm ready", while the table is `starting` (PLT-107), sent by a player's board once it is loaded: the last player to say it begins the game */
    ready: (code: string) => post(`${games}/${code}/ready`),
    action: (code: string, action: { type: string } & Record<string, unknown>) => post(`${games}/${code}/action`, action),
    replay: (code: string) => post(`${games}/${code}/replay`),
    /** Votes to play for the players the game waits for (`playerIds`, by default all of them): they are played for once every present player has voted */
    takeover: (code: string, playerIds?: string[]) => post(`${games}/${code}/takeover`, { playerIds }),
    /** Route of the game itself (`ROUTES` of its server binding): same translated errors, same neutralization in the preview */
    custom: (code: string, route: string, body?: unknown) => post(`${games}/${code}/${route}`, body),
    debug: (code: string, command: ClientDebugCommand) => post(`${games}/${code}/debug`, { command }),
    /** Chat message or reaction: the server sets the author from the player cookie and broadcasts it (`id` matches the optimistic copy) */
    chat: (code: string, body: { id: string } & ({ text: string } | { reaction: string })) => post<ChatMessage | ChatReaction>(`${games}/${code}/chat`, body),
    /** Shareable link of a table */
    link: (code: string) => `${window.location.origin}/${slug}/game/${code}`,
  }
}

export type GameApi = ReturnType<typeof buildApi>

const apis = new Map<string, GameApi>()

/** API client of a game, memoized per slug. In a component, use `useApi()` from `lib/binding-context`. */
export function createApi(slug: string): GameApi {
  let api = apis.get(slug)
  if (!api) apis.set(slug, (api = buildApi(slug)))
  return api
}
