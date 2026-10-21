export const SLUG = "template"

// Defaults, replaced by the gamemaster settings (/gamemaster/<slug>, Sanity document "settings")
export const NAME = "La Plus Haute"

export const KEYWORDS = ["jeu de cartes en ligne", "jeu de société en ligne", "jeu entre amis", "jeu gratuit", "multijoueur"]

export const AUTHOR = { name: "oré", signature: "oré ˖ ࣪⊹", url: "https://ore.today" }

export const CONTACT = "hey@playboardgamesonline.app"

/** Genres of the home page's structured data (`SEO` in server.ts). */
export const GENRES = ["Jeu de cartes", "Jeu de plis"]

/** Codes the engine throws and core does not know (core has its own for the common ones: not your turn, unknown card…). Their messages are written in Sanity (Gamemaster › Copy › Errors). */
export const ERROR_CODES = ["INVALID_PHASE", "INVALID_BID"]
