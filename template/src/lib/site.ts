export const SLUG = "template"

// Defaults, replaced by the gamemaster settings (/gamemaster/<slug>, Sanity document "settings")
export const NAME = "La Plus Haute"

export const KEYWORDS = ["jeu de cartes en ligne", "jeu de société en ligne", "jeu entre amis", "jeu gratuit", "multijoueur"]

export const AUTHOR = { name: "oré", signature: "oré ˖ ࣪⊹", url: "https://ore.today" }

export const CONTACT = "hey@playboardgamesonline.app"

/**
 * The codes of the game's own refusals: the ones the engine throws that are not shared by every game (`SHARED_ERROR_CODES` of `@pbgo/engine-kit`, which the platform words: not your turn,
 * unknown card, wrong phase…). Their messages are written in Sanity (Gamemaster › Copy › Errors). `error-codes.test.ts` keeps this list and the engine in step.
 */
export const ERROR_CODES = ["INVALID_BID"]
