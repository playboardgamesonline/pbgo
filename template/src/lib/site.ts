export const SLUG = "template"

/** URL of a file of `apps/web/public/<slug>` (the game's static files, served at /<slug>/...). */
export const asset = (path: string) => `/${SLUG}${path}`

// Defaults, replaced by the gamemaster settings (/gamemaster/<slug>, Sanity document "settings")
export const NAME = "La Plus Haute"

export const TAGLINE = "Le socle commun des jeux de société en ligne"

export const DESCRIPTION =
  "Template des jeux de société en ligne : lobby, configuration de partie, temps réel, plateau 3D, fin de partie et partage. Jeu de démonstration : La Plus Haute."

export const KEYWORDS = ["jeu de cartes en ligne", "jeu de société en ligne", "jeu entre amis", "jeu gratuit", "multijoueur"]

export const AUTHOR = { name: "oré", signature: "oré ˖ ࣪⊹", url: "https://ore.today" }

export const CONTACT = "hey@playboardgamesonline.app"

/** Genres of the home page's structured data (`SEO` in server.ts). */
export const GENRES = ["Jeu de cartes", "Jeu de plis"]

/** French messages of the codes the engine throws and core does not know (core has its own for the common ones: not your turn, unknown card…). */
export const ERROR_MESSAGES: Record<string, string> = {
  INVALID_PHASE: "Ce n'est plus le moment de faire ça.",
  INVALID_BID: "Cette annonce n'est pas valide.",
}
