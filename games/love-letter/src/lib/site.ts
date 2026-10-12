export const SLUG = "love-letter"

/** URL of a file of `apps/web/public/<slug>` (the game's static files, served at /<slug>/...). */
export const asset = (path: string) => `/${SLUG}${path}`

// Defaults, replaced by the /admin settings (Sanity document "settings")
export const NAME = "Love Letter"

export const TAGLINE = "Le jeu de déduction de la princesse, en ligne"

export const DESCRIPTION =
  "Jouez à Love Letter en ligne, gratuitement, avec vos amis : faites parvenir votre lettre à la princesse en déduisant les cartes de vos rivaux, avec une seule carte en main. Adaptation web non officielle du jeu de cartes de Seiji Kanai, sans inscription."

export const KEYWORDS = ["Love Letter", "Love Letter en ligne", "jeu de déduction", "Seiji Kanai", "jeu de cartes en ligne", "jeu de société en ligne", "jeu entre amis", "jeu gratuit", "multijoueur"]

export const AUTHOR = { name: "oré", signature: "oré ˖ ࣪⊹", url: "https://ore.today" }

export const CONTACT = "hey@playboardgamesonline.app"

export const STUDIO_URL = "https://love-letter.sanity.studio"

/** Genres of the home page's structured data (`SEO` in server.ts). */
export const GENRES = ["Jeu de cartes", "Jeu de déduction"]
