export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000")

export const TITRE = "Courtisans Online"

export const DESCRIPTION =
  "Jouez à Courtisans en ligne, gratuitement, avec vos amis : de 2 à 5 joueurs, placez vos courtisans à la table de la Reine, faites briller ou disgracier les familles et devenez le favori de la cour. Adaptation web non officielle du jeu de cartes de Catch Up Games, sans inscription."
