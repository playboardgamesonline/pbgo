export const SLUG = "dracula-vs-van-helsing"

/** URL of a file of `apps/web/public/<slug>` (the game's static files, served at /<slug>/...). */
export const asset = (path: string) => `/${SLUG}${path}`

// Defaults, replaced by the /admin settings (Sanity document "settings")
export const NAME = "Dracula vs Van Helsing"

export const TAGLINE = "Le duel de cartes entre le vampire et le chasseur, en ligne"

export const DESCRIPTION =
  "Jouez à Dracula vs Van Helsing en ligne, gratuitement, en duel : Dracula et Van Helsing s'affrontent pour le sort des habitants de la ville. Adaptation web non officielle du jeu de cartes, sans inscription."

export const KEYWORDS = ["Dracula vs Van Helsing", "Dracula vs Van Helsing en ligne", "jeu à deux", "jeu de cartes vampire", "jeu de cartes en ligne", "jeu de société en ligne", "jeu entre amis", "jeu gratuit", "multijoueur"]

export const AUTHOR = { name: "oré", signature: "oré ˖ ࣪⊹", url: "https://ore.today" }

export const CONTACT = "louvel.aurelien.pro@gmail.com"

export const STUDIO_URL = "https://dracula-vs-van-helsing.sanity.studio"

/** Genres of the home page's structured data (`SEO` in server.ts). */
export const GENRES = ["Jeu de cartes", "Jeu à deux"]
