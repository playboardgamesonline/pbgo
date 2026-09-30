import type { SiteConfig } from "@pbgo/site"

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://play-hanabi-online.vercel.app"

export const SITE: SiteConfig = {
  url: SITE_URL,
  name: "Hanabi",
  title: "Hanabi en ligne — le jeu coopératif de feux d'artifice",
  tagline: "Le jeu coopératif de feux d'artifice d'Antoine Bauza",
  description:
    "Jouez à Hanabi en ligne avec vos amis : le jeu de cartes coopératif d'Antoine Bauza où l'on compose ensemble un feu d'artifice sans voir ses propres cartes. De 2 à 5 joueurs, dès 10 ans.",
  keywords: ["Hanabi", "Hanabi en ligne", "jeu coopératif", "jeu de cartes", "feux d'artifice", "Antoine Bauza", "jeu de société en ligne", "jouer entre amis"],
  color: "#101b3e",
  colorScheme: "dark",
  genre: ["Jeu de cartes", "Jeu coopératif"],
  playMode: "CoOp",
  players: { min: 2, max: 5 },
}
