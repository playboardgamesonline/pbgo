export const SLUG = "welcome-to"

/** URL of a file of `apps/web/public/<slug>` (the game's static files, served at /<slug>/...). */
export const asset = (path: string) => `/${SLUG}${path}`

// Defaults, replaced by the /admin settings (Sanity document "settings")
export const NAME = "Welcome To"

export const TAGLINE = "Le flip & write des quartiers de rêve, en ligne"

export const DESCRIPTION =
  "Jouez à Welcome To en ligne, gratuitement, avec vos amis : construisez le quartier le plus prisé des années 50 en numérotant vos maisons, en bâtissant piscines et parcs et en remplissant les plans de la ville. Adaptation web non officielle du jeu, sans inscription."

export const KEYWORDS = ["Welcome To", "Welcome To en ligne", "flip and write", "roll and write", "jeu de cartes en ligne", "jeu de société en ligne", "jeu entre amis", "jeu gratuit", "multijoueur"]

export const AUTHOR = { name: "oré", signature: "oré ˖ ࣪⊹", url: "https://ore.today" }

export const CONTACT = "hey@playboardgamesonline.app"

export const STUDIO_URL = "https://welcome-to.sanity.studio"

/** Genres of the home page's structured data (`SEO` in server.ts). */
export const GENRES = ["Jeu de société", "Flip and write"]
