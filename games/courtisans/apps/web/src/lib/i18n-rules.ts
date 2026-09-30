import type { Locale } from "@pbgo/core/lib/i18n"
import type { Role } from "@courtisans/engine"
import { DEFAULT_ROLE_RULES, DEFAULT_RULE_TEXTS, type RuleTexts } from "./default-rules"

/** Règles de Courtisans dans chaque langue (le français vit dans `default-rules.ts`). Variables de statut : {light} {disgrace} {neutral}. */
export const RULE_TEXTS: Record<Locale, RuleTexts> = {
  fr: DEFAULT_RULE_TEXTS,
  en: {
    videoId: DEFAULT_RULE_TEXTS.videoId,
    videoTitle: "Rules video",
    goalTitle: "Goal of the game",
    flowTitle: "How a game works",
    turnTitle: "A player's turn",
    rolesTitle: "The roles",
    scoringTitle: "End of the game",
    goalIntro:
      "In Courtisans, you receive 3 cards each turn and you play all of them. One goes to the Queen's table, where it improves or worsens the status of a family. The other two are placed in your own domain and in an opponent's: depending on the status of their family, they will win or lose points.\n\nThink carefully about how you split your 3 cards: it is what will let you finish with the most points and win the game.",
    goalFamilies:
      "The game has 90 Courtier cards, split into 6 families of 15: butterfly, toad, nightingale, hare, stag and carp. At the end of the game, each family will be {light}, {disgrace} or {neutral}, depending on what was played at the Queen's table.",
    goalMissions:
      "The game has 20 missions, 10 white and 10 blue. Each player receives one of each color and keeps it secret: each mission completed at the end of the game is worth 3 extra points.",
    flowIntro:
      "Courtisans is played clockwise. The first player plays their whole turn, then it is the next player's turn, and so on.\n\nThe game ends when the draw pile is empty and nobody has a card left in hand. Everyone then counts their points, and the best total wins.",
    flowMat:
      "The mat is placed in the middle of the table. Shuffle all the Courtier cards without looking at them, then remove some at random, face down, depending on the number of players:\n\n2 players: 30 cards removed (60 remain in the draw pile)\n3 players: 18 cards removed (72 remain)\n4 players: 6 cards removed (84 remain)\n5 players: none, the draw pile is complete",
    flowHand: "Each player receives 3 Courtier cards face down and looks at them without showing them. The remaining cards form the draw pile, face down, next to the mat.",
    flowMissions:
      "Each player then receives 2 missions, **one white and one blue**, which they discover in secret and keep close. The remaining missions go back in the box without being looked at: they are not used.\n\nYou can reread your missions at any time, but your opponents must never see them.",
    flowStart: "The first player is chosen at random. **Let the banquet begin!**",
    turnIntro:
      "On your turn, you must play the 3 cards in your hand, face up, **one in each of the 3 zones** below. The order is free, as long as each zone receives exactly one card.",
    turnTable:
      "Place the card in its family's column, either above or below the mat.\n\nAt the end of the game, a family with more cards above will be {light}; a family with more cards below will be {disgrace}.",
    turnDomain: "At the end of the game, each card of a {light} family earns you 1 point, and each card of a {disgrace} family costs you 1.",
    turnOpponent: "Same calculation, but for the opponent you chose: each card of a {light} family earns them 1 point, each card of a {disgrace} family takes 1 away.",
    turnEnd: "after playing your 3 cards, draw 3 new ones for the next turn. If the draw pile is empty, that was your last turn: wait until the end of the round.",
    rolesIntro: "Some courtiers have a role: you can tell by an object in the illustration and by the icon in the four corners of the card. There are 4 roles, each with its own effect.",
    scoringIntro: "The game stops when the draw pile is empty and no player has a card left in hand.",
    scoringReveal:
      "All the spies (the face-down cards) are turned over. Those at the Queen's table join their family's column, keeping their level: above if they were above, below if they were below.",
    scoringStatus:
      "The status of each family at the Queen's table is then determined. More cards above the mat: it is {light}. More below: it is {disgrace}. No majority: it is {neutral}. Nobles count as 2 cards.",
    scoringPoints:
      "Everyone then calculates their total: +1 point per courtier of a family in the light, −1 per courtier of a family in disgrace, nothing for neutral families. Nobles count as 2.\n\nFinally, everyone reveals their missions: each completed mission adds 3 points, the others earn nothing. The best total wins the game; in case of a tie, the victory is shared.",
  },
  es: {
    videoId: DEFAULT_RULE_TEXTS.videoId,
    videoTitle: "Reglas en vídeo",
    goalTitle: "Objetivo del juego",
    flowTitle: "Desarrollo de la partida",
    turnTitle: "Turno de un jugador",
    rolesTitle: "Los roles",
    scoringTitle: "Fin de la partida",
    goalIntro:
      "En Courtisans, recibes 3 cartas en cada turno y las juegas todas. Una va a la mesa de la reina, donde mejora o empeora el estado de una familia. Las otras dos se colocan en tu dominio y en el de un rival: según el estado de su familia, te harán ganar o perder puntos.\n\nPiensa bien cómo repartes tus 3 cartas: de ello depende que acabes con más puntos y ganes la partida.",
    goalFamilies:
      "El juego tiene 90 cartas de Cortesano, repartidas en 6 familias de 15: mariposa, sapo, ruiseñor, liebre, ciervo y carpa. Al final de la partida, cada familia estará {light}, {disgrace} o {neutral}, según lo que se haya jugado en la mesa de la reina.",
    goalMissions:
      "El juego tiene 20 misiones, 10 blancas y 10 azules. Cada jugador recibe una de cada color y la mantiene en secreto: cada misión cumplida al final de la partida vale 3 puntos más.",
    flowIntro:
      "Courtisans se juega en el sentido de las agujas del reloj. El primer jugador juega su turno completo, luego le toca al siguiente, y así sucesivamente.\n\nLa partida termina cuando el mazo se agota y nadie tiene cartas en la mano. Entonces cada uno cuenta sus puntos y gana el mejor total.",
    flowMat:
      "El tapete se coloca en el centro de la mesa. Se mezclan todas las cartas de Cortesano sin mirarlas y se retiran al azar, boca abajo, según el número de jugadores:\n\n2 jugadores: 30 cartas retiradas (quedan 60 en el mazo)\n3 jugadores: 18 cartas retiradas (quedan 72)\n4 jugadores: 6 cartas retiradas (quedan 84)\n5 jugadores: ninguna, el mazo está completo",
    flowHand: "Cada jugador recibe 3 cartas de Cortesano boca abajo y las mira sin enseñarlas. El resto de las cartas forma el mazo, boca abajo, junto al tapete.",
    flowMissions:
      "Cada jugador recibe después 2 misiones, **una blanca y una azul**, que descubre en secreto y guarda cerca de sí. Las misiones restantes vuelven a la caja sin mirarlas: no se usan.\n\nPuedes releer tus misiones en cualquier momento, pero tus rivales nunca deben verlas.",
    flowStart: "El primer jugador se elige al azar. **¡Que comience el banquete!**",
    turnIntro:
      "En tu turno, debes jugar obligatoriamente las 3 cartas de tu mano, boca arriba, **una en cada una de las 3 zonas** siguientes. El orden es libre, siempre que cada zona reciba exactamente una carta.",
    turnTable:
      "Coloca la carta en la columna de su familia, a elegir por encima o por debajo del tapete.\n\nAl final de la partida, una familia con más cartas por encima estará {light}; una familia con más cartas por debajo estará {disgrace}.",
    turnDomain: "Al final de la partida, cada carta de una familia {light} te da 1 punto, y cada carta de una familia {disgrace} te cuesta 1.",
    turnOpponent: "El mismo cálculo, pero para el rival elegido: cada carta de una familia {light} le da 1 punto, cada carta de una familia {disgrace} le quita 1.",
    turnEnd: "tras jugar tus 3 cartas, roba 3 nuevas para el turno siguiente. Si el mazo está agotado, era tu último turno: espera al final de la ronda.",
    rolesIntro: "Algunos cortesanos tienen un rol: se reconoce por un objeto en la ilustración y por el icono en las cuatro esquinas de la carta. Hay 4 roles, cada uno con su propio efecto.",
    scoringIntro: "La partida se detiene cuando el mazo se agota y ningún jugador tiene cartas en la mano.",
    scoringReveal:
      "Se dan la vuelta todos los espías (las cartas boca abajo). Los de la mesa de la reina se unen a la columna de su familia conservando su nivel: por encima si estaban por encima, por debajo si estaban por debajo.",
    scoringStatus:
      "Después se establece el estado de cada familia en la mesa de la reina. Más cartas por encima del tapete: está {light}. Más por debajo: está {disgrace}. Sin mayoría: está {neutral}. Los nobles cuentan como 2 cartas.",
    scoringPoints:
      "Cada uno calcula después su total: +1 punto por cortesano de una familia en la luz, −1 por cortesano de una familia en desgracia, nada por las familias neutrales. Los nobles cuentan como 2.\n\nPor último, cada uno revela sus misiones: cada misión cumplida suma 3 puntos, las demás no aportan nada. El mejor total gana la partida; en caso de empate, la victoria se comparte.",
  },
  de: {
    videoId: DEFAULT_RULE_TEXTS.videoId,
    videoTitle: "Regeln als Video",
    goalTitle: "Ziel des Spiels",
    flowTitle: "Spielablauf",
    turnTitle: "Zug eines Spielers",
    rolesTitle: "Die Rollen",
    scoringTitle: "Ende der Partie",
    goalIntro:
      "In Courtisans erhältst du in jedem Zug 3 Karten und spielst alle aus. Eine geht an die Tafel der Königin, wo sie den Status einer Familie verbessert oder verschlechtert. Die anderen beiden legst du in deinen eigenen Herrschaftsbereich und in den eines Gegners: Je nach Status ihrer Familie bringen sie Punkte ein oder kosten Punkte.\n\nÜberlege gut, wie du deine 3 Karten verteilst: Davon hängt ab, ob du mit den meisten Punkten endest und die Partie gewinnst.",
    goalFamilies:
      "Das Spiel enthält 90 Höflingskarten, aufgeteilt in 6 Familien zu je 15: Schmetterling, Kröte, Nachtigall, Hase, Hirsch und Karpfen. Am Ende der Partie ist jede Familie {light}, {disgrace} oder {neutral}, je nachdem, was an der Tafel der Königin gespielt wurde.",
    goalMissions:
      "Das Spiel enthält 20 Missionen, 10 weiße und 10 blaue. Jeder Spieler erhält eine von jeder Farbe und hält sie geheim: Jede am Ende der Partie erfüllte Mission bringt 3 weitere Punkte.",
    flowIntro:
      "Courtisans wird im Uhrzeigersinn gespielt. Der erste Spieler spielt seinen ganzen Zug, dann ist der nächste Spieler an der Reihe, und so weiter.\n\nDie Partie endet, wenn der Nachziehstapel aufgebraucht ist und niemand mehr Karten in der Hand hat. Dann zählt jeder seine Punkte, und die beste Summe gewinnt.",
    flowMat:
      "Die Matte wird in die Tischmitte gelegt. Mische alle Höflingskarten, ohne sie anzusehen, und entferne je nach Spielerzahl zufällig einige verdeckt:\n\n2 Spieler: 30 Karten entfernt (60 bleiben im Nachziehstapel)\n3 Spieler: 18 Karten entfernt (72 bleiben)\n4 Spieler: 6 Karten entfernt (84 bleiben)\n5 Spieler: keine, der Nachziehstapel ist vollständig",
    flowHand: "Jeder Spieler erhält 3 Höflingskarten verdeckt und sieht sie sich an, ohne sie zu zeigen. Die übrigen Karten bilden den verdeckten Nachziehstapel neben der Matte.",
    flowMissions:
      "Anschließend erhält jeder Spieler 2 Missionen, **eine weiße und eine blaue**, die er heimlich ansieht und bei sich behält. Die übrigen Missionen kommen ungesehen zurück in die Schachtel: Sie werden nicht benutzt.\n\nDu kannst deine Missionen jederzeit erneut lesen, aber deine Gegner dürfen sie nie sehen.",
    flowStart: "Der erste Spieler wird zufällig bestimmt. **Das Bankett kann beginnen!**",
    turnIntro:
      "In deinem Zug musst du die 3 Karten deiner Hand offen ausspielen, **eine in jede der 3 Zonen** unten. Die Reihenfolge ist frei, solange jede Zone genau eine Karte erhält.",
    turnTable:
      "Lege die Karte in die Spalte ihrer Familie, wahlweise oberhalb oder unterhalb der Matte.\n\nAm Ende der Partie ist eine Familie mit mehr Karten oben {light}; eine Familie mit mehr Karten unten ist {disgrace}.",
    turnDomain: "Am Ende der Partie bringt dir jede Karte einer Familie, die {light} ist, 1 Punkt, und jede Karte einer Familie, die {disgrace} ist, kostet dich 1.",
    turnOpponent: "Dieselbe Rechnung, aber für den gewählten Gegner: Jede Karte einer Familie, die {light} ist, bringt ihm 1 Punkt, jede Karte einer Familie, die {disgrace} ist, zieht ihm 1 ab.",
    turnEnd: "Ziehe nach dem Ausspielen deiner 3 Karten 3 neue für den nächsten Zug. Ist der Nachziehstapel aufgebraucht, war das dein letzter Zug: Warte bis zum Ende der Runde.",
    rolesIntro: "Manche Höflinge haben eine Rolle: Man erkennt sie an einem Gegenstand in der Illustration und am Symbol in den vier Ecken der Karte. Es gibt 4 Rollen, jede mit ihrem eigenen Effekt.",
    scoringIntro: "Die Partie endet, wenn der Nachziehstapel aufgebraucht ist und kein Spieler mehr Karten in der Hand hat.",
    scoringReveal:
      "Alle Spione (die verdeckten Karten) werden umgedreht. Die an der Tafel der Königin schließen sich der Spalte ihrer Familie an und behalten ihre Ebene: oben, wenn sie oben lagen, unten, wenn sie unten lagen.",
    scoringStatus:
      "Dann wird der Status jeder Familie an der Tafel der Königin bestimmt. Mehr Karten oberhalb der Matte: Sie ist {light}. Mehr unterhalb: Sie ist {disgrace}. Keine Mehrheit: Sie ist {neutral}. Adlige zählen als 2 Karten.",
    scoringPoints:
      "Jeder berechnet dann seine Summe: +1 Punkt pro Höfling einer Familie im Licht, −1 pro Höfling einer Familie in Ungnade, nichts für neutrale Familien. Adlige zählen doppelt.\n\nZuletzt deckt jeder seine Missionen auf: Jede erfüllte Mission bringt 3 Punkte, die anderen nichts. Die beste Summe gewinnt die Partie; bei Gleichstand wird der Sieg geteilt.",
  },
}

export const ROLE_RULE_TEXTS: Record<Locale, Record<Role, string>> = {
  fr: DEFAULT_ROLE_RULES,
  en: {
    noble: "At the end of the game, a noble counts as 2 cards, both in a player's domain and at the Queen's table.",
    guard: "A guard cannot be eliminated by an assassin: it always stays in play.",
    spy: "A spy is always played face down. Once played, nobody can look at it anymore, not even the player who placed it.\n\nAt the Queen's table, it goes in the Queen's column, in the center of the mat, above or below: its family thus remains secret.",
    assassin:
      "When you play an assassin, you may eliminate another Courtier card in the same zone, at the Queen's table as well as in a domain. The eliminated card is removed from the game for good.\n\nAt the Queen's table, you can target any card in the zone, whatever its family or position, spies included (without looking at them). The effect is optional.",
  },
  es: {
    noble: "Al final de la partida, un noble vale por 2 cartas, tanto en el dominio de un jugador como en la mesa de la reina.",
    guard: "Un guardia no puede ser eliminado por un asesino: siempre permanece en juego.",
    spy: "Un espía se coloca siempre boca abajo. Una vez jugado, nadie puede mirarlo, ni siquiera el jugador que lo colocó.\n\nEn la mesa de la reina, va a la columna de la reina, en el centro del tapete, por encima o por debajo: así su familia permanece en secreto.",
    assassin:
      "Cuando colocas un asesino, puedes eliminar otra carta de Cortesano de la misma zona, tanto en la mesa de la reina como en un dominio. La carta eliminada sale del juego definitivamente.\n\nEn la mesa de la reina, puedes apuntar a cualquier carta de la zona, sea cual sea su familia o posición, espías incluidos (sin mirarlos). El efecto es opcional.",
  },
  de: {
    noble: "Am Ende der Partie zählt ein Adliger als 2 Karten, sowohl im Herrschaftsbereich eines Spielers als auch an der Tafel der Königin.",
    guard: "Eine Wache kann von einem Attentäter nicht eliminiert werden: Sie bleibt immer im Spiel.",
    spy: "Ein Spion wird immer verdeckt gespielt. Einmal gespielt, kann ihn niemand mehr ansehen, nicht einmal der Spieler, der ihn gelegt hat.\n\nAn der Tafel der Königin kommt er in die Spalte der Königin in der Mitte der Matte, oberhalb oder unterhalb: So bleibt seine Familie geheim.",
    assassin:
      "Wenn du einen Attentäter legst, darfst du eine andere Höflingskarte derselben Zone eliminieren, an der Tafel der Königin ebenso wie in einem Herrschaftsbereich. Die eliminierte Karte wird endgültig aus dem Spiel genommen.\n\nAn der Tafel der Königin kannst du jede Karte der Zone anvisieren, unabhängig von Familie oder Position, Spione eingeschlossen (ohne sie anzusehen). Der Effekt ist freiwillig.",
  },
}
