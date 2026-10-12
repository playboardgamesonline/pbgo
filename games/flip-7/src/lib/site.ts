export const SLUG = "flip-7"

/** URL of a file of `apps/web/public/<slug>` (the game's static files, served at /<slug>/...). */
export const asset = (path: string) => `/${SLUG}${path}`

// Defaults, replaced by the /admin settings (Sanity document "settings")
export const NAME = "Flip 7"

export const TAGLINE = "Le jeu de stop ou encore, en ligne"

export const DESCRIPTION =
  "Jouez à Flip 7 en ligne, gratuitement, avec vos amis : retournez des cartes, poussez votre chance sans tirer de doublon et visez les 200 points. Adaptation web non officielle du jeu de cartes, sans inscription."

export const KEYWORDS = ["Flip 7", "Flip 7 en ligne", "jeu de stop ou encore", "push your luck", "jeu de cartes en ligne", "jeu de société en ligne", "jeu entre amis", "jeu gratuit", "multijoueur"]

export const AUTHOR = { name: "oré", signature: "oré ˖ ࣪⊹", url: "https://ore.today" }

export const CONTACT = "hey@playboardgamesonline.app"

export const STUDIO_URL = "https://flip-7.sanity.studio"

/** Genres of the home page's structured data (`SEO` in server.ts). */
export const GENRES = ["Jeu de cartes", "Jeu de stop ou encore"]
