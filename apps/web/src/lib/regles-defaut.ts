export const TEXTES_REGLES_DEFAUT = {
  videoId: "ClROWcPTZHk",
  videoTitle: "Les règles en vidéo",
  goalTitle: "But du jeu",
  flowTitle: "Déroulement de la partie",
  turnTitle: "Tour de jeu",
  rolesTitle: "Les rôles",
  scoringTitle: "Fin de partie",
  goalIntro:
    "À chaque tour, vous jouez vos 3 cartes. L'une influence le statut d'une famille à la table de la reine, les deux autres font gagner ou perdre des points, chez vous et chez un adversaire. Terminez la partie avec le plus de points.",
  goalFamilies:
    "Papillon, crapaud, rossignol, lièvre, cerf et carpe : chacune finira {lumiere}, {disgrace} ou {neutre} selon ce qui se joue à la table de la reine.",
  goalMissions: "Une blanche et une bleue. Chaque mission réussie rapporte 3 points en fin de partie. Ne les dévoilez jamais.",
  flowIntro:
    "Une partie se joue dans le sens des aiguilles d'une montre. En commençant par le premier joueur, chacun effectue son tour complètement, puis on passe au joueur suivant. La partie se termine lorsque la pioche est vide et que plus aucun joueur n'a de cartes en main.",
  flowMat:
    "Le tapis est placé au centre de la table. Les cartes Courtisan sont mélangées, puis certaines sont écartées selon le nombre de joueurs : 30 à 2 joueurs, 18 à 3, 6 à 4, aucune à 5.",
  flowHand: "Chaque joueur reçoit 3 cartes Courtisan, face cachée. Les cartes restantes forment la pioche.",
  flowMissions: "Chaque joueur reçoit 2 missions, **une blanche et une bleue**, à garder secrètes. Vous pouvez les consulter à tout moment.",
  flowStart: "Le premier joueur est tiré au sort. **Le banquet peut commencer !**",
  turnIntro: "Jouez les 3 cartes de votre main, face visible, **une dans chacune des 3 zones**, dans l'ordre de votre choix.",
  turnTable:
    "Posez la carte dans la colonne de sa famille, au-dessus ou au-dessous du tapis. Majorité au-dessus : {lumiere}. Majorité au-dessous : {disgrace}.",
  turnDomain: "Chaque carte d'une famille {lumiere} vous rapportera 1 point, chaque carte d'une famille {disgrace} vous en fera perdre 1.",
  turnOpponent: "Même principe, mais pour lui : offrez-lui des familles en disgrâce, gardez la lumière pour vous.",
  turnEnd: "vous piochez automatiquement 3 nouvelles cartes. Si la pioche est vide, c'était votre dernier tour.",
  rolesIntro: "Certains courtisans ont un rôle, indiqué par une icône aux quatre coins de la carte.",
  scoringIntro: "La partie s'arrête quand la pioche est vide et que plus personne n'a de cartes en main.",
  scoringReveal: "Ceux de la table rejoignent la colonne de leur famille, sans changer de niveau.",
  scoringStatus: "Plus de cartes au-dessus : {lumiere}. Plus au-dessous : {disgrace}. Sinon : {neutre}. Les nobles comptent double.",
  scoringPoints:
    "+1 par courtisan d'une famille dans la lumière, −1 par courtisan d'une famille en disgrâce, +3 par mission réussie. Le plus haut total l'emporte, les ex-aequo partagent la victoire.",
}

export type TextesRegles = typeof TEXTES_REGLES_DEFAUT

export const REGLES_ROLES_DEFAUT = {
  noble: "Compte pour 2 cartes en fin de partie, dans un domaine comme à la table de la reine.",
  garde: "Ne peut pas être éliminé par un assassin : il ne quitte jamais le jeu.",
  espion: "Toujours joué face cachée, personne ne peut le regarder. À la table, il rejoint la colonne de la reine.",
  assassin: "En le posant, vous pouvez éliminer une autre carte de la même zone (sauf un garde), espions compris. Facultatif.",
}

export const CADRE_PICTO_DEFAUT = "/rules/PICTOGRAM_FRAME.svg"
