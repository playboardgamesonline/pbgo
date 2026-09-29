export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000")

export const SLUG = "courtisans"

export const SANITY_PROJECT_ID = "2lo2f5sv"

// Valeurs par défaut, remplacées par les réglages de /setup (document Sanity « settings »)
export const NAME = "Courtisans Online"

export const TAGLINE = "Le banquet de la Reine, en ligne et entre amis"

export const DESCRIPTION =
  "Jouez à Courtisans en ligne, gratuitement, avec vos amis : de 2 à 5 joueurs, placez vos courtisans à la table de la Reine, faites briller ou disgracier les familles et devenez le favori de la cour. Adaptation web non officielle du jeu de cartes de Catch Up Games, sans inscription."

export const KEYWORDS = [
  "Courtisans",
  "Courtisans en ligne",
  "jeu de cartes en ligne",
  "jeu de société en ligne",
  "jeu entre amis",
  "Catch Up Games",
  "banquet de la Reine",
  "jeu gratuit",
  "multijoueur",
]

export const AUTHOR = { name: "oré", signature: "oré ˖ ࣪⊹", url: "https://ore.today" }

export const GENRES = ["Jeu de cartes", "Jeu de société", "Jeu de bluff"]

export const CONTACT = "louvel.aurelien.pro@gmail.com"

export const GOOGLE_SITE_VERIFICATION = "NNqyjwU_KDPRURSnEMUynx4l6Vrl_ELFzR99g8dBudQ"
