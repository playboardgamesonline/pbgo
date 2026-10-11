export const SLUG = "hanabi"

/** URL of a file of `apps/web/public/<slug>` (the game's static files, served at /<slug>/...). */
export const asset = (path: string) => `/${SLUG}${path}`

// Defaults, replaced by the /admin settings (Sanity document "settings")
export const NAME = "Hanabi"

export const TAGLINE = "Le jeu coopératif de feux d'artifice d'Antoine Bauza"

export const DESCRIPTION =
  "Jouez à Hanabi en ligne avec vos amis : le jeu de cartes coopératif d'Antoine Bauza où l'on compose ensemble un feu d'artifice sans voir ses propres cartes. De 2 à 5 joueurs, dès 10 ans."

export const KEYWORDS = ["Hanabi", "Hanabi en ligne", "jeu coopératif", "jeu de cartes", "feux d'artifice", "Antoine Bauza", "jeu de société en ligne", "jouer entre amis"]

export const AUTHOR = { name: "oré", signature: "oré ˖ ࣪⊹", url: "https://ore.today" }

export const CONTACT = "louvel.aurelien.pro@gmail.com"

export const STUDIO_URL = "https://hanabi.sanity.studio"

/** Genres of the home page's structured data (`SEO` in server.ts). */
export const GENRES = ["Jeu de cartes", "Jeu coopératif"]
