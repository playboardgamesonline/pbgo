import type { Locale } from "./i18n"

export type RulesSection = { title: string; text: string; image: string | null }
export type RulesContent = { intro: string; sections: RulesSection[]; videoId: string | null }

export const DEFAULT_RULES: RulesContent = {
  intro: "De 2 à 6 joueurs. Remportez le plus de plis en posant la carte la plus haute.",
  videoId: null,
  sections: [
    {
      title: "But du jeu",
      text: "Chaque pli remporté rapporte **1 point**. Après le nombre de manches choisi par l'hôte, le joueur qui a le plus de points l'emporte.",
      image: null,
    },
    {
      title: "Mise en place",
      text: "Le paquet compte 40 cartes : 4 couleurs, valeurs 1 à 10.\n\nChaque joueur reçoit le nombre de cartes choisi dans les options (réduit si le paquet ne suffit pas).",
      image: null,
    },
    {
      title: "Tour d'un joueur",
      text: "À votre tour, posez une carte de votre main au centre de la table.\n\nQuand chacun a posé une carte, la plus haute remporte le pli (la plus basse avec la variante inversée). En cas d'égalité, la première posée l'emporte. Le gagnant du pli commence le suivant.",
      image: null,
    },
    {
      title: "Fin de partie",
      text: "Quand les mains sont vides, une nouvelle manche commence avec le joueur suivant. Après la dernière manche, le plus haut total gagne ; les ex-aequo partagent la victoire.",
      image: null,
    },
  ],
}

const sections = (rows: [string, string][]): RulesSection[] => rows.map(([title, text]) => ({ title, text, image: null }))

/** Règles par défaut du gabarit dans les autres langues (le français est `DEFAULT_RULES`). */
export const DEFAULT_RULES_I18N: Record<Exclude<Locale, "fr">, RulesContent> = {
  en: {
    intro: "2 to 6 players. Win the most tricks by playing the highest card.",
    videoId: null,
    sections: sections([
      ["Goal of the game", "Each trick won is worth **1 point**. After the number of rounds chosen by the host, the player with the most points wins."],
      ["Setup", "The deck has 40 cards: 4 suits, values 1 to 10.\n\nEach player receives the number of cards chosen in the options (fewer if the deck is not big enough)."],
      ["A player's turn", "On your turn, play a card from your hand to the center of the table.\n\nOnce everyone has played a card, the highest wins the trick (the lowest with the reverse variant). On a tie, the first card played wins. The trick winner starts the next one."],
      ["End of the game", "When hands are empty, a new round starts with the next player. After the last round, the highest total wins; ties share the victory."],
    ]),
  },
  es: {
    intro: "De 2 a 6 jugadores. Gana el mayor número de bazas jugando la carta más alta.",
    videoId: null,
    sections: sections([
      ["Objetivo del juego", "Cada baza ganada vale **1 punto**. Tras el número de rondas elegido por el anfitrión, gana el jugador con más puntos."],
      ["Preparación", "La baraja tiene 40 cartas: 4 palos, valores del 1 al 10.\n\nCada jugador recibe el número de cartas elegido en las opciones (menos si la baraja no alcanza)."],
      ["Turno de un jugador", "En tu turno, juega una carta de tu mano en el centro de la mesa.\n\nCuando todos han jugado una carta, la más alta gana la baza (la más baja con la variante invertida). En caso de empate, gana la primera carta jugada. El ganador de la baza empieza la siguiente."],
      ["Fin de la partida", "Cuando las manos están vacías, empieza una nueva ronda con el jugador siguiente. Tras la última ronda gana el total más alto; los empates comparten la victoria."],
    ]),
  },
  de: {
    intro: "2 bis 6 Spieler. Gewinne die meisten Stiche, indem du die höchste Karte spielst.",
    videoId: null,
    sections: sections([
      ["Ziel des Spiels", "Jeder gewonnene Stich bringt **1 Punkt**. Nach der vom Gastgeber gewählten Rundenzahl gewinnt der Spieler mit den meisten Punkten."],
      ["Vorbereitung", "Das Kartenspiel hat 40 Karten: 4 Farben, Werte 1 bis 10.\n\nJeder Spieler erhält die in den Optionen gewählte Kartenzahl (weniger, wenn das Spiel nicht reicht)."],
      ["Zug eines Spielers", "Spiele in deinem Zug eine Karte aus deiner Hand in die Tischmitte.\n\nHaben alle eine Karte gespielt, gewinnt die höchste den Stich (die niedrigste bei der umgekehrten Variante). Bei Gleichstand gewinnt die zuerst gespielte Karte. Der Stichgewinner beginnt den nächsten."],
      ["Ende der Partie", "Sind die Hände leer, beginnt eine neue Runde mit dem nächsten Spieler. Nach der letzten Runde gewinnt die höchste Summe; bei Gleichstand teilen sich die Spieler den Sieg."],
    ]),
  },
}
