export const SLUG = "sky-team"

/** URL of a file of `apps/web/public/<slug>` (the game's static files, served at /<slug>/...). */
export const asset = (path: string) => `/${SLUG}${path}`

// Defaults, replaced by the /admin settings (Sanity document "settings")
export const NAME = "Sky Team"

export const TAGLINE = "Le jeu coopératif d'atterrissage à deux, en ligne"

export const DESCRIPTION =
  "Jouez à Sky Team en ligne, gratuitement, à deux : pilote et copilote placez vos dés sans vous parler pour faire atterrir votre avion en toute sécurité. Adaptation web non officielle du jeu, sans inscription."

export const KEYWORDS = ["Sky Team", "Sky Team en ligne", "jeu coopératif à deux", "jeu de dés", "jeu de cartes en ligne", "jeu de société en ligne", "jeu entre amis", "jeu gratuit", "multijoueur"]

export const AUTHOR = { name: "oré", signature: "oré ˖ ࣪⊹", url: "https://ore.today" }

export const CONTACT = "louvel.aurelien.pro@gmail.com"

export const STUDIO_URL = "https://sky-team.sanity.studio"

/** Genres of the home page's structured data (`SEO` in server.ts). */
export const GENRES = ["Jeu de société", "Jeu coopératif", "Jeu à deux"]
