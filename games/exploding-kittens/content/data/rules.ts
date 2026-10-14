import { localeString, localeText } from "@pbgo/content-kit"
import type { Localized, SeedDoc } from "@pbgo/content-kit"

export const RULES_ID = "rules"

// The rules page of the shared `rules` document, in PBGO's own words: the official rulebook is linked from `settings`, never copied.
// It covers the standard rules, the Nope window and the five-different combination (on by default, as in the engine's `fiveDifferent`; the host can turn it off).
// Registers follow the site's translations: vous (fr), you (en), tú (es), du (de). A group is never addressed directly in Spanish and German.

type Section = { key: string; title: Localized; body: Localized }

/** Paragraphs are separated by a blank line, which is what the Studio field expects. */
const p = (...paragraphs: string[]) => paragraphs.join("\n\n")

const INTRO: Localized = {
  fr: "Exploding Kittens est un jeu de cartes de chance et de nerfs, pour 2 à 5 joueurs, en environ 15 minutes. Chacun pioche à son tour en espérant ne pas tomber sur un chaton qui explose : le dernier joueur encore en jeu gagne.",
  en: "Exploding Kittens is a card game of luck and nerve for 2 to 5 players, about 15 minutes long. Everyone draws in turn and hopes not to find an exploding kitten: the last player still in the game wins.",
  es: "Exploding Kittens es un juego de cartas de suerte y sangre fría de 2 a 5 jugadores, de unos 15 minutos. Cada uno roba por turnos con la esperanza de no encontrar un gatito que explota: gana el último jugador que sigue en la partida.",
  de: "Exploding Kittens ist ein Kartenspiel voller Glück und Nervenkitzel für 2 bis 5 Personen, das etwa 15 Minuten dauert. Reihum zieht jede Person eine Karte und hofft, kein explodierendes Kätzchen zu erwischen: Gewonnen hat, wer zuletzt noch im Spiel ist.",
}

const SECTIONS: Section[] = [
  {
    key: "goal",
    title: { fr: "But du jeu", en: "Goal", es: "Objetivo", de: "Ziel" },
    body: {
      fr: p(
        "Des Exploding Kittens se cachent dans la pioche. Qui en pioche un explose et quitte la partie, à moins de jouer aussitôt un Kit de désamorçage.",
        "Il n’y a pas de points : le dernier joueur encore en jeu gagne. Vos cartes servent à éviter de piocher, à savoir ce qui vous attend ou à mettre les autres en difficulté.",
      ),
      en: p(
        "Exploding Kittens hide in the draw pile. Whoever draws one explodes and is out of the game, unless a Defuse is played right away.",
        "There are no points: the last player still in the game wins. You play your cards to avoid drawing, to know what is coming or to put the others in trouble.",
      ),
      es: p(
        "En el mazo se esconden Exploding Kittens. Quien roba uno explota y queda fuera de la partida, a menos que juegue una Desactivación de inmediato.",
        "No hay puntos: gana el último jugador que sigue en la partida. Juegas tus cartas para no robar, para saber lo que viene o para poner en apuros a los demás.",
      ),
      de: p(
        "Im Spielstapel verstecken sich Exploding Kittens. Wer eines zieht, explodiert und scheidet aus dem Spiel aus – außer, es folgt sofort eine Entschärfung.",
        "Punkte gibt es nicht: Gewonnen hat, wer zuletzt noch im Spiel ist. Du spielst deine Karten aus, um nicht zu ziehen, um zu wissen, was kommt, oder um die anderen in Bedrängnis zu bringen.",
      ),
    },
  },
  {
    key: "setup",
    title: { fr: "Mise en place", en: "Setup", es: "Preparación", de: "Vorbereitung" },
    body: {
      fr: p(
        "Le jeu met de côté les 4 Exploding Kittens et les 6 Kits de désamorçage. Chaque joueur reçoit un Kit de désamorçage. Parmi les Kits restants, 2 sont remis avec les autres cartes (un seul avec 5 joueurs) ; les éventuels autres quittent la partie sans être vus.",
        "Les cartes sont mélangées, puis chaque joueur en reçoit 7 : avec son Kit de désamorçage, sa main de départ compte donc 8 cartes. Un Kit remis avec les autres peut aussi se retrouver dans une main.",
        "Le jeu mélange ensuite aux cartes restantes un Exploding Kitten de moins que de joueurs : un seul avec 2 joueurs, 4 avec 5 joueurs. Les autres quittent la partie sans être vus.",
        "Ces cartes forment la pioche, posée face cachée au centre de la table avec de la place à côté pour la défausse. Elle compte au départ 35 cartes avec 2 joueurs, 29 avec 3 joueurs, 23 avec 4 joueurs et 16 avec 5 joueurs.",
      ),
      en: p(
        "The game sets aside the 4 Exploding Kittens and the 6 Defuses. Every player gets one Defuse. Of the Defuses left over, 2 are shuffled back in with the other cards (just one with 5 players); any others leave the game unseen.",
        "The cards are shuffled and every player is dealt 7 of them, so with the Defuse a starting hand has 8 cards. A Defuse that was put back in can be dealt too.",
        "The game then shuffles one Exploding Kitten fewer than there are players into the remaining cards: just one with 2 players, 4 with 5 players. The other kittens leave the game unseen.",
        "These cards form the draw pile, which goes face down in the middle of the table with room beside it for the discard pile. At the start it holds 35 cards with 2 players, 29 with 3, 23 with 4 and 16 with 5.",
      ),
      es: p(
        "El juego aparta los 4 Exploding Kittens y las 6 Desactivaciones. Cada jugador recibe una Desactivación. De las que sobran, 2 se mezclan de nuevo con las demás cartas (solo una con 5 jugadores); las demás, si las hay, salen de la partida sin que nadie las vea.",
        "Se barajan las cartas y cada jugador recibe 7: con su Desactivación, la mano inicial tiene 8 cartas. Una Desactivación devuelta con las demás también puede acabar en una mano.",
        "Después se mezcla con el resto un Exploding Kitten menos que jugadores: solo uno con 2 jugadores, 4 con 5 jugadores. Los demás salen de la partida sin que nadie los vea.",
        "Estas cartas forman el mazo, que se coloca boca abajo en el centro de la mesa, con sitio al lado para el descarte. Al empezar tiene 35 cartas con 2 jugadores, 29 con 3, 23 con 4 y 16 con 5.",
      ),
      de: p(
        "Das Spiel legt die 4 Exploding Kittens und die 6 Entschärfungen beiseite. Jede Person bekommt eine Entschärfung. Von den übrigen werden 2 wieder zu den anderen Karten gemischt (bei 5 Personen nur eine); weitere werden ungesehen aus dem Spiel genommen.",
        "Die Karten werden gemischt und jede Person bekommt 7: Mit der Entschärfung besteht die Starthand also aus 8 Karten. Auch eine zurückgemischte Entschärfung kann dabei in einer Hand landen.",
        "Danach wird ein Exploding Kitten weniger, als Personen mitspielen, unter die übrigen Karten gemischt: nur eines bei 2 Personen, 4 bei 5 Personen. Die anderen werden ungesehen aus dem Spiel genommen.",
        "Diese Karten bilden den Spielstapel, der verdeckt in der Tischmitte liegt, mit Platz daneben für den Ablagestapel. Zu Beginn hat er 35 Karten bei 2 Personen, 29 bei 3, 23 bei 4 und 16 bei 5.",
      ),
    },
  },
  {
    key: "turn",
    title: { fr: "Le tour de jeu", en: "Your turn", es: "El turno", de: "Der Spielzug" },
    body: {
      fr: p(
        "Le premier joueur est tiré au sort, puis le tour passe dans le sens des aiguilles d’une montre. À votre tour, vous jouez autant de cartes que vous voulez, ou aucune, puis vous piochez la carte du dessus de la pioche. Piocher termine votre tour.",
        "Il n’y a pas de limite de cartes en main, et rien ne vous oblige à jouer une carte : avec une main vide, vous piochez simplement.",
        "Chaque carte ou combinaison que vous jouez va face visible sur la défausse et ouvre une fenêtre de Non avant de produire son effet. Vous ne pouvez pas jouer la carte suivante tant que cette fenêtre n’est pas fermée.",
      ),
      en: p(
        "The first player is chosen at random, then play goes clockwise. On your turn you play as many cards as you like, or none, then draw the top card of the draw pile. Drawing ends your turn.",
        "There is no hand limit, and you are never forced to play a card: with an empty hand you simply draw.",
        "Every card or combination you play goes face up onto the discard pile and opens a Nope window before it takes effect. You can’t play your next card until that window has closed.",
      ),
      es: p(
        "El jugador inicial se elige al azar y el turno pasa en el sentido de las agujas del reloj. En tu turno juegas las cartas que quieras, o ninguna, y después robas la carta de arriba del mazo. Robar termina tu turno.",
        "No hay límite de cartas en la mano y nada te obliga a jugar una carta: con la mano vacía, simplemente robas.",
        "Cada carta o combinación que juegas va boca arriba al descarte y abre una ventana de Nope antes de surtir efecto. No puedes jugar la siguiente carta hasta que esa ventana se cierre.",
      ),
      de: p(
        "Wer beginnt, wird zufällig bestimmt; danach geht es im Uhrzeigersinn weiter. In deinem Zug spielst du so viele Karten aus, wie du möchtest, oder keine, und ziehst dann die oberste Karte des Spielstapels. Mit dem Ziehen endet dein Zug.",
        "Ein Handkartenlimit gibt es nicht, und du musst auch keine Karte ausspielen: Mit leerer Hand ziehst du einfach.",
        "Jede Karte und jede Kombination, die du ausspielst, liegt offen auf dem Ablagestapel und öffnet ein Nö-Fenster, bevor sie wirkt. Die nächste Karte kannst du erst spielen, wenn dieses Fenster geschlossen ist.",
      ),
    },
  },
  {
    key: "explosion",
    title: { fr: "Explosion et désamorçage", en: "Exploding and defusing", es: "Explosión y desactivación", de: "Explosion und Entschärfung" },
    body: {
      fr: p(
        "Un Exploding Kitten pioché est montré à tout le monde. Sans Kit de désamorçage, vous explosez : vous êtes éliminé et toute votre main, chaton compris, va à la défausse.",
        "Avec un Kit de désamorçage en main, vous devez le jouer : il va à la défausse, puis vous remettez en secret le chaton dans la pioche, à l’endroit de votre choix (dessus, dessous ou entre deux), sans regarder ni réorganiser les autres cartes. Cela met fin à l’un de vos tours.",
        "Les autres voient que le chaton est retourné dans la pioche, mais pas à quel endroit : vous seul le savez.",
      ),
      en: p(
        "An Exploding Kitten you draw is shown to everyone. Without a Defuse you explode: you are eliminated, and your whole hand, kitten included, goes to the discard pile.",
        "If you hold a Defuse, you have to play it. It goes to the discard pile, then you secretly put the kitten back into the draw pile wherever you like (top, bottom or in between), without looking at or rearranging the other cards. This ends one of your turns.",
        "The others see that the kitten went back into the draw pile, but not where: only you know.",
      ),
      es: p(
        "Un Exploding Kitten robado se muestra a todos. Sin una Desactivación, explotas: quedas eliminado y toda tu mano, gatito incluido, va al descarte.",
        "Si tienes una Desactivación, debes jugarla: va al descarte y luego vuelves a meter en secreto el gatito en el mazo, donde quieras (arriba, abajo o en medio), sin mirar ni reordenar las demás cartas. Esto termina uno de tus turnos.",
        "Los demás ven que el gatito ha vuelto al mazo, pero no dónde: solo tú lo sabes.",
      ),
      de: p(
        "Ein gezogenes Exploding Kitten wird allen gezeigt. Ohne Entschärfung explodierst du: Du bist ausgeschieden, und deine gesamte Hand samt Kätzchen kommt auf den Ablagestapel.",
        "Hast du eine Entschärfung auf der Hand, musst du sie ausspielen: Sie kommt auf den Ablagestapel, dann steckst du das Kätzchen heimlich an eine Stelle deiner Wahl in den Spielstapel zurück (oben, unten oder dazwischen), ohne die anderen Karten anzusehen oder umzusortieren. Damit endet einer deiner Züge.",
        "Die anderen sehen, dass das Kätzchen in den Spielstapel zurückgekehrt ist, aber nicht wohin: Nur du weißt es.",
      ),
    },
  },
  {
    key: "cards",
    title: { fr: "Les cartes", en: "The cards", es: "Las cartas", de: "Die Karten" },
    body: {
      fr: p(
        "En plus de l’Exploding Kitten et du Kit de désamorçage, vus plus haut, voici l’effet des autres cartes. Les actions se jouent à votre tour ; seul le Non peut se jouer hors de votre tour.",
        "**Attaque.** Termine votre tour sans piocher. Le joueur suivant doit jouer 2 tours de suite.",
        "**Passe-tour.** Termine l’un de vos tours sans piocher. Si vous subissez une Attaque, il vous reste l’autre tour à jouer.",
        "**Faveur.** Désignez un autre joueur qui a au moins une carte : il choisit lui-même la carte de sa main qu’il vous donne.",
        "**Mélange.** Mélange la pioche au hasard.",
        "**Divination.** Regardez en secret les 3 cartes du dessus de la pioche (ou toutes, s’il en reste moins), puis remettez-les dans le même ordre.",
        "**Non.** Annule une action qui vient d’être jouée, ou un autre Non. Se joue hors de votre tour, mais seulement tant qu’une fenêtre de Non est ouverte.",
        "**Cartes Chat.** Tacocat, Cattermelon, Hairy Potato Cat, Beard Cat et Rainbow-Ralphing Cat, 4 exemplaires de chacun. Seules, elles ne font rien : elles servent surtout aux combinaisons ci-dessous.",
      ),
      en: p(
        "Besides the Exploding Kitten and the Defuse, covered above, here is what the other cards do. Actions are played on your turn; only the Nope can be played out of turn.",
        "**Attack.** Ends your turn without drawing. The next player has to take 2 turns in a row.",
        "**Skip.** Ends one of your turns without drawing. If you were attacked, you still owe the other turn.",
        "**Favor.** Choose another player who has at least one card: they pick a card from their hand and give it to you, whichever they like.",
        "**Shuffle.** Shuffles the draw pile at random.",
        "**See the Future.** Look in secret at the top 3 cards of the draw pile (or all of them, if fewer are left), then put them back in the same order.",
        "**Nope.** Cancels an action that was just played, or another Nope. Can be played out of turn, but only while a Nope window is open.",
        "**Cat cards.** Tacocat, Cattermelon, Hairy Potato Cat, Beard Cat and Rainbow-Ralphing Cat, 4 copies of each. On their own they do nothing; they are mainly used in the combinations below.",
      ),
      es: p(
        "Además del Exploding Kitten y la Desactivación, vistos arriba, esto es lo que hacen las demás cartas. Las acciones se juegan en tu turno; solo el Nope puede jugarse fuera de turno.",
        "**Ataque.** Termina tu turno sin robar. El siguiente jugador debe jugar 2 turnos seguidos.",
        "**Salta.** Termina uno de tus turnos sin robar. Si te han atacado, aún debes jugar el otro turno.",
        "**Favor.** Elige a otro jugador que tenga al menos una carta: escoge la carta de su mano que quiera y te la da.",
        "**Barajar.** Baraja el mazo al azar.",
        "**Ver el futuro.** Mira en secreto las 3 primeras cartas del mazo (o todas, si quedan menos) y déjalas en el mismo orden.",
        "**Nope.** Cancela una acción recién jugada, o a otro Nope. Se puede jugar fuera de turno, pero solo mientras haya una ventana de Nope abierta.",
        "**Cartas de gato.** Tacocat, Cattermelon, Hairy Potato Cat, Beard Cat y Rainbow-Ralphing Cat, 4 copias de cada una. Solas no hacen nada: sirven sobre todo para las combinaciones de abajo.",
      ),
      de: p(
        "Außer dem Exploding Kitten und der Entschärfung, die oben beschrieben sind, wirken die übrigen Karten so. Aktionen spielst du in deinem Zug; nur das NÖ! darfst du auch außerhalb deines Zugs spielen.",
        "**Angriff.** Beendet deinen Zug, ohne dass du ziehst. Die nächste Person muss 2 Züge hintereinander spielen.",
        "**Hops!** Beendet einen deiner Züge, ohne dass du ziehst. Bei einem Angriff bleibt der andere Zug trotzdem offen.",
        "**Wunsch.** Wähle eine andere Person mit mindestens einer Karte: Sie sucht sich aus ihrer Hand eine beliebige Karte aus und gibt sie dir.",
        "**Mischen.** Mischt den Spielstapel zufällig durch.",
        "**Blick in die Zukunft.** Schau dir heimlich die obersten 3 Karten des Spielstapels an (oder alle, falls weniger übrig sind) und lege sie in derselben Reihenfolge zurück.",
        "**NÖ!** Hebt eine gerade gespielte Aktion auf – oder ein anderes NÖ! Kann auch außerhalb deines Zugs gespielt werden, aber nur bei offenem Nö-Fenster.",
        "**Katzen-Karten.** Tacocat, Cattermelon, Hairy Potato Cat, Beard Cat und Rainbow-Ralphing Cat, jeweils 4 Exemplare. Allein haben sie keine Wirkung; sie dienen vor allem den Kombinationen weiter unten.",
      ),
    },
  },
  {
    key: "combos",
    title: { fr: "Les combinaisons", en: "Combinations", es: "Combinaciones", de: "Kombinationen" },
    body: {
      fr: p(
        "Des cartes de même titre peuvent se jouer ensemble en combinaison. Leurs effets imprimés sont alors ignorés, et n’importe quelle carte peut en faire partie, Kit de désamorçage et Non compris : deux Attaques jouées ensemble n’attaquent personne.",
        "**Deux pareilles.** Jouez 2 cartes de même titre et désignez un autre joueur qui a au moins une carte : vous lui prenez une carte au hasard, tirée par le jeu et non choisie par vous.",
        "**Trois pareilles.** Jouez 3 cartes de même titre, désignez un autre joueur qui a au moins une carte et annoncez un titre de carte (sauf Exploding Kitten). S’il en possède une, il doit vous la donner ; sinon, il ne se passe rien, mais la combinaison est perdue. Le titre annoncé et le résultat sont visibles de tous.",
        "**Cinq différentes.** Option, activée par défaut ; l’hôte peut la désactiver avant la partie. Jouez 5 cartes aux titres tous différents et prenez dans la défausse la carte de votre choix, sauf une de celles que vous venez de jouer ou un Exploding Kitten. Impossible s’il n’y a aucune carte à prendre. Les cinq chats comptent comme des titres différents, un Kit de désamorçage peut être pris, et si la fenêtre de Non annule la combinaison, rien n’est pris.",
      ),
      en: p(
        "Cards with the same title can be played together as a combination. Their printed effects are then ignored, and any card can be part of one, Defuse and Nope included: two Attacks played together attack nobody.",
        "**Pair.** Play 2 cards with the same title and choose another player who has at least one card: you take a random card from their hand, drawn by the game rather than chosen by you.",
        "**Three of a kind.** Play 3 cards with the same title, choose another player who has at least one card and name a card title (any except Exploding Kitten). If they hold one, they must give it to you; if not, nothing happens, but the combination is spent. The named title and the result are visible to everyone.",
        "**Five different.** An option, on by default; the host can turn it off before the game. Play 5 cards that all have different titles and take any card you like from the discard pile, except one of those you just played or an Exploding Kitten. You can’t play it if there is nothing to take. The five cats count as different titles, a Defuse may be taken, and if the Nope window cancels the combination, nothing is taken.",
      ),
      es: p(
        "Las cartas con el mismo título pueden jugarse juntas como combinación. Sus efectos impresos se ignoran, y cualquier carta puede formar parte de una, incluidas la Desactivación y el Nope: dos Ataques jugados juntos no atacan a nadie.",
        "**Pareja.** Juega 2 cartas con el mismo título y elige a otro jugador que tenga al menos una carta: le quitas una carta al azar; la saca el juego, no la eliges tú.",
        "**Trío.** Juega 3 cartas con el mismo título, elige a otro jugador que tenga al menos una carta y nombra un título de carta (cualquiera menos Exploding Kitten). Si la tiene, debe dártela; si no, no pasa nada, pero la combinación se pierde. El título nombrado y el resultado son visibles para todos.",
        "**Cinco distintas.** Es una opción, activada por defecto; el anfitrión puede desactivarla antes de la partida. Juega 5 cartas con títulos todos distintos y toma del descarte la carta que quieras, salvo una de las que acabas de jugar o un Exploding Kitten. No se puede jugar si no hay nada que tomar. Los cinco gatos cuentan como títulos distintos, se puede tomar una Desactivación, y si la ventana de Nope anula la combinación, no se toma nada.",
      ),
      de: p(
        "Karten mit demselben Titel lassen sich gemeinsam als Kombination ausspielen. Ihre aufgedruckten Wirkungen zählen dann nicht, und jede Karte kann dazugehören, auch die Entschärfung und das NÖ!: Zwei zusammen gespielte Angriffe greifen niemanden an.",
        "**Pärchen.** Spiele 2 Karten mit demselben Titel aus und wähle eine andere Person mit mindestens einer Karte: Du nimmst ihr eine Karte aus der Hand, die das Spiel zufällig bestimmt – du suchst sie nicht selbst aus.",
        "**Drilling.** Spiele 3 Karten mit demselben Titel aus, wähle eine andere Person mit mindestens einer Karte und nenne einen Kartentitel (außer Exploding Kitten). Besitzt sie eine solche Karte, muss sie sie dir geben; sonst passiert nichts, die Kombination ist aber verbraucht. Der genannte Titel und das Ergebnis sind für alle sichtbar.",
        "**Fünfling.** Eine Option, standardmäßig an; der Gastgeber kann sie vor dem Spiel ausschalten. Spiele 5 Karten mit lauter verschiedenen Titeln aus und nimm dir eine beliebige Karte vom Ablagestapel, nur keine der soeben gespielten und kein Exploding Kitten. Liegt keine passende Karte im Ablagestapel, lässt sich die Kombination nicht spielen. Die fünf Katzen zählen als verschiedene Titel, auch eine Entschärfung darf genommen werden, und wird die Kombination im Nö-Fenster aufgehoben, wird nichts genommen.",
      ),
    },
  },
  {
    key: "nope",
    title: { fr: "La fenêtre de Non", en: "The Nope window", es: "La ventana de Nope", de: "Das Nö-Fenster" },
    body: {
      fr: p(
        "Une fenêtre de Non s’ouvre pour toute carte d’action (Attaque, Passe-tour, Faveur, Mélange, Divination) et toute combinaison. Elle ne s’ouvre jamais pour une pioche, un Exploding Kitten, un Kit de désamorçage (ni le retour du chaton dans la pioche), le don d’une carte pour une Faveur ou le choix d’une carte dans la défausse.",
        "Tous les joueurs encore en jeu peuvent réagir, sauf l’auteur de la dernière carte jouée (d’abord celui qui a lancé l’action, puis celui qui a joué le dernier Non). Réagir, c’est jouer un Non, si vous en avez un, ou passer. Un Non peut lui-même être annulé par un Non : même le joueur qui a lancé l’action peut répondre à un Non par un autre.",
        "Chaque Non relance la fenêtre à sa durée complète, et les passes déjà faits ne comptent plus. La fenêtre se ferme quand le temps est écoulé ou quand tous ceux qui peuvent réagir ont passé. Elle dure 5 secondes par défaut ; l’hôte peut choisir 3, 5 ou 8 secondes avant la partie.",
        "Avec un nombre pair de Non, l’action se déroule ; avec un nombre impair, elle est annulée. Les cartes annulées restent sur la défausse. Si une Divination est annulée, son auteur ne voit rien ; si un Mélange l’est, la pioche n’est pas mélangée ; si un Passe-tour l’est, le tour continue et il faut quand même piocher ; si c’est une combinaison, toutes ses cartes sont perdues. Un joueur éliminé ne peut pas jouer de Non.",
        "Pour que personne ne se trahisse, tous ceux qui peuvent réagir voient le même compte à rebours et les mêmes boutons, qu’ils aient un Non en main ou non, et la fenêtre n’est jamais sautée parce que personne n’en aurait. Le jeu n’affiche jamais qui a passé, seulement qui a joué un Non.",
        "Si le Non d’un autre joueur arrive juste avant le vôtre, le vôtre n’est pas joué : la table se met à jour et vous décidez de nouveau, pour qu’un Non n’annule jamais par erreur celui d’un autre.",
      ),
      en: p(
        "A Nope window opens for every action card (Attack, Skip, Favor, Shuffle, See the Future) and every combination. It never opens for drawing a card, an Exploding Kitten, a Defuse (or putting the kitten back), giving a card for a Favor, or choosing a card from the discard pile.",
        "Every player still in the game can react, except the author of the last card played (first the player who started the action, then whoever played the latest Nope). Reacting means playing a Nope, if you have one, or passing. A Nope can itself be Noped, so even the player who started the action can answer a Nope with another one.",
        "Each Nope restarts the window at its full length, and earlier passes no longer count. The window closes when time runs out or when everyone who can react has passed. It lasts 5 seconds by default; the host can pick 3, 5 or 8 seconds before the game.",
        "With an even number of Nopes the action goes ahead; with an odd number it is canceled. Canceled cards stay in the discard pile. If a See the Future is canceled, its player sees nothing; if a Shuffle is, the draw pile isn’t shuffled; if a Skip is, the turn goes on and the player still has to draw; if a combination is, all its cards are lost. Eliminated players can’t play a Nope.",
        "So that nobody gives anything away, everyone who can react sees the same countdown and the same buttons, whether or not they hold a Nope, and the window is never skipped just because nobody holds one. The game never shows who has passed, only who played a Nope.",
        "If another player’s Nope lands just before yours, yours is not played: the table updates and you decide again, so that a Nope never cancels someone else’s Nope by mistake.",
      ),
      es: p(
        "Se abre una ventana de Nope con cada carta de acción (Ataque, Salta, Favor, Barajar, Ver el futuro) y con cada combinación. Nunca se abre al robar una carta, ni por un Exploding Kitten, una Desactivación (o devolver el gatito), dar una carta por un Favor o elegir una carta del descarte.",
        "Pueden reaccionar todos los jugadores que siguen en la partida, salvo el autor de la última carta jugada (primero quien inició la acción y luego quien jugó el último Nope). Reaccionar es jugar un Nope, si tienes uno, o pasar. Un Nope puede anularse con otro Nope, así que incluso quien inició la acción puede responder a un Nope con otro.",
        "Cada Nope reinicia la ventana con su duración completa, y los pases anteriores dejan de contar. La ventana se cierra cuando se acaba el tiempo o cuando todos los que pueden reaccionar han pasado. Dura 5 segundos por defecto; el anfitrión puede elegir 3, 5 u 8 segundos antes de la partida.",
        "Con un número par de Nopes, la acción se resuelve; con un número impar, se anula. Las cartas anuladas se quedan en el descarte. Si se anula Ver el futuro, quien lo jugó no ve nada; si se anula Barajar, el mazo no se baraja; si se anula Salta, el turno continúa y hay que robar igualmente; si se anula una combinación, se pierden todas sus cartas. Los jugadores eliminados no pueden jugar un Nope.",
        "Para que nadie se delate, todos los que pueden reaccionar ven la misma cuenta atrás y los mismos botones, tengan o no un Nope en la mano, y la ventana nunca se salta porque nadie tenga uno. El juego nunca muestra quién ha pasado, solo quién ha jugado un Nope.",
        "Si el Nope de otro jugador llega justo antes que el tuyo, el tuyo no se juega: la mesa se actualiza y decides de nuevo, para que un Nope nunca anule por error el de otro.",
      ),
      de: p(
        "Ein Nö-Fenster öffnet sich bei jeder Aktionskarte (Angriff, Hops!, Wunsch, Mischen, Blick in die Zukunft) und bei jeder Kombination. Nie öffnet es sich beim Ziehen einer Karte, bei einem Exploding Kitten, einer Entschärfung (oder dem Zurückstecken des Kätzchens), beim Geben einer Karte für einen Wunsch oder beim Aussuchen einer Karte vom Ablagestapel.",
        "Reagieren dürfen alle, die noch im Spiel sind, außer der Person, die die letzte Karte gespielt hat (zuerst die Person, die die Aktion gestartet hat, dann die, die das letzte NÖ! gespielt hat). Reagieren heißt: ein NÖ! spielen, wenn du eines hast, oder passen. Ein NÖ! kann selbst wieder aufgehoben werden, sodass sogar die Person, die die Aktion gestartet hat, auf ein NÖ! mit einem weiteren antworten kann.",
        "Jedes NÖ! startet das Fenster mit voller Dauer neu, und frühere Pässe zählen nicht mehr. Das Fenster schließt sich, wenn die Zeit abgelaufen ist oder alle, die reagieren dürfen, gepasst haben. Standardmäßig dauert es 5 Sekunden; der Gastgeber kann vor dem Spiel 3, 5 oder 8 Sekunden wählen.",
        "Bei einer geraden Anzahl von NÖ!-Karten wird die Aktion ausgeführt, bei einer ungeraden wird sie aufgehoben. Aufgehobene Karten bleiben auf dem Ablagestapel. Wird Blick in die Zukunft aufgehoben, sieht die Person nichts; wird Mischen aufgehoben, bleibt der Spielstapel unverändert; wird Hops! aufgehoben, geht der Zug weiter und es wird trotzdem gezogen; wird eine Kombination aufgehoben, sind alle ihre Karten verloren. Ausgeschiedene Personen dürfen kein NÖ! spielen.",
        "Damit sich niemand verrät, sehen alle, die reagieren dürfen, denselben Countdown und dieselben Schaltflächen – egal, ob sie ein NÖ! auf der Hand haben oder nicht –, und das Fenster wird nie übersprungen, nur weil niemand eines hätte. Das Spiel zeigt nie, wer gepasst hat, sondern nur, wer ein NÖ! gespielt hat.",
        "Kommt das NÖ! einer anderen Person kurz vor deinem an, wird deines nicht gespielt: Der Tisch aktualisiert sich und du entscheidest neu, damit ein NÖ! nie aus Versehen das einer anderen Person aufhebt.",
      ),
    },
  },
  {
    key: "attack",
    title: { fr: "Attaques en chaîne", en: "Stacked attacks", es: "Ataques en cadena", de: "Angriffe in Serie" },
    body: {
      fr: p(
        "Une Attaque met fin à votre tour sans piocher : le joueur suivant encore en jeu doit jouer 2 tours de suite, et les tours qui vous restaient disparaissent. Si vous aviez été attaqué, il doit jouer 2 tours de plus que ceux qu’il vous restait, tour en cours compris.",
        "Exemples : si vous venez d’être attaqué et répondez aussitôt par une Attaque, le joueur suivant doit jouer 4 tours. Si vous jouez d’abord un tour, puis une Attaque pendant le second, il en joue 3. En enchaînant les Attaques, on passe de 2 à 4, puis à 6 tours.",
        "Un Passe-tour, une pioche sans danger et un Kit de désamorçage utilisé consomment chacun un seul des tours dus. Une Attaque annulée par un Non est sans effet : vous gardez votre tour. Si vous explosez alors qu’il vous restait des tours, ils disparaissent et le joueur suivant joue un tour normal.",
      ),
      en: p(
        "An Attack ends your turn without drawing: the next player still in the game must take 2 turns in a row, and any turns you still owed disappear. If you had been attacked, they take 2 more turns than you had left, the current one included.",
        "Examples: if you have just been attacked and answer with an Attack right away, the next player takes 4 turns. If you play one turn first and then an Attack during the second, they take 3. Chained Attacks grow from 2 to 4, then to 6 turns.",
        "A Skip, a safe draw and a Defuse each use up just one of the turns owed. An Attack canceled by a Nope has no effect: you keep your turn. If you explode while you still owed turns, they disappear and the next player takes a normal single turn.",
      ),
      es: p(
        "Un Ataque termina tu turno sin robar: el siguiente jugador que siga en la partida debe jugar 2 turnos seguidos, y los turnos que te quedaban desaparecen. Si te habían atacado, debe jugar 2 turnos más que los que te quedaban, contando el actual.",
        "Ejemplos: si acaban de atacarte y respondes enseguida con un Ataque, el siguiente jugador debe jugar 4 turnos. Si primero juegas un turno y luego un Ataque durante el segundo, juega 3. Los ataques encadenados pasan de 2 a 4 y luego a 6 turnos.",
        "Jugar Salta, robar sin peligro y usar una Desactivación consumen cada cosa solo uno de los turnos pendientes. Un Ataque anulado por un Nope no tiene efecto: conservas tu turno. Si explotas mientras te quedaban turnos, desaparecen y el siguiente jugador juega un turno normal.",
      ),
      de: p(
        "Ein Angriff beendet deinen Zug, ohne dass du ziehst: Die nächste Person, die noch im Spiel ist, muss 2 Züge hintereinander spielen, und deine restlichen Züge verfallen. Wurdest du angegriffen, muss sie 2 Züge mehr spielen, als du noch übrig hattest, den laufenden Zug eingerechnet.",
        "Beispiele: Wurdest du gerade angegriffen und antwortest sofort mit einem Angriff, muss die nächste Person 4 Züge spielen. Spielst du erst einen Zug und dann im zweiten einen Angriff, sind es 3. Verkettete Angriffe steigern sich von 2 auf 4 und dann auf 6 Züge.",
        "Eine Hops!-Karte, ein ungefährliches Ziehen und eine Entschärfung verbrauchen jeweils nur einen der offenen Züge. Ein durch ein NÖ! aufgehobener Angriff bleibt wirkungslos: Du behältst deinen Zug. Explodierst du, während noch Züge offen waren, verfallen sie, und die nächste Person spielt einen normalen einzelnen Zug.",
      ),
    },
  },
  {
    key: "end",
    title: { fr: "Fin de partie", en: "End of the game", es: "Fin de la partida", de: "Spielende" },
    body: {
      fr: p(
        "La partie s’arrête dès qu’un seul joueur reste en jeu : il gagne. Quand l’un des 2 derniers joueurs explose, la partie est donc finie aussitôt.",
        "Il n’y a pas de points. Le classement suit l’ordre des éliminations : le dernier éliminé est deuxième, et ainsi de suite. Il n’y a jamais d’égalité.",
        "Il reste toujours dans la pioche un Exploding Kitten de moins que de joueurs encore en jeu : elle ne peut donc jamais être vide tant que la partie continue.",
        "Un joueur éliminé reste à la table et regarde la partie, mais il ne voit pas les mains des autres.",
      ),
      en: p(
        "The game ends as soon as only one player is left: they win. When one of the last 2 players explodes, the game is over at once.",
        "There are no points. The ranking follows the order of elimination: the last player out comes second, and so on. There are never any ties.",
        "There is always one Exploding Kitten fewer in the draw pile than there are players still in the game, so the pile is never empty while the game goes on.",
        "An eliminated player stays at the table and watches the game, but can’t see anyone’s hand.",
      ),
      es: p(
        "La partida termina en cuanto queda un solo jugador: ese gana. Cuando explota uno de los 2 últimos jugadores, la partida acaba al instante.",
        "No hay puntos. La clasificación sigue el orden de eliminación: el último eliminado queda segundo, y así sucesivamente. Nunca hay empates.",
        "En el mazo siempre queda un Exploding Kitten menos que jugadores en la partida, así que el mazo nunca está vacío mientras la partida continúa.",
        "Un jugador eliminado se queda en la mesa y mira la partida, pero no ve las manos de los demás.",
      ),
      de: p(
        "Das Spiel endet, sobald nur noch eine Person übrig ist: Sie gewinnt. Explodiert eine der letzten 2 Personen, ist das Spiel sofort vorbei.",
        "Punkte gibt es nicht. Die Platzierung folgt der Reihenfolge des Ausscheidens: Wer als Letztes ausscheidet, belegt den zweiten Platz, und so weiter. Gleichstände gibt es nie.",
        "Im Spielstapel steckt immer ein Exploding Kitten weniger, als Personen noch im Spiel sind; er ist also nie leer, solange das Spiel läuft.",
        "Wer ausgeschieden ist, bleibt am Tisch und schaut zu, sieht aber keine Hände der anderen.",
      ),
    },
  },
  {
    key: "online",
    title: { fr: "Jouer en ligne", en: "Playing online", es: "Jugar en línea", de: "Online spielen" },
    body: {
      fr: p(
        "Le jeu mélange, distribue et applique les règles : il tire lui-même la carte prise avec deux pareilles et garde secret l’ordre de la pioche. Vous ne voyez que votre propre main ; chez les autres, seulement le nombre de cartes.",
        "Tout le monde voit la taille de la pioche et la défausse, que l’on peut parcourir. Seuls les joueurs concernés voient la carte donnée pour une Faveur ou prise avec deux pareilles ; seul le joueur qui joue une Divination voit les 3 cartes, et seul celui qui remet un chaton sait où il l’a glissé. Les trois pareilles et les cinq différentes se jouent à découvert.",
        "L’hôte choisit les options avant de lancer la partie : la durée de la fenêtre de Non et l’activation de la combinaison Cinq différentes.",
        "Si un joueur ne joue plus, au bout d’un moment les joueurs présents peuvent voter pour jouer à sa place, et la partie continue. Un joueur absent ne réagit simplement pas dans une fenêtre de Non : elle se ferme quand le temps est écoulé.",
      ),
      en: p(
        "The game shuffles, deals and applies the rules: it draws the card taken with a pair itself and keeps the order of the draw pile secret. You only see your own hand; for the others you see just the number of cards.",
        "Everyone sees the size of the draw pile and the discard pile, which can be browsed. Only the players involved see the card given for a Favor or taken with a pair; only the player who plays a See the Future sees the 3 cards, and only the player who puts a kitten back knows where it went. A three of a kind and a five different are played in the open.",
        "The host picks the options before starting the game: the length of the Nope window and whether the Five different combination is in play.",
        "If a player stops playing, after a while the players who are present can vote to play for them, and the game carries on. An absent player simply doesn’t react in a Nope window: it closes when time runs out.",
      ),
      es: p(
        "El juego baraja, reparte y aplica las reglas: él mismo saca la carta que se toma con una pareja y mantiene en secreto el orden del mazo. Solo ves tu propia mano; de las demás, solo el número de cartas.",
        "Todos ven el tamaño del mazo y el descarte, que se puede consultar. Solo los jugadores implicados ven la carta dada por un Favor o tomada con una pareja; solo quien juega Ver el futuro ve las 3 cartas, y solo quien devuelve un gatito sabe dónde lo ha metido. El trío y las cinco distintas se juegan a la vista de todos.",
        "El anfitrión elige las opciones antes de empezar la partida: la duración de la ventana de Nope y si la combinación Cinco distintas está en juego.",
        "Si un jugador deja de jugar, pasado un tiempo los jugadores presentes pueden votar para jugar en su lugar, y la partida continúa. Un jugador ausente simplemente no reacciona en una ventana de Nope: se cierra cuando se acaba el tiempo.",
      ),
      de: p(
        "Das Spiel mischt, teilt aus und wendet die Regeln an: Es zieht selbst die Karte, die ein Pärchen nimmt, und hält die Reihenfolge des Spielstapels geheim. Du siehst nur deine eigene Hand, von den anderen nur die Zahl der Karten.",
        "Alle sehen die Größe des Spielstapels und den Ablagestapel, den man durchsehen kann. Nur die beteiligten Personen sehen die Karte, die für einen Wunsch gegeben oder mit einem Pärchen genommen wird; nur wer Blick in die Zukunft spielt, sieht die 3 Karten, und nur wer ein Kätzchen zurücksteckt, weiß, wohin. Drilling und Fünfling werden offen gespielt.",
        "Der Gastgeber wählt vor dem Start die Optionen: die Dauer des Nö-Fensters und ob die Kombination Fünfling gilt.",
        "Hört eine Person auf zu spielen, können die anwesenden Personen nach einer Weile abstimmen, an ihrer Stelle zu spielen, und das Spiel geht weiter. Eine abwesende Person reagiert im Nö-Fenster einfach nicht: Es schließt sich, wenn die Zeit abgelaufen ist.",
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
