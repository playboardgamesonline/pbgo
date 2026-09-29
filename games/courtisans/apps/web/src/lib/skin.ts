import type { SkinDefaults } from "@pgo/core/lib/skin"
import type { SiteSettings, ThemeColors } from "@pgo/core/lib/settings"

/** Habillage par défaut de Courtisans (images de /public), remplacé champ par champ par Sanity (`interface`, `texts`). */
export const DEFAULT_SKIN: SkinDefaults = {
  decor: {
    pattern: "/home/PATTERN.webp",
    top: { url: "/home/DECORATION_BANQUET_TOP.webp", ratio: null },
    bottom: { url: "/home/DECORATION_BANQUET_BOTTOM.webp", ratio: 3543 / 525 },
    hero: "/home/QUEEN.webp",
  },
  hostIcon: "/pictograms/PICTOGRAM_NOBLE.webp",
  playerColors: ["#a8603a", "#6f5b99", "#9c4c72", "#4f6478", "#7a5a3a"],
  desktopOnly: true,
  home: {
    title: "Bienvenue au banquet de la reine !",
    intro:
      "Ce soir a lieu le banquet de la reine. Un évènement majeur où les familles du royaume veulent se montrer à leur avantage. Les manœuvres vont bon train et tous les coups sont permis pour placer son favori sur le devant de la scène.",
  },
  victoryPhrases: [
    "L'homme qui sait courtiser est évidemment : {pseudo} ({points} pts)",
    "La Reine n'a d'yeux que pour {pseudo} ({points} pts)",
    "Toute la cour s'incline devant {pseudo} ({points} pts)",
  ],
  texts: {
    nicknamePlaceholder: "VÔTRE PRÉNOMMÉE…",
    createButton: "Courtiser au banquet",
    joinButton: "Courtiser au banquet",
    chooseNickname: "Choisissez d'abord votre appellation.",
    linkCopied: "Lien du banquet copié !",
    codeLabel: "Code du banquet",
    copyLink: "Copier le lien du banquet",
    joinGameButton: "Rejoindre le banquet",
    gameNotFound: "Ce banquet est introuvable. Vérifiez le code {code} ou organisez-en un nouveau.",
    alreadyStarted: "Ce banquet a déjà commencé.",
    shareInvite: "Partagez le code ou le lien du banquet à vos convives.",
    startButton: "Ouvrir le banquet",
    waitingPlayers: "En attente de convives…",
    waiting: "Les convives s'installent…",
    gameOver: "Fin du banquet",
    leave: "Quitter la partie",
    winnerTitle: "La cour s'incline devant",
  },
}

const THEME: ThemeColors = { background: "#0e3940", foreground: "#f0e9ce", accent: "#e2b54a", surface: "#185058", surfaceDark: "#031622" }

/** Réglages par défaut (quand le document Sanity « settings » est vide). */
export const SETTINGS_DEFAULTS: Partial<Omit<SiteSettings, "theme">> & { theme: ThemeColors } = {
  logo: "/LOGO.webp",
  theme: THEME,
  credits: {
    authors: "Romaric Galonnier et Anthony Perone, illustré par Noëmie Chevalier",
    publisher: "Catch Up Games",
    publisherUrl: "https://catchupgames.com/nos-jeux/courtisans/",
  },
}
