import * as binding from "@pgo/binding"
import type { OptionValues } from "@pgo/binding"
import type { PublicGame } from "./game-types"
import { isPreviewWindow } from "./preview"

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
  TAKEOVER_UNSUPPORTED: "Ce jeu ne permet pas de jouer à la place d'un joueur absent.",
  // messages propres au jeu (codes d'erreur du moteur) : export facultatif `ERROR_MESSAGES` de @pgo/binding
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

async function apiRequest(path: string, init?: RequestInit): Promise<PublicGame> {
  if (isPreview()) return new Promise<PublicGame>(() => {})
  const response = await fetch(path, { ...init, headers: { "Content-Type": "application/json" }, cache: "no-store" })
  const data = await response.json().catch(() => ({ error: "SERVER_ERROR" }))
  if (!response.ok) throw new ApiClientError(data.error ?? "SERVER_ERROR")
  return data as PublicGame
}

const post = (path: string, body?: unknown) => apiRequest(path, { method: "POST", body: JSON.stringify(body ?? {}) })

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
  debug: (code: string, command: ClientDebugCommand) => post(`/api/games/${code}/debug`, { command }),
}

export const gameLink = (code: string) => `${window.location.origin}/game/${code}`
