export const TEXTES_REGLES_DEFAUT = {
  videoId: "ClROWcPTZHk",
  videoTitle: "Les règles en vidéo",
  goalTitle: "But du jeu",
  flowTitle: "Déroulement de la partie",
  turnTitle: "Tour d'un joueur",
  rolesTitle: "Les rôles",
  scoringTitle: "Fin de partie",
  goalIntro:
    "Dans Courtisans, vous recevez 3 cartes à chaque tour et vous les jouez toutes. L'une part à la table de la reine, où elle améliore ou dégrade le statut d'une famille. Les deux autres se posent chez vous et chez un adversaire : selon le statut de leur famille, elles feront gagner ou perdre des points.\n\nRéfléchissez bien à la répartition de vos 3 cartes : c'est elle qui vous permettra de finir avec le plus de points et de remporter la partie.",
  goalFamilies:
    "Le jeu compte 90 cartes Courtisan, réparties en 6 familles de 15 : papillon, crapaud, rossignol, lièvre, cerf et carpe. En fin de partie, chaque famille sera {lumiere}, {disgrace} ou {neutre}, selon ce qui s'est joué à la table de la reine.",
  goalMissions: "Le jeu compte 20 missions, 10 blanches et 10 bleues. Chaque joueur en reçoit une de chaque couleur et la garde secrète : chaque mission validée en fin de partie rapporte 3 points de plus.",
  flowIntro:
    "Courtisans se joue dans le sens horaire. Le premier joueur joue son tour en entier, puis c'est au joueur suivant, et ainsi de suite.\n\nLa partie prend fin quand la pioche est épuisée et que plus personne n'a de carte en main. Chacun fait alors le compte de ses points, et le meilleur total l'emporte.",
  flowMat:
    "Le tapis est placé au milieu de la table. On mélange toutes les cartes Courtisan sans les regarder, puis on en retire au hasard, face cachée, selon le nombre de joueurs :\n\n2 joueurs : 30 cartes retirées (60 restent dans la pioche)\n3 joueurs : 18 cartes retirées (72 restent)\n4 joueurs : 6 cartes retirées (84 restent)\n5 joueurs : aucune, la pioche est complète",
  flowHand: "Chaque joueur reçoit 3 cartes Courtisan face cachée et les regarde sans les montrer. Le reste des cartes forme la pioche, face cachée, à côté du tapis.",
  flowMissions: "Chaque joueur reçoit ensuite 2 missions, **une blanche et une bleue**, qu'il découvre en secret et garde près de lui. Les missions restantes retournent dans la boîte sans être regardées : elles ne servent pas.\n\nVous pouvez relire vos missions à tout moment, mais vos adversaires ne doivent jamais les voir.",
  flowStart: "Le premier joueur est choisi au hasard. **Le banquet peut commencer !**",
  turnIntro: "À votre tour, vous jouez obligatoirement les 3 cartes de votre main, face visible, **une dans chacune des 3 zones** ci-dessous. L'ordre est libre, tant que chaque zone reçoit exactement une carte.",
  turnTable:
    "Posez la carte dans la colonne de sa famille, au choix au-dessus ou au-dessous du tapis.\n\nEn fin de partie, une famille qui a plus de cartes au-dessus sera {lumiere} ; une famille qui en a plus au-dessous sera {disgrace}.",
  turnDomain: "En fin de partie, chaque carte d'une famille {lumiere} vous rapporte 1 point, et chaque carte d'une famille {disgrace} vous en coûte 1.",
  turnOpponent: "Même calcul, mais pour l'adversaire choisi : chaque carte d'une famille {lumiere} lui rapporte 1 point, chaque carte d'une famille {disgrace} lui en retire 1.",
  turnEnd: "après avoir joué vos 3 cartes, piochez-en 3 nouvelles pour le tour suivant. Si la pioche est épuisée, c'était votre dernier tour : patientez jusqu'à la fin du tour de table.",
  rolesIntro: "Certains courtisans ont un rôle : on le reconnaît à un objet dans l'illustration et à l'icône présente aux quatre coins de la carte. Il existe 4 rôles, chacun avec son propre effet.",
  scoringIntro: "La partie s'arrête quand la pioche est épuisée et que plus aucun joueur n'a de carte en main.",
  scoringReveal: "Tous les espions (les cartes face cachée) sont retournés. Ceux de la table de la reine rejoignent la colonne de leur famille en gardant leur niveau : au-dessus s'ils étaient au-dessus, au-dessous s'ils étaient au-dessous.",
  scoringStatus: "On établit ensuite le statut de chaque famille à la table de la reine. Plus de cartes au-dessus du tapis : elle est {lumiere}. Plus au-dessous : elle est {disgrace}. Sans majorité : elle est {neutre}. Les nobles comptent pour 2 cartes.",
  scoringPoints:
    "Chacun calcule ensuite son total : +1 point par courtisan d'une famille dans la lumière, −1 par courtisan d'une famille en disgrâce, rien pour les familles neutres. Les nobles comptent pour 2.\n\nChacun révèle enfin ses missions : chaque mission validée ajoute 3 points, les autres ne rapportent rien. Le meilleur total remporte la partie ; en cas d'égalité, la victoire est partagée.",
}

export type TextesRegles = typeof TEXTES_REGLES_DEFAUT

export const REGLES_ROLES_DEFAUT = {
  noble: "En fin de partie, un noble vaut 2 cartes, aussi bien dans le domaine d'un joueur qu'à la table de la reine.",
  garde: "Un garde ne peut pas être éliminé par un assassin : il reste donc toujours en jeu.",
  espion: "Un espion se pose toujours face cachée. Une fois joué, plus personne ne peut le regarder, pas même le joueur qui l'a posé.\n\nÀ la table de la reine, il va dans la colonne de la reine, au centre du tapis, au-dessus ou au-dessous : sa famille reste ainsi secrète.",
  assassin: "Quand vous posez un assassin, vous pouvez éliminer une autre carte Courtisan de la même zone, à la table de la reine comme dans un domaine. La carte éliminée est retirée du jeu pour de bon.\n\nÀ la table de la reine, vous pouvez viser n'importe quelle carte de la zone, peu importe sa famille ou sa position, espions compris (sans les regarder). L'effet est facultatif.",
}

export const CADRE_PICTO_DEFAUT = "/rules/PICTOGRAM_FRAME.svg"

export const ANCIENS_TEXTES_REGLES: Record<string, string[]> = {
  turnTitle: ["Tour de jeu"],
  goalIntro: ["À chaque tour, vous jouez vos 3 cartes. L'une influence le statut d'une famille à la table de la reine, les deux autres font gagner ou perdre des points, chez vous et chez un adversaire. Terminez la partie avec le plus de points.", "À chacun de vos tours, vous jouez 3 cartes. L'une va à la table de la reine et fait pencher le statut d'une famille, en bien ou en mal. Les deux autres vont dans votre domaine et dans celui d'un adversaire : elles rapportent ou coûtent des points selon le statut de leur famille.\n\nRépartissez bien vos cartes pour finir la partie avec le plus de points."],
  flowIntro: ["Une partie se joue dans le sens des aiguilles d'une montre. En commençant par le premier joueur, chacun effectue son tour complètement, puis on passe au joueur suivant. La partie se termine lorsque la pioche est vide et que plus aucun joueur n'a de cartes en main.", "La partie se joue dans le sens des aiguilles d'une montre. Chaque joueur, en commençant par le premier, joue son tour en entier avant de passer la main au suivant.\n\nQuand la pioche est vide et que plus personne n'a de cartes en main, la partie s'arrête, chacun compte ses points et le plus haut total l'emporte."],
  flowMat: ["Le tapis est placé au centre de la table. Les cartes Courtisan sont mélangées, puis certaines sont écartées selon le nombre de joueurs : 30 à 2 joueurs, 18 à 3, 6 à 4, aucune à 5.", "Le tapis est posé au centre de la table. Les cartes Courtisan sont mélangées face cachée, puis une partie est écartée au hasard selon le nombre de joueurs.\n\n30 cartes à 2 joueurs, 18 à 3, 6 à 4, aucune à 5."],
  flowMissions: ["Chaque joueur reçoit 2 missions, **une blanche et une bleue**, à garder secrètes. Vous pouvez les consulter à tout moment.", "Chaque joueur reçoit 2 missions, **une blanche et une bleue**, qu'il découvre en secret. Les autres missions ne servent pas pendant la partie.\n\nVous pouvez relire vos missions quand vous voulez, mais ne les montrez jamais à vos adversaires."],
  turnEnd: ["vous piochez automatiquement 3 nouvelles cartes. Si la pioche est vide, c'était votre dernier tour.", "une fois vos 3 cartes jouées, vous en piochez 3 nouvelles pour votre prochain tour. Si la pioche est vide, c'était votre dernier tour : attendez que les autres terminent le leur."],
  scoringReveal: ["Ceux de la table rejoignent la colonne de leur famille, sans changer de niveau.", "Tous les espions sont retournés. Ceux de la table de la reine rejoignent la colonne de leur famille, en restant du même côté du tapis : au-dessus s'ils étaient au-dessus, au-dessous sinon."],
  scoringStatus: ["Plus de cartes au-dessus : {lumiere}. Plus au-dessous : {disgrace}. Sinon : {neutre}. Les nobles comptent double.", "Plus de cartes au-dessus du tapis : la famille est {lumiere}. Plus de cartes au-dessous : elle est {disgrace}. À égalité : elle est {neutre}.\n\nLes nobles comptent pour 2 cartes."],
  scoringPoints: ["+1 par courtisan d'une famille dans la lumière, −1 par courtisan d'une famille en disgrâce, +3 par mission réussie. Le plus haut total l'emporte, les ex-aequo partagent la victoire.", "Chaque courtisan d'une famille dans la lumière vous rapporte 1 point, chaque courtisan d'une famille en disgrâce vous en retire 1, les familles neutres ne comptent pas. Les nobles valent double.\n\nChaque mission réussie ajoute 3 points. Le plus haut total gagne ; en cas d'égalité, la victoire est partagée."],
  scoringTitle: ["Décompte"],
  goalFamilies: ["Papillon, crapaud, rossignol, lièvre, cerf et carpe : chacune finira {lumiere}, {disgrace} ou {neutre} selon ce qui se joue à la table de la reine."],
  goalMissions: ["Une blanche et une bleue. Chaque mission réussie rapporte 3 points en fin de partie. Ne les dévoilez jamais."],
  flowHand: ["Chaque joueur reçoit 3 cartes Courtisan, face cachée. Les cartes restantes forment la pioche."],
  flowStart: ["Le premier joueur est tiré au sort. **Le banquet peut commencer !**"],
  turnIntro: ["Jouez les 3 cartes de votre main, face visible, **une dans chacune des 3 zones**, dans l'ordre de votre choix."],
  turnTable: ["Posez la carte dans la colonne de sa famille, au-dessus ou au-dessous du tapis. Majorité au-dessus : {lumiere}. Majorité au-dessous : {disgrace}."],
  turnDomain: ["Chaque carte d'une famille {lumiere} vous rapportera 1 point, chaque carte d'une famille {disgrace} vous en fera perdre 1."],
  turnOpponent: ["Même principe, mais pour lui : offrez-lui des familles en disgrâce, gardez la lumière pour vous."],
  rolesIntro: ["Certains courtisans ont un rôle, indiqué par une icône aux quatre coins de la carte."],
  scoringIntro: ["La partie s'arrête quand la pioche est vide et que plus personne n'a de cartes en main."],
}

export const ANCIENNES_REGLES_ROLES: Record<string, string[]> = {
  espion: ["Toujours joué face cachée, personne ne peut le regarder. À la table, il rejoint la colonne de la reine.", "Se joue toujours face cachée et ne peut jamais être regardé, même par celui qui l'a posé.\n\nÀ la table de la reine, il va dans la colonne de la reine, au-dessus ou au-dessous du tapis, pour ne pas trahir sa famille."],
  assassin: ["En le posant, vous pouvez éliminer une autre carte de la même zone (sauf un garde), espions compris. Facultatif.", "En le posant, vous pouvez éliminer n'importe quelle autre carte de la même zone, à la table de la reine comme dans un domaine, quelles que soient sa famille et sa position. Un espion peut être éliminé sans être regardé, mais jamais un garde.\n\nLa carte éliminée quitte définitivement la partie. Ce pouvoir est facultatif."],
  noble: ["Compte pour 2 cartes en fin de partie, dans un domaine comme à la table de la reine."],
  garde: ["Ne peut pas être éliminé par un assassin : il ne quitte jamais le jeu."],
}
