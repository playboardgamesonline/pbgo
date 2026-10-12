export const SLUG = "omens"

/** URL of a file of `apps/web/public/<slug>` (the game's static files, served at /<slug>/...). */
export const asset = (path: string) => `/${SLUG}${path}`

// Defaults, replaced by the /admin settings (Sanity document "settings")
export const NAME = "Présages"

export const TAGLINE = "Le jeu de cartes des présages, en ligne"

export const DESCRIPTION =
  "Jouez à Présages (Omens) en ligne, gratuitement, avec vos amis. Adaptation web non officielle du jeu de cartes, sans inscription."

export const KEYWORDS = ["Présages", "Présages en ligne", "Omens", "Omens en ligne", "jeu de cartes en ligne", "jeu de société en ligne", "jeu entre amis", "jeu gratuit", "multijoueur"]

export const AUTHOR = { name: "oré", signature: "oré ˖ ࣪⊹", url: "https://ore.today" }

export const CONTACT = "hey@playboardgamesonline.app"

export const STUDIO_URL = "https://omens.sanity.studio"

/** Genres of the home page's structured data (`SEO` in server.ts). */
export const GENRES = ["Jeu de cartes"]
