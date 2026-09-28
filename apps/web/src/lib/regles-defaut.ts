export const TEXTES_REGLES_DEFAUT = {
  videoId: "ClROWcPTZHk",
  goalIntro:
    "À chaque tour, vous jouez vos 3 cartes. L'une influence le statut d'une famille à la table de la reine, les deux autres font gagner ou perdre des points, chez vous et chez un adversaire. Terminez la partie avec le plus de points.",
  goalFamilies:
    "Papillon, crapaud, rossignol, lièvre, cerf et carpe : chacune finira {lumiere}, {disgrace} ou {neutre} selon ce qui se joue à la table de la reine.",
  goalMissions: "Une blanche et une bleue. Chaque mission réussie rapporte 3 points en fin de partie. Ne les dévoilez jamais.",
  turnIntro: "Jouez les 3 cartes de votre main, face visible, **une dans chacune des 3 zones**, dans l'ordre de votre choix.",
  turnTable:
    "Posez la carte dans la colonne de sa famille, au-dessus ou au-dessous du tapis. Majorité au-dessus : {lumiere}. Majorité au-dessous : {disgrace}.",
  turnDomain: "Chaque carte d'une famille {lumiere} vous rapportera 1 point, chaque carte d'une famille {disgrace} vous en fera perdre 1.",
  turnOpponent: "Même principe, mais pour lui : offrez-lui des familles en disgrâce, gardez la lumière pour vous.",
  turnEnd: "vous piochez automatiquement 3 nouvelles cartes. Si la pioche est vide, c'était votre dernier tour.",
  rolesIntro: "Certains courtisans ont un rôle, indiqué par une icône aux quatre coins de la carte.",
  spyCaption: "L'espion rejoint la colonne de la reine sans révéler sa famille.",
  assassinCaption: "Un assassin du rossignol, joué au-dessous de la table, élimine une noble du lièvre au-dessus.",
  scoringIntro: "La partie s'arrête quand la pioche est vide et que plus personne n'a de cartes en main.",
  scoringReveal: "Ceux de la table rejoignent la colonne de leur famille, sans changer de niveau.",
  scoringStatus: "Plus de cartes au-dessus : {lumiere}. Plus au-dessous : {disgrace}. Sinon : {neutre}. Les nobles comptent double.",
  scoringPoints:
    "+1 par courtisan d'une famille dans la lumière, −1 par courtisan d'une famille en disgrâce, +3 par mission réussie. Le plus haut total l'emporte, les ex-aequo partagent la victoire.",
  domainCaption: "11 points : +11 (papillon, crapaud, cerf), −3 (rossignol), 0 (carpe), +3 pour la mission.",
}

export type TextesRegles = typeof TEXTES_REGLES_DEFAUT

export const REGLES_ROLES_DEFAUT = {
  noble: "Compte pour 2 cartes en fin de partie, dans un domaine comme à la table de la reine.",
  garde: "Ne peut pas être éliminé par un assassin : il ne quitte jamais le jeu.",
  espion: "Toujours joué face cachée, personne ne peut le regarder. À la table, il rejoint la colonne de la reine.",
  assassin: "En le posant, vous pouvez éliminer une autre carte de la même zone (sauf un garde), espions compris. Facultatif.",
}

export const VISUELS_REGLES_DEFAUT = {
  missionsVisual: null as string | null,
  tableVisual: "/regles/table-exemple.webp" as string | null,
  spyExample: "/regles/espion-exemple.webp" as string | null,
  assassinExample: "/regles/assassin-exemple.webp" as string | null,
  scoringTable: "/regles/decompte-table.webp" as string | null,
  scoringDomain: "/regles/decompte-domaine.webp" as string | null,
}

export type VisuelsRegles = typeof VISUELS_REGLES_DEFAUT
