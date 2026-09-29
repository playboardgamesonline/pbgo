import type { SiteConfig } from "@pgo/site"

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://play-flip-7-online.vercel.app"

export const NOM = "Flip 7"

export const TITRE = "Flip 7 Online"

export const ACCROCHE = "Le jeu de stop ou encore, en ligne"

export const DESCRIPTION =
  "Jouez à Flip 7 en ligne, gratuitement, avec vos amis : retournez des cartes, poussez votre chance sans tirer de doublon et visez les 200 points. Adaptation web non officielle du jeu de cartes, sans inscription."

export const MOTS_CLES = ["Flip 7", "Flip 7 en ligne", "jeu de stop ou encore", "push your luck", "jeu de cartes en ligne", "jeu de société en ligne", "jeu entre amis", "jeu gratuit", "multijoueur"]

export const COULEUR = "#1d1f5c"

export const LOGO: string | null = "/LOGO.webp"

export const SITE: SiteConfig = {
  url: SITE_URL,
  name: NOM,
  title: TITRE,
  tagline: ACCROCHE,
  description: DESCRIPTION,
  keywords: MOTS_CLES,
  color: COULEUR,
  colorScheme: "dark",
  genre: ["Jeu de cartes", "Jeu de stop ou encore"],
  playMode: "MultiPlayer",
  players: { min: 3, max: 18 },
}
