export const SLUG = "7-wonders"

/** URL of a file of `apps/web/public/<slug>` (the game's static files, served at /<slug>/...). */
export const asset = (path: string) => `/${SLUG}${path}`

// Defaults, replaced by the /admin settings (Sanity document "settings")
export const NAME = "7 Wonders"

export const TAGLINE = "Le jeu de cartes, en ligne"

export const DESCRIPTION =
  "Jouez à 7 Wonders en ligne, gratuitement, avec vos amis. Adaptation web non officielle du jeu de cartes, sans inscription."

export const KEYWORDS = ["7 Wonders", "7 Wonders en ligne", "jeu de cartes en ligne", "jeu de société en ligne", "jeu entre amis", "jeu gratuit", "multijoueur"]

export const AUTHOR = { name: "oré", signature: "oré ˖ ࣪⊹", url: "https://ore.today" }

export const CONTACT = "hey@playboardgamesonline.app"

/** Genres of the home page's structured data (`SEO` in server.ts). */
export const GENRES = ["Jeu de cartes"]
