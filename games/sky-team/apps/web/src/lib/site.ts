import type { SiteConfig } from "@pbgo/site"

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://play-sky-team-online.vercel.app"

export const NOM = "Sky Team"

export const TITRE = "Sky Team Online"

export const ACCROCHE = "Le jeu coopératif d'atterrissage à deux, en ligne"

export const DESCRIPTION =
  "Jouez à Sky Team en ligne, gratuitement, à deux : pilote et copilote placez vos dés sans vous parler pour faire atterrir votre avion en toute sécurité. Adaptation web non officielle du jeu, sans inscription."

export const MOTS_CLES = ["Sky Team", "Sky Team en ligne", "jeu coopératif à deux", "jeu de dés", "jeu de cartes en ligne", "jeu de société en ligne", "jeu entre amis", "jeu gratuit", "multijoueur"]

export const COULEUR = "#16243f"

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
  genre: ["Jeu de société", "Jeu coopératif", "Jeu à deux"],
  playMode: "CoOp",
  players: { min: 2, max: 2 },
}
