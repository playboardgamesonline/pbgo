export const TEXTES_REGLES_DEFAUT = {
  videoId: "ClROWcPTZHk",
  videoTitle: "Les règles en vidéo",
  goalTitle: "But du jeu",
  flowTitle: "Déroulement de la partie",
  turnTitle: "Tour d'un joueur",
  rolesTitle: "Les rôles",
  scoringTitle: "Fin de partie",
  goalIntro:
    "À chacun de vos tours, vous jouez 3 cartes. L'une va à la table de la reine et fait pencher le statut d'une famille, en bien ou en mal. Les deux autres vont dans votre domaine et dans celui d'un adversaire : elles rapportent ou coûtent des points selon le statut de leur famille.\n\nRépartissez bien vos cartes pour finir la partie avec le plus de points.",
  goalFamilies:
    "Papillon, crapaud, rossignol, lièvre, cerf et carpe : chacune finira {lumiere}, {disgrace} ou {neutre} selon ce qui se joue à la table de la reine.",
  goalMissions: "Une blanche et une bleue. Chaque mission réussie rapporte 3 points en fin de partie. Ne les dévoilez jamais.",
  flowIntro:
    "La partie se joue dans le sens des aiguilles d'une montre. Chaque joueur, en commençant par le premier, joue son tour en entier avant de passer la main au suivant.\n\nQuand la pioche est vide et que plus personne n'a de cartes en main, la partie s'arrête, chacun compte ses points et le plus haut total l'emporte.",
  flowMat:
    "Le tapis est posé au centre de la table. Les cartes Courtisan sont mélangées face cachée, puis une partie est écartée au hasard selon le nombre de joueurs.\n\n30 cartes à 2 joueurs, 18 à 3, 6 à 4, aucune à 5.",
  flowHand: "Chaque joueur reçoit 3 cartes Courtisan, face cachée. Les cartes restantes forment la pioche.",
  flowMissions: "Chaque joueur reçoit 2 missions, **une blanche et une bleue**, qu'il découvre en secret. Les autres missions ne servent pas pendant la partie.\n\nVous pouvez relire vos missions quand vous voulez, mais ne les montrez jamais à vos adversaires.",
  flowStart: "Le premier joueur est tiré au sort. **Le banquet peut commencer !**",
  turnIntro: "Jouez les 3 cartes de votre main, face visible, **une dans chacune des 3 zones**, dans l'ordre de votre choix.",
  turnTable:
    "Posez la carte dans la colonne de sa famille, au-dessus ou au-dessous du tapis. Majorité au-dessus : {lumiere}. Majorité au-dessous : {disgrace}.",
  turnDomain: "Chaque carte d'une famille {lumiere} vous rapportera 1 point, chaque carte d'une famille {disgrace} vous en fera perdre 1.",
  turnOpponent: "Même principe, mais pour lui : offrez-lui des familles en disgrâce, gardez la lumière pour vous.",
  turnEnd: "une fois vos 3 cartes jouées, vous en piochez 3 nouvelles pour votre prochain tour. Si la pioche est vide, c'était votre dernier tour : attendez que les autres terminent le leur.",
  rolesIntro: "Certains courtisans ont un rôle, indiqué par une icône aux quatre coins de la carte.",
  scoringIntro: "La partie s'arrête quand la pioche est vide et que plus personne n'a de cartes en main.",
  scoringReveal: "Tous les espions sont retournés. Ceux de la table de la reine rejoignent la colonne de leur famille, en restant du même côté du tapis : au-dessus s'ils étaient au-dessus, au-dessous sinon.",
  scoringStatus: "Plus de cartes au-dessus du tapis : la famille est {lumiere}. Plus de cartes au-dessous : elle est {disgrace}. À égalité : elle est {neutre}.\n\nLes nobles comptent pour 2 cartes.",
  scoringPoints:
    "Chaque courtisan d'une famille dans la lumière vous rapporte 1 point, chaque courtisan d'une famille en disgrâce vous en retire 1, les familles neutres ne comptent pas. Les nobles valent double.\n\nChaque mission réussie ajoute 3 points. Le plus haut total gagne ; en cas d'égalité, la victoire est partagée.",
}

export type TextesRegles = typeof TEXTES_REGLES_DEFAUT

export const REGLES_ROLES_DEFAUT = {
  noble: "Compte pour 2 cartes en fin de partie, dans un domaine comme à la table de la reine.",
  garde: "Ne peut pas être éliminé par un assassin : il ne quitte jamais le jeu.",
  espion: "Se joue toujours face cachée et ne peut jamais être regardé, même par celui qui l'a posé.\n\nÀ la table de la reine, il va dans la colonne de la reine, au-dessus ou au-dessous du tapis, pour ne pas trahir sa famille.",
  assassin: "En le posant, vous pouvez éliminer n'importe quelle autre carte de la même zone, à la table de la reine comme dans un domaine, quelles que soient sa famille et sa position. Un espion peut être éliminé sans être regardé, mais jamais un garde.\n\nLa carte éliminée quitte définitivement la partie. Ce pouvoir est facultatif.",
}

export const CADRE_PICTO_DEFAUT = "/rules/PICTOGRAM_FRAME.svg"

export const ANCIENS_TEXTES_REGLES: Record<string, string> = {
  turnTitle: "Tour de jeu",
  goalIntro: "À chaque tour, vous jouez vos 3 cartes. L'une influence le statut d'une famille à la table de la reine, les deux autres font gagner ou perdre des points, chez vous et chez un adversaire. Terminez la partie avec le plus de points.",
  flowIntro: "Une partie se joue dans le sens des aiguilles d'une montre. En commençant par le premier joueur, chacun effectue son tour complètement, puis on passe au joueur suivant. La partie se termine lorsque la pioche est vide et que plus aucun joueur n'a de cartes en main.",
  flowMat: "Le tapis est placé au centre de la table. Les cartes Courtisan sont mélangées, puis certaines sont écartées selon le nombre de joueurs : 30 à 2 joueurs, 18 à 3, 6 à 4, aucune à 5.",
  flowMissions: "Chaque joueur reçoit 2 missions, **une blanche et une bleue**, à garder secrètes. Vous pouvez les consulter à tout moment.",
  turnEnd: "vous piochez automatiquement 3 nouvelles cartes. Si la pioche est vide, c'était votre dernier tour.",
  scoringReveal: "Ceux de la table rejoignent la colonne de leur famille, sans changer de niveau.",
  scoringStatus: "Plus de cartes au-dessus : {lumiere}. Plus au-dessous : {disgrace}. Sinon : {neutre}. Les nobles comptent double.",
  scoringPoints: "+1 par courtisan d'une famille dans la lumière, −1 par courtisan d'une famille en disgrâce, +3 par mission réussie. Le plus haut total l'emporte, les ex-aequo partagent la victoire.",
  scoringTitle: "Décompte",
}

export const ANCIENNES_REGLES_ROLES: Record<string, string> = {
  espion: "Toujours joué face cachée, personne ne peut le regarder. À la table, il rejoint la colonne de la reine.",
  assassin: "En le posant, vous pouvez éliminer une autre carte de la même zone (sauf un garde), espions compris. Facultatif.",
}
