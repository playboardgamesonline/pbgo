import type { SiteConfig } from "@pgo/site"

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://play-skull-king-online.vercel.app"

export const NOM = "Skull King"

export const TITRE = "Skull King Online"

export const ACCROCHE = "Le jeu de plis des pirates, en ligne"

export const DESCRIPTION =
  "Jouez à Skull King en ligne, gratuitement, avec vos amis : pariez sur le nombre de plis que vous allez remporter, déjouez les pirates, les sirènes et le Skull King, et amassez le plus gros butin. Adaptation web non officielle du jeu de cartes, sans inscription."

export const MOTS_CLES = ["Skull King", "Skull King en ligne", "jeu de plis", "jeu de pirates", "jeu de cartes en ligne", "jeu de société en ligne", "jeu entre amis", "jeu gratuit", "multijoueur"]

export const COULEUR = "#13213a"

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
  genre: ["Jeu de cartes", "Jeu de plis", "Jeu de pirates"],
  playMode: "MultiPlayer",
  players: { min: 2, max: 8 },
}
