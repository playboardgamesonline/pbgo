export const SLUG = "timebomb"

/** URL of a file of `apps/web/public/<slug>` (the game's static files, served at /<slug>/...). */
export const asset = (path: string) => `/${SLUG}${path}`

// Defaults, replaced by the /admin settings (Sanity document "settings")
export const NAME = "Timebomb"

export const TAGLINE = "Le jeu de bluff et de rôles cachés, en ligne"

export const DESCRIPTION =
  "Jouez à Timebomb en ligne, gratuitement, avec vos amis : agents de Sherlock contre poseurs de bombe de Moriarty, coupez les bons fils et démasquez les traîtres avant l'explosion. Adaptation web non officielle du jeu de cartes, sans inscription."

export const KEYWORDS = ["Timebomb", "Time Bomb en ligne", "jeu de bluff", "jeu à rôles cachés", "jeu de cartes en ligne", "jeu de société en ligne", "jeu entre amis", "jeu gratuit", "multijoueur"]

export const AUTHOR = { name: "oré", signature: "oré ˖ ࣪⊹", url: "https://ore.today" }

export const CONTACT = "hey@playboardgamesonline.app"

export const STUDIO_URL = "https://timebomb.sanity.studio"

/** Genres of the home page's structured data (`SEO` in server.ts). */
export const GENRES = ["Jeu de cartes", "Jeu de bluff", "Jeu à rôles cachés"]
