import * as binding from "@pbgo/binding"
import type { OptionValues } from "@pbgo/binding"
import type { PublicGame } from "./game-types"
import type { ChatMessage, ChatReaction } from "./chat"
import { isPreviewWindow } from "./preview"
import { withBase } from "./base-path"

/** Messages d'erreur par défaut (core + moteur du jeu), remplaçables dans l'admin (page Copy). */
export const DEFAULT_ERROR_MESSAGES: Record<string, string> = {
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
  SERVER_ERROR: "Une erreur est survenue.",
  EMPTY_TEXT: "Écrivez d'abord votre message.",
  INVALID_EMAIL: "Cette adresse e-mail n'est pas valide.",
  INVALID_IMAGE: "Cette image n'est pas lisible (PNG, JPG ou WebP).",
  FILE_TOO_BIG: "Cette capture est trop lourde (3 Mo maximum).",
  TOO_MANY_REQUESTS: "Trop d'envois : réessayez dans un instant.",
  FORBIDDEN: "Action refusée.",
  TAKEOVER_UNSUPPORTED: "Ce jeu ne permet pas de jouer à la place d'un joueur absent.",
  // messages propres au jeu (codes d'erreur du moteur) : export facultatif `ERROR_MESSAGES` de @pbgo/binding
  ...(binding as { ERROR_MESSAGES?: Record<string, string> }).ERROR_MESSAGES,
}

let overrides: Record<string, string> = {}

/** Appelé par le SkinProvider avec les messages remplacés dans Sanity. */
export function setErrorOverrides(messages: Record<string, string>) {
  overrides = messages
}

export class ApiClientError extends Error {
  constructor(public code: string) {
    super(overrides[code] ?? DEFAULT_ERROR_MESSAGES[code] ?? overrides.SERVER_ERROR ?? DEFAULT_ERROR_MESSAGES.SERVER_ERROR)
  }
}

/** Aperçu de l'admin : les appels ne partent pas (la promesse reste en attente, sans erreur affichée). */
const isPreview = isPreviewWindow

async function apiRequest<T = PublicGame>(path: string, init?: RequestInit): Promise<T> {
  if (isPreview()) return new Promise<T>(() => {})
  const response = await fetch(withBase(path), { ...init, headers: { "Content-Type": "application/json" }, cache: "no-store" })
  const data = await response.json().catch(() => ({ error: "SERVER_ERROR" }))
  if (!response.ok) throw new ApiClientError(data.error ?? "SERVER_ERROR")
  return data as T
}

const post = <T = PublicGame>(path: string, body?: unknown) => apiRequest<T>(path, { method: "POST", body: JSON.stringify(body ?? {}) })

export type Profile = { nickname: string }
export type ClientDebugCommand = "start" | "turn" | "over" | (string & {})

export const api = {
  create: (profile: Profile) => post("/api/games", profile),
  read: (code: string) => apiRequest(`/api/games/${code}`),
  join: (code: string, profile: Profile) => post(`/api/games/${code}/join`, profile),
  leave: (code: string) => post(`/api/games/${code}/leave`),
  options: (code: string, options: OptionValues) => post(`/api/games/${code}/options`, { options }),
  start: (code: string) => post(`/api/games/${code}/start`),
  action: (code: string, action: { type: string } & Record<string, unknown>) => post(`/api/games/${code}/action`, action),
  replay: (code: string) => post(`/api/games/${code}/replay`),
  takeover: (code: string) => post(`/api/games/${code}/takeover`),
  /** Route propre au jeu (`app/api/games/[code]/<route>/route.ts` de l'app) : mêmes erreurs traduites et même neutralisation dans l'aperçu */
  custom: (code: string, route: string, body?: unknown) => post(`/api/games/${code}/${route}`, body),
  debug: (code: string, command: ClientDebugCommand) => post(`/api/games/${code}/debug`, { command }),
  /** Chat message or reaction: the server sets the author from the player cookie and broadcasts it (`id` matches the optimistic copy) */
  chat: (code: string, body: { id: string } & ({ text: string } | { reaction: string })) => post<ChatMessage | ChatReaction>(`/api/games/${code}/chat`, body),
}

export const gameLink = (code: string) => `${window.location.origin}${withBase(`/game/${code}`)}`
