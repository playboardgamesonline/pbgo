import type { SiteConfig } from "@pbgo/site"

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://play-timebomb-online.vercel.app"

export const NOM = "Timebomb"

export const TITRE = "Timebomb Online"

export const ACCROCHE = "Le jeu de bluff et de rôles cachés, en ligne"

export const DESCRIPTION =
  "Jouez à Timebomb en ligne, gratuitement, avec vos amis : agents de Sherlock contre poseurs de bombe de Moriarty, coupez les bons fils et démasquez les traîtres avant l'explosion. Adaptation web non officielle du jeu de cartes, sans inscription."

export const MOTS_CLES = ["Timebomb", "Time Bomb en ligne", "jeu de bluff", "jeu à rôles cachés", "jeu de cartes en ligne", "jeu de société en ligne", "jeu entre amis", "jeu gratuit", "multijoueur"]

export const COULEUR = "#17141a"

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
  genre: ["Jeu de cartes", "Jeu de bluff", "Jeu à rôles cachés"],
  playMode: "MultiPlayer",
  players: { min: 4, max: 8 },
}
