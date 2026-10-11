export const SLUG = "skull-king"

/** URL of a file of `apps/web/public/<slug>` (the game's static files, served at /<slug>/...). */
export const asset = (path: string) => `/${SLUG}${path}`

// Defaults, replaced by the /admin settings (Sanity document "settings")
export const NAME = "Skull King"

export const TAGLINE = "Le jeu de plis des pirates, en ligne"

export const DESCRIPTION =
  "Jouez à Skull King en ligne, gratuitement, avec vos amis : pariez sur le nombre de plis que vous allez remporter, déjouez les pirates, les sirènes et le Skull King, et amassez le plus gros butin. Adaptation web non officielle du jeu de cartes, sans inscription."

export const KEYWORDS = ["Skull King", "Skull King en ligne", "jeu de plis", "jeu de pirates", "jeu de cartes en ligne", "jeu de société en ligne", "jeu entre amis", "jeu gratuit", "multijoueur"]

export const AUTHOR = { name: "oré", signature: "oré ˖ ࣪⊹", url: "https://ore.today" }

export const CONTACT = "louvel.aurelien.pro@gmail.com"

export const STUDIO_URL = "https://skull-king.sanity.studio"

/** Genres of the home page's structured data (`SEO` in server.ts). */
export const GENRES = ["Jeu de cartes", "Jeu de plis", "Jeu de pirates"]
