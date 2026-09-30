import type { SiteConfig } from "@pbgo/site"

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://play-odin-online.vercel.app"

export const NOM = "Odin"

export const TITRE = "Odin Online"

export const ACCROCHE = "Le jeu de cartes des Vikings, en ligne"

export const DESCRIPTION =
  "Jouez à Odin en ligne, gratuitement, avec vos amis : posez des combinaisons toujours plus fortes et soyez le premier à vider votre main pour gagner la faveur des dieux. Adaptation web non officielle du jeu de cartes, sans inscription."

export const MOTS_CLES = ["Odin", "Odin en ligne", "jeu de défausse", "jeu de cartes viking", "jeu de cartes en ligne", "jeu de société en ligne", "jeu entre amis", "jeu gratuit", "multijoueur"]

export const COULEUR = "#16283b"

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
  genre: ["Jeu de cartes", "Jeu de défausse"],
  playMode: "MultiPlayer",
  players: { min: 2, max: 6 },
}
