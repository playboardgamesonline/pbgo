import { LANGUAGE_IDS, localeString, localeText } from "@pbgo/content-kit"
import type { LanguageId, Localized, SeedDoc } from "@pbgo/content-kit"

export const TEXTS_ID = "texts"

// The source texts of the `texts` singleton: what the game said when its texts were still in the code, written into Sanity as drafts. The game keeps no copy of them.
const TAGLINE: Localized = {
  fr: "Le banquet de la Reine, en ligne et entre amis",
  en: "The Queen's banquet, online with friends",
  es: "El banquete de la Reina, en línea y entre amigos",
  de: "Das Bankett der Königin, online und unter Freunden",
}

const HOME_TITLE: Localized = {
  fr: "Bienvenue au banquet de la reine !",
  en: "Welcome to the Queen's banquet!",
  es: "¡Bienvenidos al banquete de la reina!",
  de: "Willkommen beim Bankett der Königin!",
}

const HOME_INTRO: Localized = {
  fr: "Ce soir a lieu le banquet de la reine. Un évènement majeur où les familles du royaume veulent se montrer à leur avantage. Les manœuvres vont bon train et tous les coups sont permis pour placer son favori sur le devant de la scène.",
  en: "Tonight is the Queen's banquet. A major event where the kingdom's families want to show themselves at their best. Scheming is in full swing and no move is off limits to put your favorite in the spotlight.",
  es: "Esta noche se celebra el banquete de la reina. Un acontecimiento de primer orden en el que las familias del reino quieren lucirse. Las maniobras están en pleno apogeo y todo vale para poner a su favorito en primer plano.",
  de: "Heute Abend findet das Bankett der Königin statt. Ein bedeutendes Ereignis, bei dem die Familien des Königreichs sich von ihrer besten Seite zeigen wollen. Die Ränke sind in vollem Gange, und alle Mittel sind erlaubt, um den eigenen Favoriten ins Rampenlicht zu rücken.",
}

const VICTORY_PHRASES: Record<LanguageId, string[]> = {
  fr: [
    "L'homme qui sait courtiser est évidemment : {pseudo} ({points} pts)",
    "La Reine n'a d'yeux que pour {pseudo} ({points} pts)",
    "Toute la cour s'incline devant {pseudo} ({points} pts)",
  ],
  en: [
    "The one who truly knows how to court is, of course: {pseudo} ({points} pts)",
    "The Queen has eyes only for {pseudo} ({points} pts)",
    "The whole court bows before {pseudo} ({points} pts)",
  ],
  es: [
    "Quien sabe cortejar es, evidentemente: {pseudo} ({points} pts)",
    "La Reina solo tiene ojos para {pseudo} ({points} pts)",
    "Toda la corte se inclina ante {pseudo} ({points} pts)",
  ],
  de: [
    "Wer zu hofieren weiß, ist natürlich: {pseudo} ({points} Pkt.)",
    "Die Königin hat nur Augen für {pseudo} ({points} Pkt.)",
    "Der ganze Hof verneigt sich vor {pseudo} ({points} Pkt.)",
  ],
}

const MISSIONS_BUTTON: Localized = { fr: "Missions comprises", en: "Missions understood", es: "Misiones entendidas", de: "Missionen verstanden" }

const BANQUET_STARTS: Localized = {
  fr: "Le banquet peut commencer !",
  en: "Let the banquet begin!",
  es: "¡Que comience el banquete!",
  de: "Das Bankett kann beginnen!",
}

// Search engines: the sentence of the home page's hidden heading, after the site title, and the genres of its structured data.
const HOME_HEADING: Localized = {
  fr: "Bienvenue au banquet de la Reine : jouez à Courtisans en ligne avec vos amis",
  en: "Welcome to the Queen's banquet: play Courtisans online with your friends",
  es: "Bienvenido al banquete de la Reina: juega a Courtisans en línea con tus amigos",
  de: "Willkommen beim Bankett der Königin: Spiele Courtisans online mit deinen Freunden",
}

const GENRES: Record<LanguageId, string[]> = {
  fr: ["Jeu de cartes", "Jeu de société", "Jeu de bluff"],
  en: ["Card game", "Board game", "Bluffing game"],
  es: ["Juego de cartas", "Juego de mesa", "Juego de faroles"],
  de: ["Kartenspiel", "Gesellschaftsspiel", "Bluffspiel"],
}

// The vocabulary of the board: the zones, the log lines, the buttons under the board and the score detail. `{name}` is the owner of a domain and `{count}` a
// number of cards (the singular is for one card or none).
const BOARD: Record<string, Localized> = {
  courtier: { fr: "Courtisan", en: "Courtier", es: "Cortesano", de: "Höfling" },
  zoneTable: { fr: "à la table de la Reine", en: "at the Queen's table", es: "en la mesa de la Reina", de: "an der Tafel der Königin" },
  zoneYours: { fr: "chez vous", en: "in your domain", es: "en tu dominio", de: "in deinem Herrschaftsbereich" },
  zoneTheirs: { fr: "chez lui", en: "in their domain", es: "en su dominio", de: "in seinem Herrschaftsbereich" },
  zoneOther: { fr: "chez {name}", en: "in {name}'s domain", es: "en el dominio de {name}", de: "im Herrschaftsbereich von {name}" },
  youPlay: { fr: "Vous jouez", en: "You play", es: "Juegas", de: "Du spielst" },
  youEliminate: { fr: "Vous éliminez", en: "You eliminate", es: "Eliminas", de: "Du eliminierst" },
  youDrawOne: { fr: "Vous piochez {count} carte", en: "You draw {count} card", es: "Robas {count} carta", de: "Du ziehst {count} Karte" },
  youDrawMany: { fr: "Vous piochez {count} cartes", en: "You draw {count} cards", es: "Robas {count} cartas", de: "Du ziehst {count} Karten" },
  theyPlay: { fr: "joue", en: "plays", es: "juega", de: "spielt" },
  theyEliminate: { fr: "élimine", en: "eliminates", es: "elimina", de: "eliminiert" },
  theyDrawOne: { fr: "pioche {count} carte", en: "draws {count} card", es: "roba {count} carta", de: "zieht {count} Karte" },
  theyDrawMany: { fr: "pioche {count} cartes", en: "draws {count} cards", es: "roba {count} cartas", de: "zieht {count} Karten" },
  gameOverLog: {
    fr: "La pioche est vide : fin de la partie !",
    en: "The draw pile is empty: the game is over!",
    es: "El mazo está vacío: ¡fin de la partida!",
    de: "Der Nachziehstapel ist leer: Ende der Partie!",
  },
  missionsSucceeded: { fr: "Missions réussies", en: "Missions completed", es: "Misiones cumplidas", de: "Erfüllte Missionen" },
  noAssassination: { fr: "Ne pas assassiner", en: "Don't assassinate", es: "No asesinar", de: "Niemanden eliminieren" },
  skip: { fr: "Passer", en: "Skip", es: "Saltar", de: "Überspringen" },
}

// The wordings of a status that a mission text may use: each one is highlighted in the text of a mission, whatever the language of that text.
const STATUS_LIGHT: Record<LanguageId, string[]> = {
  fr: ["dans la lumière", "en lumière"],
  en: ["in the light", "esteemed"],
  es: ["en la luz"],
  de: ["im Licht"],
}

const STATUS_DISGRACE: Record<LanguageId, string[]> = {
  fr: ["en disgrâce"],
  en: ["in disgrace", "fallen from grace"],
  es: ["en desgracia"],
  de: ["in Ungnade"],
}

// The interface labels, by the group of the `texts` form that holds them (`UI_TEXTS` of `@pbgo/studio-kit/constants` names the group of each key).
const HOME: Record<string, Localized> = {
  nicknamePlaceholder: { fr: "VÔTRE PRÉNOMMÉE…", en: "YOUR NAME…", es: "TU NOMBRE…", de: "DEIN NAME…" },
  createButton: {
    fr: "Courtiser au banquet",
    en: "Court at the banquet",
    es: "Cortejar en el banquete",
    de: "Am Bankett hofieren",
  },
  joinButton: {
    fr: "Courtiser au banquet",
    en: "Court at the banquet",
    es: "Cortejar en el banquete",
    de: "Am Bankett hofieren",
  },
  chooseNickname: {
    fr: "Choisissez d'abord votre appellation.",
    en: "Pick your name first.",
    es: "Elige primero tu nombre.",
    de: "Wähle zuerst deinen Namen.",
  },
  linkCopied: {
    fr: "Lien du banquet copié !",
    en: "Banquet link copied!",
    es: "¡Enlace del banquete copiado!",
    de: "Bankettlink kopiert!",
  },
  codeLabel: { fr: "Code du banquet", en: "Banquet code", es: "Código del banquete", de: "Bankettcode" },
  copyLink: {
    fr: "Copier le lien du banquet",
    en: "Copy the banquet link",
    es: "Copiar el enlace del banquete",
    de: "Bankettlink kopieren",
  },
}

const LOBBY: Record<string, Localized> = {
  joinGameButton: { fr: "Rejoindre le banquet", en: "Join the banquet", es: "Unirse al banquete", de: "Dem Bankett beitreten" },
  gameNotFound: {
    fr: "Ce banquet est introuvable. Vérifiez le code {code} ou organisez-en un nouveau.",
    en: "This banquet can't be found. Check the code {code} or host a new one.",
    es: "No se encuentra este banquete. Comprueba el código {code} u organiza uno nuevo.",
    de: "Dieses Bankett wurde nicht gefunden. Prüfe den Code {code} oder richte ein neues aus.",
  },
  alreadyStarted: {
    fr: "Ce banquet a déjà commencé.",
    en: "This banquet has already started.",
    es: "Este banquete ya ha comenzado.",
    de: "Dieses Bankett hat bereits begonnen.",
  },
  shareInvite: {
    fr: "Partagez le code ou le lien du banquet à vos convives.",
    en: "Share the banquet code or link with your guests.",
    es: "Comparte el código o el enlace del banquete con tus invitados.",
    de: "Teile den Bankettcode oder den Link mit deinen Gästen.",
  },
  startButton: { fr: "Ouvrir le banquet", en: "Open the banquet", es: "Abrir el banquete", de: "Bankett eröffnen" },
  waitingPlayers: {
    fr: "En attente de convives…",
    en: "Waiting for guests…",
    es: "Esperando invitados…",
    de: "Warten auf Gäste…",
  },
}

const GAME: Record<string, Localized> = {
  waiting: {
    fr: "Les convives s'installent…",
    en: "The guests are taking their seats…",
    es: "Los invitados van tomando asiento…",
    de: "Die Gäste nehmen Platz…",
  },
  gameOver: { fr: "Fin du banquet", en: "End of the banquet", es: "Fin del banquete", de: "Ende des Banketts" },
  leave: { fr: "Quitter la partie", en: "Leave the game", es: "Salir de la partida", de: "Partie verlassen" },
  winnerTitle: {
    fr: "La cour s'incline devant",
    en: "The court bows before",
    es: "La corte se inclina ante",
    de: "Der Hof verneigt sich vor",
  },
}

// Error code → message: what the player reads when the engine throws one of the codes of `ERROR_CODES` (`src/lib/site.ts`).
const ERRORS: Record<string, Localized> = {
  INVALID_PHASE: {
    fr: "Ce n'est pas le moment de jouer.",
    en: "It's not the time to play.",
    es: "No es el momento de jugar.",
    de: "Es ist nicht der richtige Moment zum Spielen.",
  },
  NOT_YOUR_TURN: {
    fr: "Ce n'est pas votre tour.",
    en: "It's not your turn.",
    es: "No es tu turno.",
    de: "Du bist nicht dran.",
  },
  UNKNOWN_CARD: {
    fr: "Cette carte n'est plus dans votre main.",
    en: "This card is no longer in your hand.",
    es: "Esta carta ya no está en tu mano.",
    de: "Diese Karte ist nicht mehr in deiner Hand.",
  },
  ZONE_ALREADY_PLAYED: {
    fr: "Vous avez déjà joué une carte dans cette zone ce tour-ci.",
    en: "You already played a card in this zone this turn.",
    es: "Ya has jugado una carta en esta zona este turno.",
    de: "Du hast in dieser Runde bereits eine Karte in dieser Zone gespielt.",
  },
  INVALID_TARGET: {
    fr: "Vous ne pouvez pas jouer cette carte ici.",
    en: "You can't play this card here.",
    es: "No puedes jugar esta carta aquí.",
    de: "Du kannst diese Karte hier nicht spielen.",
  },
  INVALID_ASSASSINATION: {
    fr: "Cette carte ne peut pas être éliminée.",
    en: "This card can't be eliminated.",
    es: "Esta carta no se puede eliminar.",
    de: "Diese Karte kann nicht eliminiert werden.",
  },
  INVALID_PLAYERS: {
    fr: "Il faut de 2 à 5 joueurs.",
    en: "2 to 5 players are needed.",
    es: "Se necesitan de 2 a 5 jugadores.",
    de: "Es werden 2 bis 5 Spieler benötigt.",
  },
  NOT_ENOUGH_MISSIONS: {
    fr: "Il manque des missions pour lancer la partie.",
    en: "There aren't enough missions to start the game.",
    es: "Faltan misiones para empezar la partida.",
    de: "Es fehlen Missionen, um die Partie zu starten.",
  },
  UNKNOWN_PLAYER: {
    fr: "Ce joueur ne fait pas partie du banquet.",
    en: "This player is not part of the banquet.",
    es: "Este jugador no forma parte del banquete.",
    de: "Dieser Spieler gehört nicht zum Bankett.",
  },
  NOT_READY: {
    fr: "Validez d'abord vos missions.",
    en: "Confirm your missions first.",
    es: "Confirma primero tus misiones.",
    de: "Bestätige zuerst deine Missionen.",
  },
  NOT_ENOUGH_PLAYERS: {
    fr: "Il faut au moins 2 convives pour ouvrir le banquet.",
    en: "At least 2 guests are needed to open the banquet.",
    es: "Se necesitan al menos 2 invitados para abrir el banquete.",
    de: "Es werden mindestens 2 Gäste benötigt, um das Bankett zu eröffnen.",
  },
  GAME_FULL: {
    fr: "Ce banquet est complet (5 convives).",
    en: "This banquet is full (5 guests).",
    es: "Este banquete está completo (5 invitados).",
    de: "Dieses Bankett ist voll (5 Gäste).",
  },
}

const labels = (table: Record<string, Localized>) => Object.fromEntries(Object.entries(table).map(([key, value]) => [key, localeString(value)]))

// The kit has no helper for a list of wordings: one array per language, copied so that no build shares an array with the next.
const list = (table: Record<LanguageId, string[]>) => ({ _type: "localeStringList", ...Object.fromEntries(LANGUAGE_IDS.map((id) => [id, [...table[id]]])) })

/**
 * The `texts` singleton: the home and victory texts, the interface labels, the error messages, the two buttons of the opening, the texts
 * search engines read (hidden heading, genres) and the vocabulary of the board (the words, the zones, the log lines, the wordings of a status).
 * The document already exists in the Studio, so a run adds the languages that are missing and keeps what was typed there.
 */
export function buildTexts(): SeedDoc {
  return {
    _id: TEXTS_ID,
    _type: "texts",
    tagline: localeString(TAGLINE),
    homeTitle: localeString(HOME_TITLE),
    homeIntro: localeText(HOME_INTRO),
    victoryPhrases: list(VICTORY_PHRASES),
    ui_home: labels(HOME),
    ui_lobby: labels(LOBBY),
    ui_game: labels(GAME),
    // The shape the gamemaster's Copy tab writes: the code is the `_key` of the item.
    errorMessages: Object.entries(ERRORS).map(([code, message]) => ({ _key: code, _type: "errorMessage", code, message: localeString(message) })),
    missionsButton: localeString(MISSIONS_BUTTON),
    banquetStarts: localeString(BANQUET_STARTS),
    homeHeading: localeString(HOME_HEADING),
    genres: list(GENRES),
    ...labels(BOARD),
    statusLight: list(STATUS_LIGHT),
    statusDisgrace: list(STATUS_DISGRACE),
  }
}
