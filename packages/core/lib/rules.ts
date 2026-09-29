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
