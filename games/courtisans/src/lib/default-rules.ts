export const DEFAULT_RULE_TEXTS = {
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
    "Le jeu compte 90 cartes Courtisan, réparties en 6 familles de 15 : papillon, crapaud, rossignol, lièvre, cerf et carpe. En fin de partie, chaque famille sera {light}, {disgrace} ou {neutral}, selon ce qui s'est joué à la table de la reine.",
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
    "Posez la carte dans la colonne de sa famille, au choix au-dessus ou au-dessous du tapis.\n\nEn fin de partie, une famille qui a plus de cartes au-dessus sera {light} ; une famille qui en a plus au-dessous sera {disgrace}.",
  turnDomain: "En fin de partie, chaque carte d'une famille {light} vous rapporte 1 point, et chaque carte d'une famille {disgrace} vous en coûte 1.",
  turnOpponent: "Même calcul, mais pour l'adversaire choisi : chaque carte d'une famille {light} lui rapporte 1 point, chaque carte d'une famille {disgrace} lui en retire 1.",
  turnEnd: "après avoir joué vos 3 cartes, piochez-en 3 nouvelles pour le tour suivant. Si la pioche est épuisée, c'était votre dernier tour : patientez jusqu'à la fin du tour de table.",
  rolesIntro: "Certains courtisans ont un rôle : on le reconnaît à un objet dans l'illustration et à l'icône présente aux quatre coins de la carte. Il existe 4 rôles, chacun avec son propre effet.",
  scoringIntro: "La partie s'arrête quand la pioche est épuisée et que plus aucun joueur n'a de carte en main.",
  scoringReveal: "Tous les espions (les cartes face cachée) sont retournés. Ceux de la table de la reine rejoignent la colonne de leur famille en gardant leur niveau : au-dessus s'ils étaient au-dessus, au-dessous s'ils étaient au-dessous.",
  scoringStatus: "On établit ensuite le statut de chaque famille à la table de la reine. Plus de cartes au-dessus du tapis : elle est {light}. Plus au-dessous : elle est {disgrace}. Sans majorité : elle est {neutral}. Les nobles comptent pour 2 cartes.",
  scoringPoints:
    "Chacun calcule ensuite son total : +1 point par courtisan d'une famille dans la lumière, −1 par courtisan d'une famille en disgrâce, rien pour les familles neutres. Les nobles comptent pour 2.\n\nChacun révèle enfin ses missions : chaque mission validée ajoute 3 points, les autres ne rapportent rien. Le meilleur total remporte la partie ; en cas d'égalité, la victoire est partagée.",
}

export type RuleTexts = typeof DEFAULT_RULE_TEXTS

export const DEFAULT_ROLE_RULES = {
  noble: "En fin de partie, un noble vaut 2 cartes, aussi bien dans le domaine d'un joueur qu'à la table de la reine.",
  guard: "Un garde ne peut pas être éliminé par un assassin : il reste donc toujours en jeu.",
  spy: "Un espion se pose toujours face cachée. Une fois joué, plus personne ne peut le regarder, pas même le joueur qui l'a posé.\n\nÀ la table de la reine, il va dans la colonne de la reine, au centre du tapis, au-dessus ou au-dessous : sa famille reste ainsi secrète.",
  assassin: "Quand vous posez un assassin, vous pouvez éliminer une autre carte Courtisan de la même zone, à la table de la reine comme dans un domaine. La carte éliminée est retirée du jeu pour de bon.\n\nÀ la table de la reine, vous pouvez viser n'importe quelle carte de la zone, peu importe sa famille ou sa position, espions compris (sans les regarder). L'effet est facultatif.",
}
