import { localeString, localeText } from "@pbgo/content-kit"
import type { LanguageId, Localized, SeedDoc } from "@pbgo/content-kit"
import { BONUS_TILE_NUMBERS } from "../../apps/studio/schemaTypes/constants.ts"
import { TILE_SPECS } from "./bonus-tiles.ts"
import { ratingScale } from "./game.ts"

export const RULES_ID = "rules"

// The rules page of the shared `rules` document, in PBGO's own words: the official rulebooks are linked from `settings`, never copied.
// Registers follow the site's translations: vous (fr), you (en), tú (es), du (de). A group is never addressed directly in Spanish and German.

type Section = { key: string; title: Localized; body: Localized }

/** Paragraphs are separated by a blank line, which is what the Studio field expects. */
const p = (...paragraphs: string[]) => paragraphs.join("\n\n")

/** The score scale from the `game` document: `**0–5** Risible · **6–10** Médiocre · …` */
const scaleOf = (language: LanguageId) =>
  ratingScale()
    .map(({ from, to, label }) => `**${from === to ? from : `${from}–${to}`}** ${label[language]}`)
    .join(" · ")

/** The six bonus tile effects, from the same texts as the `bonusTile` documents. */
const tileLines = (language: LanguageId) =>
  BONUS_TILE_NUMBERS.map((number) => `**${number}. ${TILE_SPECS[number].name[language]}.** ${TILE_SPECS[number].effect[language]}`)

const INTRO: Localized = {
  fr: "Hanabi est un jeu coopératif : personne ne voit ses propres cartes, mais tout le monde voit celles des autres. Ensemble, vous posez les cartes dans le bon ordre pour réussir le plus beau spectacle de feux d’artifice possible, guidés seulement par les informations que vous vous donnez à tour de rôle.",
  en: "Hanabi is a cooperative game: nobody sees their own cards, but everybody sees everyone else’s. Together you play the cards in the right order to put on the best firework show you can, guided only by the clues you give each other in turn.",
  es: "Hanabi es un juego cooperativo: nadie ve sus propias cartas, pero todos ven las de los demás. Entre todos hay que jugar las cartas en el orden correcto para lograr el mejor espectáculo de fuegos artificiales posible, guiándose solo por las pistas que se dan por turnos.",
  de: "Hanabi ist ein kooperatives Spiel: Niemand sieht die eigenen Karten, aber alle sehen die der anderen. Gemeinsam spielt das Team die Karten in der richtigen Reihenfolge aus, um die schönste Feuerwerksshow zu zaubern – geleitet allein von den Hinweisen, die man sich reihum gibt.",
}

const SECTIONS: Section[] = [
  {
    key: "goal",
    title: { fr: "But du jeu", en: "Goal", es: "Objetivo", de: "Ziel" },
    body: {
      fr: p(
        "Vous formez une seule équipe : ensemble, vous montez des feux d’artifice, un par couleur. Chaque feu se construit dans l’ordre, du 1 au 5.",
        "Le défi : vous ne voyez jamais vos propres cartes. Vous voyez celles des autres joueurs, et ce sont eux qui vous guident, avec les informations qu’ils vous donnent à tour de rôle.",
        "Avec les cinq couleurs de base, le score maximal est de 25 points.",
      ),
      en: p(
        "You are one team, building fireworks together: one per color, each built in order from 1 to 5.",
        "The catch: you never see your own cards. You see everyone else’s, and they guide you with the clues they give you in turn.",
        "With the five base colors, the top score is 25 points.",
      ),
      es: p(
        "Todos forman un solo equipo y montan juntos los fuegos artificiales, uno por color. Cada fuego se construye en orden, del 1 al 5.",
        "La dificultad: nunca ves tus propias cartas. Ves las de los demás, y ellos te guían con las pistas que te dan por turnos.",
        "Con los cinco colores básicos, la puntuación máxima es de 25 puntos.",
      ),
      de: p(
        "Alle spielen im selben Team und bauen gemeinsam Feuerwerke auf: eines pro Farbe, jedes der Reihe nach von 1 bis 5.",
        "Der Haken: Du siehst deine eigenen Karten nie. Du siehst die der anderen, und sie leiten dich mit den Hinweisen an, die sie dir der Reihe nach geben.",
        "Mit den fünf Grundfarben beträgt die Höchstpunktzahl 25 Punkte.",
      ),
    },
  },
  {
    key: "setup",
    title: { fr: "Mise en place", en: "Setup", es: "Preparación", de: "Vorbereitung" },
    body: {
      fr: p(
        "Chaque couleur compte 10 cartes : trois 1, deux 2, deux 3, deux 4 et un 5. Le jeu de base réunit cinq couleurs, soit 50 cartes. Chaque extension de couleur ajoute 10 cartes : 60 avec l’une, 70 avec les deux.",
        "On démarre avec 8 jetons Indice disponibles et 3 tuiles Erreur côté bleu.",
        "Chaque joueur reçoit 5 cartes à 2 ou 3 joueurs, 4 cartes à 4 ou 5 joueurs. Le reste forme la pioche. Le premier joueur est tiré au sort, puis le tour passe dans le sens des aiguilles d’une montre.",
      ),
      en: p(
        "Each color has 10 cards: three 1s, two each of 2, 3 and 4, and one 5. The base game has five colors, so 50 cards. Each color extension adds 10 more: 60 with one, 70 with both.",
        "The game starts with 8 clue tokens available and 3 fuse tokens, which count mistakes, blue side up.",
        "Every player is dealt 5 cards in a game of 2 or 3 players, and 4 cards with 4 or 5 players. The rest forms the draw pile. The first player is chosen at random, then play goes clockwise.",
      ),
      es: p(
        "Cada color tiene 10 cartas: tres 1, dos 2, dos 3, dos 4 y un 5. El juego base tiene cinco colores, es decir, 50 cartas. Cada extensión de color añade 10 cartas más: 60 con una y 70 con las dos.",
        "Se empieza con 8 fichas de pista disponibles y 3 fichas de error con la cara azul hacia arriba.",
        "Cada jugador recibe 5 cartas en partidas de 2 o 3 jugadores, y 4 cartas con 4 o 5 jugadores. El resto forma el mazo. El jugador inicial se elige al azar y el turno pasa en el sentido de las agujas del reloj.",
      ),
      de: p(
        "Jede Farbe hat 10 Karten: drei 1er, je zwei 2er, 3er und 4er sowie eine 5. Das Grundspiel enthält fünf Farben, also 50 Karten. Jede Erweiterung um eine Farbe bringt 10 Karten mehr: 60 mit einer, 70 mit beiden.",
        "Zu Beginn liegen 8 Hinweisplättchen bereit, dazu 3 Fehlerplättchen mit der blauen Seite nach oben.",
        "Bei 2 oder 3 Personen bekommt jede 5 Karten, bei 4 oder 5 Personen jede 4. Die übrigen Karten bilden den Nachziehstapel. Wer beginnt, wird zufällig bestimmt; danach geht es im Uhrzeigersinn weiter.",
      ),
    },
  },
  {
    key: "turn",
    title: { fr: "Le tour de jeu", en: "Your turn", es: "El turno", de: "Der Spielzug" },
    body: {
      fr: p(
        "À votre tour, vous faites exactement une de ces trois actions : donner une information, défausser une carte ou jouer une carte. Impossible de passer.",
        "Pendant le tour d’un joueur, les autres ne le commentent pas et n’essaient pas de l’influencer. La seule aide autorisée, c’est l’information donnée avec l’action « Donner une information ».",
      ),
      en: p(
        "On your turn you do exactly one of three actions: give a clue, discard a card or play a card. You can’t pass.",
        "While a player is taking their turn, nobody else comments on it or tries to influence it. The only help allowed is the clue given with the “Give a clue” action.",
      ),
      es: p(
        "En tu turno haces exactamente una de estas tres acciones: dar una pista, descartar una carta o jugar una carta. No se puede pasar.",
        "Mientras alguien hace su turno, nadie lo comenta ni intenta influir en él. La única ayuda permitida es la pista que se da con la acción «Dar una pista».",
      ),
      de: p(
        "Wenn du am Zug bist, führst du genau eine von drei Aktionen aus: einen Hinweis geben, eine Karte abwerfen oder eine Karte ausspielen. Passen ist nicht erlaubt.",
        "Während jemand am Zug ist, kommentiert niemand sonst den Spielzug oder versucht, ihn zu beeinflussen. Erlaubt ist allein der Hinweis, den die Aktion „Einen Hinweis geben“ liefert.",
      ),
    },
  },
  {
    key: "clue",
    title: { fr: "Donner une information", en: "Give a clue", es: "Dar una pista", de: "Einen Hinweis geben" },
    body: {
      fr: p(
        "Dépensez un jeton Indice pour renseigner un autre joueur sur sa main, jamais sur la vôtre. Choisissez une couleur ou une valeur, puis désignez toutes les cartes de sa main qui correspondent, sans en oublier. Par exemple : toutes ses cartes rouges, ou tous ses 4.",
        "Sans jeton Indice disponible, impossible de donner une information : il faut défausser ou jouer une carte.",
        "Une information doit toucher au moins une carte, sauf si l’hôte a autorisé les informations vides dans les options de la table.",
      ),
      en: p(
        "Spend a clue token to tell another player about their hand, never your own. Pick a color or a number, then point out every card in their hand that matches, leaving none out. For example: all their red cards, or all their 4s.",
        "With no clue token available you can’t give a clue: you have to discard or play a card.",
        "A clue has to touch at least one card, unless the host has allowed empty clues in the table options.",
      ),
      es: p(
        "Gasta una ficha de pista para informar a otro jugador sobre su mano, nunca sobre la tuya. Elige un color o un número y señala todas las cartas de su mano que coincidan, sin dejar ninguna. Por ejemplo: todas sus cartas rojas, o todos sus 4.",
        "Sin fichas de pista disponibles no se puede dar una pista: hay que descartar o jugar una carta.",
        "Una pista debe afectar al menos a una carta, salvo que el anfitrión haya permitido las pistas vacías en las opciones de la mesa.",
      ),
      de: p(
        "Gib ein Hinweisplättchen aus, um eine andere Person über ihre Hand zu informieren, nie über deine eigene. Wähle eine Farbe oder eine Zahl und zeige alle Karten ihrer Hand, die dazu passen, ohne eine auszulassen. Zum Beispiel: alle roten Karten oder alle 4er.",
        "Ist kein Hinweisplättchen verfügbar, kannst du keinen Hinweis geben: Dann musst du eine Karte abwerfen oder ausspielen.",
        "Ein Hinweis muss mindestens eine Karte betreffen, es sei denn, der Gastgeber hat leere Hinweise in den Tischoptionen erlaubt.",
      ),
    },
  },
  {
    key: "discard",
    title: { fr: "Défausser une carte", en: "Discard a card", es: "Descartar una carta", de: "Eine Karte abwerfen" },
    body: {
      fr: p(
        "Posez une carte de votre main sur la défausse, face visible : tout le monde peut la consulter à tout moment. Vous récupérez un jeton Indice, puis vous piochez une carte.",
        "Vous ne pouvez pas défausser quand les 8 jetons Indice sont déjà disponibles.",
      ),
      en: p(
        "Put one card from your hand on the discard pile, face up: everyone can look at it at any time. You get a clue token back, then draw a card.",
        "You can’t discard while all 8 clue tokens are already available.",
      ),
      es: p(
        "Deja una carta de tu mano en el descarte, boca arriba: todos pueden consultarlo en cualquier momento. Recuperas una ficha de pista y robas una carta.",
        "No puedes descartar si ya están disponibles las 8 fichas de pista.",
      ),
      de: p(
        "Lege eine Karte aus deiner Hand offen auf den Ablagestapel: Alle können ihn jederzeit ansehen. Du bekommst ein Hinweisplättchen zurück und ziehst eine Karte nach.",
        "Abwerfen ist nicht möglich, solange alle 8 Hinweisplättchen verfügbar sind.",
      ),
    },
  },
  {
    key: "play",
    title: { fr: "Jouer une carte", en: "Play a card", es: "Jugar una carta", de: "Eine Karte ausspielen" },
    body: {
      fr: p(
        "Choisissez une carte de votre main et jouez-la. Si c’est la suivante de son feu d’artifice (un 1 pour ouvrir une couleur, puis un 2, et ainsi de suite), elle le rejoint. Sinon, elle part à la défausse et une tuile Erreur passe du côté rouge.",
        "Dans les deux cas, vous piochez ensuite une carte.",
        "Quand vous complétez un feu avec son 5, vous gagnez un jeton Indice, sauf si les 8 sont déjà disponibles.",
      ),
      en: p(
        "Choose a card from your hand and play it. If it is the next card of its firework (a 1 to open a color, then a 2, and so on), it joins that firework. Otherwise it goes to the discard pile and one fuse token is flipped to its red side.",
        "Either way, you then draw a card.",
        "When you complete a firework with its 5, you earn a clue token, unless all 8 are already available.",
      ),
      es: p(
        "Elige una carta de tu mano y juégala. Si es la siguiente de su fuego artificial (un 1 para abrir un color, luego un 2, y así sucesivamente), se une a él. Si no, va al descarte y una ficha de error se da la vuelta por su cara roja.",
        "En ambos casos, robas después una carta.",
        "Cuando completas un fuego artificial con su 5, ganas una ficha de pista, salvo que ya estén disponibles las 8.",
      ),
      de: p(
        "Wähle eine Karte aus deiner Hand und spiele sie aus. Ist es die nächste Karte ihres Feuerwerks (eine 1, um eine Farbe zu eröffnen, dann eine 2 und so weiter), wird sie dort angelegt. Andernfalls wandert sie auf den Ablagestapel, und ein Fehlerplättchen wird auf seine rote Seite gedreht.",
        "In beiden Fällen ziehst du danach eine Karte nach.",
        "Vervollständigst du ein Feuerwerk mit seiner 5, bekommst du ein Hinweisplättchen – außer alle 8 sind schon verfügbar.",
      ),
    },
  },
  {
    key: "end",
    title: { fr: "Fin de partie", en: "End of the game", es: "Fin de la partida", de: "Spielende" },
    body: {
      fr: p(
        "La partie peut se terminer de trois façons.",
        "**Défaite immédiate :** la troisième tuile Erreur passe du côté rouge. La partie est perdue et vaut 0 point (les feux atteints restent visibles sur la table).",
        "**Victoire immédiate :** chaque feu d’artifice est complet.",
        "**Fin de la pioche :** dès que la dernière carte est piochée, chaque joueur, y compris celui qui vient de la piocher, joue encore un dernier tour, sans piocher. Les points sont ensuite comptés.",
      ),
      en: p(
        "The game can end in three ways.",
        "**Immediate defeat:** the third fuse token is flipped to its red side. The game is lost and scores 0 (the fireworks reached stay visible on the table).",
        "**Immediate victory:** every firework is complete.",
        "**End of the draw pile:** as soon as the last card is drawn, each player, including the one who just drew it, takes one final turn without drawing. Then the points are counted.",
      ),
      es: p(
        "La partida puede terminar de tres maneras.",
        "**Derrota inmediata:** la tercera ficha de error se da la vuelta por su cara roja. La partida está perdida y vale 0 puntos (los fuegos artificiales conseguidos siguen visibles en la mesa).",
        "**Victoria inmediata:** todos los fuegos artificiales están completos.",
        "**Fin del mazo:** en cuanto se roba la última carta, cada jugador, incluido el que acaba de robarla, hace un último turno sin robar. Después se cuentan los puntos.",
      ),
      de: p(
        "Das Spiel kann auf drei Arten enden.",
        "**Sofortige Niederlage:** Das dritte Fehlerplättchen wird auf seine rote Seite gedreht. Das Spiel ist verloren und zählt 0 Punkte (die erreichten Feuerwerke bleiben auf dem Tisch sichtbar).",
        "**Sofortiger Sieg:** Alle Feuerwerke sind vollständig.",
        "**Ende des Nachziehstapels:** Sobald die letzte Karte gezogen wurde, ist jede Person noch ein letztes Mal am Zug, auch die, die gerade gezogen hat – ohne nachzuziehen. Danach werden die Punkte gezählt.",
      ),
    },
  },
  {
    key: "score",
    title: { fr: "Score", en: "Score", es: "Puntuación", de: "Wertung" },
    body: {
      fr: p(
        "Le score est la somme des cartes les plus hautes de chaque feu d’artifice : un feu monté jusqu’au 4 rapporte 4 points, un feu complet 5 points.",
        `Barème : ${scaleOf("fr")}.`,
        "Le maximum est de 25 points avec cinq feux d’artifice ; l’extension Avalanche de couleurs ajoute un sixième feu et le porte à 30. Une partie perdue vaut 0 point. L’extension Poudre noire retire des points : voir sa section.",
      ),
      en: p(
        "Your score is the sum of the highest card in each firework: a firework built up to the 4 is worth 4 points, a complete one 5 points.",
        `Scale: ${scaleOf("en")}.`,
        "The top score is 25 points with five fireworks; the Avalanche of Colors extension adds a sixth firework and raises it to 30. A lost game scores 0. The Black Powder extension takes points off: see its section.",
      ),
      es: p(
        "La puntuación es la suma de la carta más alta de cada fuego artificial: un fuego construido hasta el 4 vale 4 puntos, y uno completo, 5.",
        `Escala: ${scaleOf("es")}.`,
        "El máximo es de 25 puntos con cinco fuegos artificiales; la extensión Avalancha de colores añade un sexto fuego y lo sube a 30. Una partida perdida vale 0 puntos. La extensión Pólvora negra resta puntos: consulta su sección.",
      ),
      de: p(
        "Die Punktzahl ist die Summe der höchsten Karte jedes Feuerwerks: Ein Feuerwerk bis zur 4 zählt 4 Punkte, ein vollständiges 5 Punkte.",
        `Skala: ${scaleOf("de")}.`,
        "Mit fünf Feuerwerken sind 25 Punkte das Maximum; die Erweiterung Farbenlawine fügt ein sechstes Feuerwerk hinzu und hebt es auf 30. Ein verlorenes Spiel zählt 0 Punkte. Die Erweiterung Schwarzpulver zieht Punkte ab; siehe den entsprechenden Abschnitt.",
      ),
    },
  },
  {
    key: "avalanche",
    title: { fr: "Avalanche de couleurs", en: "Avalanche of Colors", es: "Avalancha de colores", de: "Farbenlawine" },
    body: {
      fr: p(
        "Dix cartes multicolores forment un sixième feu d’artifice, à monter de 1 à 5 comme les autres : trois 1, deux 2, deux 3, deux 4 et un 5. Le score maximal passe à 30.",
        "Une carte multicolore vaut pour toutes les autres couleurs à la fois. Quand vous donnez une information de couleur, vous devez donc aussi désigner les cartes multicolores, et une information de couleur peut ne toucher que des cartes multicolores. En revanche, « multicolore » n’est pas une couleur que l’on peut annoncer : personne ne dit « vous avez une carte multicolore ».",
        "Les cartes multicolores ne remplacent aucune autre carte : elles se jouent sur leur propre feu d’artifice.",
      ),
      en: p(
        "Ten multicolor cards form a sixth firework, built from 1 to 5 like the others: three 1s, two each of 2, 3 and 4, and one 5. The top score becomes 30.",
        "A multicolor card counts as every other color at once. When you give a color clue, you must point out the multicolor cards too, so a color clue can end up touching only multicolor cards. “Multicolor” itself can’t be announced as a color: nobody says “you have a multicolor card”.",
        "Multicolor cards never stand in for other cards: they are played on their own firework.",
      ),
      es: p(
        "Diez cartas multicolor forman un sexto fuego artificial, que se construye del 1 al 5 como los demás: tres 1, dos 2, dos 3, dos 4 y un 5. La puntuación máxima pasa a ser 30.",
        "Una carta multicolor cuenta como todos los demás colores a la vez. Al dar una pista de color hay que señalar también las cartas multicolor, así que una pista de color puede afectar solo a cartas multicolor. En cambio, «multicolor» no se puede anunciar como color: nadie dice «tienes una carta multicolor».",
        "Las cartas multicolor no sustituyen a ninguna otra: se juegan en su propio fuego artificial.",
      ),
      de: p(
        "Zehn mehrfarbige Karten bilden ein sechstes Feuerwerk, das wie die anderen von 1 bis 5 aufgebaut wird: drei 1er, je zwei 2er, 3er und 4er sowie eine 5. Die Höchstpunktzahl steigt auf 30.",
        "Eine mehrfarbige Karte zählt zugleich als jede andere Farbe. Bei einem Farbhinweis müssen die mehrfarbigen Karten also immer mitgezeigt werden, und ein Farbhinweis kann auch nur mehrfarbige Karten betreffen. „Mehrfarbig“ selbst lässt sich nicht als Farbe ansagen: Niemand sagt „du hast eine mehrfarbige Karte“.",
        "Mehrfarbige Karten ersetzen keine anderen Karten: Sie werden auf ihrem eigenen Feuerwerk ausgespielt.",
      ),
    },
  },
  {
    key: "blackPowder",
    title: { fr: "Poudre noire", en: "Black Powder", es: "Pólvora negra", de: "Schwarzpulver" },
    body: {
      fr: p(
        "Dix cartes noires forment un sixième feu d’artifice, qui se monte à l’envers : de 5 à 1. Il y a trois 5, deux 4, deux 3, deux 2 et un seul 1. Le 1 noir complète le feu et fait gagner un jeton Indice, sauf si les 8 sont déjà disponibles.",
        "Le noir n’est pas une couleur que l’on peut annoncer : seules les informations de valeur peuvent désigner des cartes noires, et il est aussi interdit de dire à un joueur qu’il n’en a aucune.",
        "Le feu noir ne rapporte pas de points : il peut seulement en faire perdre. Chaque étape qui manque pour le compléter (il y en a cinq) retire 1 point au score. Exemple : si les cinq feux colorés totalisent 20 et que le feu noir s’arrête au 2 (le 5, le 4, le 3 et le 2 sont posés, il manque le 1), le score est de 20 − 1 = 19. Le score maximal reste 25.",
        "Pour distinguer ce score de celui du jeu de base, on peut y ajouter les mots « poudre noire ».",
      ),
      en: p(
        "Ten black cards form a sixth firework that is built backwards, from 5 down to 1: three 5s, two each of 4, 3 and 2, and one 1. The black 1 completes it and earns a clue token, unless all 8 are already available.",
        "Black can’t be announced as a color: only number clues can point at black cards, and it is also forbidden to tell a player that they have none.",
        "The black firework gives no points, it can only cost you some. Every step still missing to complete it (there are five) takes 1 point off your score. For example, if the five colored fireworks add up to 20 and the black one stops at the 2 (the 5, 4, 3 and 2 are played, the 1 is missing), the score is 20 − 1 = 19. The top score stays 25.",
        "To tell this score apart from a base game score, you can add the words “black powder” to it.",
      ),
      es: p(
        "Diez cartas negras forman un sexto fuego artificial que se construye al revés, del 5 al 1: tres 5, dos 4, dos 3, dos 2 y un 1. El 1 negro completa el fuego y da una ficha de pista, salvo que ya estén disponibles las 8.",
        "El negro no se puede anunciar como color: solo las pistas de número pueden señalar cartas negras, y tampoco se puede decir a un jugador que no tiene ninguna.",
        "El fuego negro no da puntos, solo puede quitarlos. Cada paso que falte para completarlo (son cinco) resta 1 punto a la puntuación. Por ejemplo, si los cinco fuegos de color suman 20 y el negro se queda en el 2 (se han jugado el 5, el 4, el 3 y el 2, y falta el 1), la puntuación es 20 − 1 = 19. La puntuación máxima sigue siendo 25.",
        "Para distinguir esta puntuación de la del juego base, puedes añadirle las palabras «pólvora negra».",
      ),
      de: p(
        "Zehn schwarze Karten bilden ein sechstes Feuerwerk, das rückwärts aufgebaut wird, von 5 bis 1: drei 5er, je zwei 4er, 3er und 2er sowie eine 1. Die schwarze 1 vervollständigt es und bringt ein Hinweisplättchen – außer alle 8 sind schon verfügbar.",
        "Schwarz lässt sich nicht als Farbe ansagen: Nur Zahlenhinweise können auf schwarze Karten zeigen, und es ist auch verboten zu sagen, dass eine Person keine hat.",
        "Das schwarze Feuerwerk bringt keine Punkte, es kann nur welche kosten. Jeder Schritt, der noch zu seiner Vollendung fehlt (es sind fünf), zieht 1 Punkt von der Punktzahl ab. Beispiel: Ergeben die fünf farbigen Feuerwerke zusammen 20 und endet das schwarze bei der 2 (5, 4, 3 und 2 liegen, die 1 fehlt), beträgt die Punktzahl 20 − 1 = 19. Die Höchstpunktzahl bleibt 25.",
        "Um diese Wertung von der des Grundspiels zu unterscheiden, kannst du „Schwarzpulver“ hinter die Punktzahl setzen.",
      ),
    },
  },
  {
    key: "flamboyants",
    title: { fr: "5 Flamboyants", en: "5 Flamboyants", es: "5 Flamboyants", de: "5 Flamboyants" },
    body: {
      fr: p(
        "Cette extension ajoute six tuiles Bonus, mélangées face cachée à côté de la pioche. Chaque fois qu’un feu d’artifice est complété par son 5, vous ne gagnez pas de jeton Indice : vous révélez une tuile au hasard et vous appliquez son effet. La tuile sort ensuite de la partie.",
        "Les effets, par numéro de tuile :",
        ...tileLines("fr"),
        "Le nombre de jetons Indice disponibles ne dépasse jamais 8.",
        "5 Flamboyants peut s’ajouter à Poudre noire ou à Avalanche de couleurs, et les trois extensions peuvent même être jouées ensemble.",
      ),
      en: p(
        "This extension, 5 Flamboyants (the “flamboyant fives”), adds six bonus tiles, shuffled face down next to the draw pile. Each time a firework is completed with its 5, you don’t earn a clue token: you reveal one tile at random and apply its effect instead. The tile then leaves the game.",
        "The effects, by tile number:",
        ...tileLines("en"),
        "The number of available clue tokens never goes above 8.",
        "5 Flamboyants can be added to Black Powder or to Avalanche of Colors, and all three extensions can even be played together.",
      ),
      es: p(
        "Esta extensión, 5 Flamboyants (los «cincos flamboyantes»), añade seis losetas de bonificación, barajadas boca abajo junto al mazo. Cada vez que se completa un fuego artificial con su 5, no ganas una ficha de pista: revelas una loseta al azar y aplicas su efecto. Después, la loseta sale de la partida.",
        "Los efectos, según el número de la loseta:",
        ...tileLines("es"),
        "El número de fichas de pista disponibles nunca supera 8.",
        "5 Flamboyants puede añadirse a Pólvora negra o a Avalancha de colores, y las tres extensiones pueden incluso jugarse juntas.",
      ),
      de: p(
        "Diese Erweiterung, 5 Flamboyants (die „flamboyanten 5er“), bringt sechs Bonusplättchen mit, die verdeckt gemischt neben dem Nachziehstapel liegen. Jedes Mal, wenn ein Feuerwerk mit seiner 5 vervollständigt wird, bekommst du kein Hinweisplättchen: Stattdessen deckst du ein zufälliges Plättchen auf und wendest seinen Effekt an. Danach scheidet das Plättchen aus dem Spiel aus.",
        "Die Effekte, nach Plättchennummer:",
        ...tileLines("de"),
        "Es sind nie mehr als 8 Hinweisplättchen verfügbar.",
        "5 Flamboyants lässt sich zu Schwarzpulver oder zur Farbenlawine hinzufügen, und alle drei Erweiterungen können sogar zusammen gespielt werden.",
      ),
    },
  },
  {
    key: "bouquetFinal",
    title: { fr: "Bouquet final", en: "Grand finale", es: "Traca final", de: "Großes Finale" },
    body: {
      fr: p(
        "Variante pour les groupes expérimentés, que l’hôte peut activer. Ici, pas de barème : seul un spectacle parfait compte, sinon c’est la défaite.",
        "Piocher la dernière carte ne déclenche pas de dernier tour : la partie continue. Elle s’arrête seulement sur une victoire totale (chaque feu d’artifice est complet) ou sur une défaite : la troisième tuile Erreur passe au rouge, ou une carte indispensable est défaussée, c’est-à-dire le dernier exemplaire d’une carte dont un feu a encore besoin.",
        "Sans pioche, les mains se vident peu à peu. Un joueur qui n’a plus aucune action possible peut passer.",
      ),
      en: p(
        "A variant for experienced groups, which the host can switch on. There is no score scale here: only a flawless show counts, otherwise it is a defeat.",
        "Drawing the last card doesn’t trigger a final round: the game carries on. It only stops on total victory (every firework complete) or on defeat: the third fuse token flips to red, or an indispensable card is discarded, meaning the last copy of a card that a firework still needs.",
        "With no draw pile, hands slowly shrink. A player who has no possible action may pass.",
      ),
      es: p(
        "Una variante para grupos con experiencia que el anfitrión puede activar. Aquí no hay escala de puntuación: solo cuenta un espectáculo perfecto; si no, es una derrota.",
        "Robar la última carta no provoca una ronda final: la partida continúa. Solo termina con la victoria total (todos los fuegos artificiales completos) o con la derrota: la tercera ficha de error se da la vuelta, o se descarta una carta indispensable, es decir, la última copia de una carta que algún fuego aún necesita.",
        "Sin mazo, las manos se van reduciendo. Un jugador que no pueda hacer ninguna acción puede pasar.",
      ),
      de: p(
        "Eine Variante für erfahrene Gruppen, die der Gastgeber einschalten kann. Hier gibt es keine Wertungsskala: Nur ein perfektes Feuerwerk zählt, sonst ist das Spiel verloren.",
        "Das Ziehen der letzten Karte löst keine Schlussrunde aus: Das Spiel geht weiter. Es endet nur mit dem totalen Sieg (alle Feuerwerke vollständig) oder mit der Niederlage: Das dritte Fehlerplättchen wird auf die rote Seite gedreht, oder eine unverzichtbare Karte wird abgeworfen, also das letzte Exemplar einer Karte, die ein Feuerwerk noch braucht.",
        "Ohne Nachziehstapel werden die Hände nach und nach kleiner. Wer keine mögliche Aktion mehr hat, darf passen.",
      ),
    },
  },
  {
    key: "online",
    title: { fr: "Jouer en ligne", en: "Playing online", es: "Jugar en línea", de: "Online spielen" },
    body: {
      fr: p(
        "Le jeu mélange, distribue et tient les comptes : jetons, erreurs, défausse et feux d’artifice. Vos propres cartes vous restent cachées, vous ne voyez que celles des autres.",
        "L’hôte choisit les extensions et les options avant de lancer la partie. Le premier joueur est tiré au sort.",
        "Les informations sont la seule aide autorisée : ne glissez pas de conseils par un autre canal (messages, réactions, vocal).",
        "Si un joueur ne joue plus, au bout d’un moment les joueurs présents peuvent voter pour jouer à sa place, et la partie continue.",
      ),
      en: p(
        "The game shuffles, deals and keeps count of the tokens, the mistakes, the discard pile and the fireworks. Your own cards stay hidden from you; you only see everyone else’s.",
        "The host picks the extensions and options before starting the game. The first player is chosen at random.",
        "Clues are the only help allowed: don’t slip in advice through another channel (messages, reactions, voice chat).",
        "If a player stops playing, after a while the players who are present can vote to play for them, and the game carries on.",
      ),
      es: p(
        "El juego baraja, reparte y lleva la cuenta de las fichas, los errores, el descarte y los fuegos artificiales. Tus propias cartas quedan ocultas para ti; solo ves las de los demás.",
        "El anfitrión elige las extensiones y las opciones antes de empezar la partida. El jugador inicial se elige al azar.",
        "Las pistas son la única ayuda permitida: no des consejos por otros medios (mensajes, reacciones, chat de voz).",
        "Si un jugador deja de jugar, pasado un tiempo los jugadores presentes pueden votar para jugar en su lugar, y la partida continúa.",
      ),
      de: p(
        "Das Spiel mischt, teilt aus und führt Buch über Plättchen, Fehler, Ablagestapel und Feuerwerke. Deine eigenen Karten bleiben dir verborgen; du siehst nur die der anderen.",
        "Der Gastgeber wählt vor dem Start die Erweiterungen und Optionen. Wer beginnt, wird zufällig bestimmt.",
        "Hinweise sind die einzige erlaubte Hilfe: Gib keine Ratschläge über andere Kanäle (Nachrichten, Reaktionen, Sprachchat).",
        "Hört eine Person auf zu spielen, können die anwesenden Personen nach einer Weile abstimmen, an ihrer Stelle zu spielen, und das Spiel geht weiter.",
      ),
    },
  },
]

/** Section keys, in the order of the page; stable, so a second run finds the same items. */
export const RULES_SECTION_KEYS = SECTIONS.map((section) => section.key)

/** The shared `rules` document: introduction and sections in the four languages. */
export function buildRules(): SeedDoc {
  return {
    _id: RULES_ID,
    _type: "rules",
    intro: localeText(INTRO),
    sections: SECTIONS.map((section) => ({
      _key: section.key,
      _type: "section",
      title: localeString(section.title),
      body: localeText(section.body),
    })),
  }
}
