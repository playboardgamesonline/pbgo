import { BASE_PATH } from "@pbgo/core/lib/base-path"

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000")

/** Public URL of this game: SITE_URL plus the base path it is served under (e.g. https://playboardgamesonline.app/courtisans). */
export const GAME_URL = `${SITE_URL}${BASE_PATH}`

export const SLUG = "courtisans"

/** Faux tant que le jeu n'est pas prêt : pages en noindex et sitemap vide. À passer à true à la mise en ligne du jeu. */
export const INDEXABLE = true

export const SANITY_PROJECT_ID = "2lo2f5sv"

// Valeurs par défaut, remplacées par les réglages de /admin (document Sanity « settings »)
export const NAME = "Courtisans"

export const TAGLINE = "Le banquet de la Reine, en ligne et entre amis"

export const DESCRIPTION =
  "Jouez à Courtisans en ligne, gratuitement, avec vos amis : de 2 à 5 joueurs, placez vos courtisans à la table de la Reine, faites briller ou disgracier les familles et devenez le favori de la cour. Adaptation web non officielle du jeu de cartes de Catch Up Games, sans inscription."

export const KEYWORDS = [
  "Courtisans",
  "Courtisans en ligne",
  "jeu de cartes en ligne",
  "jeu de société en ligne",
  "jeu entre amis",
  "Catch Up Games",
  "banquet de la Reine",
  "jeu gratuit",
  "multijoueur",
]

export const AUTHOR = { name: "oré", signature: "oré ˖ ࣪⊹", url: "https://ore.today" }

export const CONTACT = "louvel.aurelien.pro@gmail.com"

export const GOOGLE_SITE_VERIFICATION = "NNqyjwU_KDPRURSnEMUynx4l6Vrl_ELFzR99g8dBudQ"

/** Messages des erreurs du moteur (codes EngineError), affichés par @pbgo/core. */
export const ERROR_MESSAGES: Record<string, string> = {
  INVALID_PHASE: "Ce n'est pas le moment de jouer.",
  NOT_YOUR_TURN: "Ce n'est pas votre tour.",
  UNKNOWN_CARD: "Cette carte n'est plus dans votre main.",
  ZONE_ALREADY_PLAYED: "Vous avez déjà joué une carte dans cette zone ce tour-ci.",
  INVALID_TARGET: "Vous ne pouvez pas jouer cette carte ici.",
  INVALID_ASSASSINATION: "Cette carte ne peut pas être éliminée.",
  INVALID_PLAYERS: "Il faut de 2 à 5 joueurs.",
  NOT_ENOUGH_MISSIONS: "Il manque des missions pour lancer la partie.",
  UNKNOWN_PLAYER: "Ce joueur ne fait pas partie du banquet.",
  NOT_READY: "Validez d'abord vos missions.",
  NOT_ENOUGH_PLAYERS: "Il faut au moins 2 convives pour ouvrir le banquet.",
  GAME_FULL: "Ce banquet est complet (5 convives).",
}
