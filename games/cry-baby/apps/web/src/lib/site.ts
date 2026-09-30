import type { SiteConfig } from "@pbgo/site"

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://play-cry-baby-online.vercel.app"

export const NOM = "Cry Baby"

export const TITRE = "Cry Baby Online"

export const ACCROCHE = "Le jeu de cartes, en ligne"

export const DESCRIPTION =
  "Jouez à Cry Baby en ligne, gratuitement, avec vos amis. Adaptation web non officielle du jeu de cartes, sans inscription."

export const MOTS_CLES = ["Cry Baby", "Cry Baby en ligne", "jeu de cartes en ligne", "jeu de société en ligne", "jeu entre amis", "jeu gratuit", "multijoueur"]

export const COULEUR = "#f7f1e3"

export const LOGO: string | null = "/LOGO.webp"

export const SITE: SiteConfig = {
  url: SITE_URL,
  name: NOM,
  title: TITRE,
  tagline: ACCROCHE,
  description: DESCRIPTION,
  keywords: MOTS_CLES,
  color: COULEUR,
  colorScheme: "light",
  genre: ["Jeu de cartes"],
  playMode: "MultiPlayer",
}
