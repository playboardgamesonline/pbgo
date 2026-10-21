import type { OptionValues } from "@pbgo/engine-kit"
import type { PublicGame } from "./game-types"
import type { ChatMessage, ChatReaction } from "./chat"
import { missing } from "./missing"
import { isPreviewWindow } from "./preview"
import type { Profile } from "./profile"

/** Error messages of the platform's own error codes (French), replaceable in the admin (Copy page). A game's codes have no message here: they come from Sanity. */
export const CORE_ERROR_MESSAGES: Record<string, string> = {
  INVALID_NICKNAME: "Choisissez un pseudo.",
  INVALID_CODE: "Ce code de partie n'est pas valide.",
  GAME_NOT_FOUND: "Aucune partie ne correspond à ce code.",
  GAME_IN_PROGRESS: "Cette partie a déjà commencé.",
  GAME_FULL: "Cette partie est complète.",
  HOST_ONLY: "Seul l'hôte peut faire ça.",
  NOT_ENOUGH_PLAYERS: "Il manque des joueurs pour lancer la partie.",
  NOT_YOUR_TURN: "Ce n'est pas votre tour.",
  UNKNOWN_CARD: "Cette carte n'est pas dans votre main.",
  CONFLICT: "Quelqu'un a joué en même temps, réessayez.",
  DEBUG_DISABLED: "Le debug est désactivé sur ce serveur (DEBUG_GAMES=1).",
  NOT_STALLED: "La partie avance encore : attendez un peu avant de jouer à sa place.",
  NOT_WAITING: "La partie n'attend plus ce joueur : il a joué entre-temps.",
  SERVER_ERROR: "Une erreur est survenue.",
  EMPTY_TEXT: "Écrivez d'abord votre message.",
  INVALID_EMAIL: "Cette adresse e-mail n'est pas valide.",
  INVALID_IMAGE: "Cette image n'est pas lisible (PNG, JPG ou WebP).",
  FILE_TOO_BIG: "Cette capture est trop lourde (3 Mo maximum).",
  TOO_MANY_REQUESTS: "Trop d'envois : réessayez dans un instant.",
  RATE_LIMITED: "Trop de requêtes : patientez quelques secondes avant de réessayer.",
  FORBIDDEN: "Action refusée.",
  TAKEOVER_UNSUPPORTED: "Ce jeu ne permet pas de jouer à la place d'un joueur absent.",
  AUTOPLAY_UNSUPPORTED: "Ce jeu ne sait pas jouer à la place de ce joueur.",
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
    create: (profile: Profile) => post(games, profile),
    read: (code: string) => apiRequest(`${games}/${code}`),
    join: (code: string, profile: Profile) => post(`${games}/${code}/join`, profile),
    leave: (code: string) => post(`${games}/${code}/leave`),
    options: (code: string, options: OptionValues) => post(`${games}/${code}/options`, { options }),
    start: (code: string) => post(`${games}/${code}/start`),
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
