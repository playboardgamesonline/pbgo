export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000")

export const SLUG = "exploding-kittens"

// Projet Sanity du jeu (remplacé par pnpm go-live)
export const SANITY_PROJECT_ID = "__SANITY_PROJECT_ID__"

// Defaults, overridden by the /admin settings (Sanity "settings" document)
export const NAME = "Exploding Kittens"


export const TAGLINE = "Le socle commun des jeux de société en ligne"

export const DESCRIPTION =
  "Template des jeux de société en ligne : lobby, configuration de partie, temps réel, plateau 3D, fin de partie et partage. Jeu de démonstration : La Plus Haute."

export const KEYWORDS = ["jeu de cartes en ligne", "jeu de société en ligne", "jeu entre amis", "jeu gratuit", "multijoueur"]



export const AUTHOR = { name: "oré", signature: "oré ˖ ࣪⊹", url: "https://ore.today" }

export const GENRES = ["Jeu de cartes", "Jeu de plis"]

export const CONTACT = "louvel.aurelien.pro@gmail.com"

