import type { SiteConfig } from "@pbgo/site"

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://play-skyjo-online.vercel.app"

export const NOM = "Skyjo"

export const TITRE = "Skyjo Online"

export const ACCROCHE = "Le jeu de cartes familial, en ligne"

export const DESCRIPTION =
  "Jouez à Skyjo en ligne, gratuitement, avec vos amis : retournez et échangez vos cartes pour finir chaque manche avec le moins de points possible, et éliminez des colonnes entières. Adaptation web non officielle du jeu de cartes, sans inscription."

export const MOTS_CLES = ["Skyjo", "Skyjo en ligne", "jeu de cartes familial", "jeu de cartes en ligne", "jeu de société en ligne", "jeu entre amis", "jeu gratuit", "multijoueur"]

export const COULEUR = "#123a52"

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
  genre: ["Jeu de cartes", "Jeu familial"],
  playMode: "MultiPlayer",
  players: { min: 2, max: 8 },
}
