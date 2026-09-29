import type { SiteConfig } from "@pgo/site"

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://play-dracula-vs-van-helsing-online.vercel.app"

export const NOM = "Dracula vs Van Helsing"

export const TITRE = "Dracula vs Van Helsing Online"

export const ACCROCHE = "Le duel de cartes entre le vampire et le chasseur, en ligne"

export const DESCRIPTION =
  "Jouez à Dracula vs Van Helsing en ligne, gratuitement, en duel : Dracula et Van Helsing s'affrontent pour le sort des habitants de la ville. Adaptation web non officielle du jeu de cartes, sans inscription."

export const MOTS_CLES = ["Dracula vs Van Helsing", "Dracula vs Van Helsing en ligne", "jeu à deux", "jeu de cartes vampire", "jeu de cartes en ligne", "jeu de société en ligne", "jeu entre amis", "jeu gratuit", "multijoueur"]

export const COULEUR = "#150d14"

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
  genre: ["Jeu de cartes", "Jeu à deux"],
  playMode: "MultiPlayer",
  players: { min: 2, max: 2 },
}
