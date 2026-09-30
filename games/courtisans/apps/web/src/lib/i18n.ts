import type { Family, Role } from "@courtisans/engine"
import type { GameI18n } from "@pbgo/core/lib/skin"
import type { Locale } from "@pbgo/core/lib/i18n"

type Status = "light" | "disgrace" | "neutral"
type Verbs = { play: string; eliminate: string; draw: (n: number) => string }

/** Textes de Courtisans qui ne passent pas par Sanity : interface du plateau, règles (habillage), missions par défaut, familles, rôles. */
export type GameDict = {
  courtier: string
  status: Record<Status, string>
  families: Record<Family, { name: string; plural: string; pluralDef: string }>
  roles: Record<Role, { name: string; plural: string }>
  zone: { table: string; mine: string; own: string; other: [string, string] }
  you: Verbs
  they: Verbs
  gameOverLog: string
  missionsSucceeded: string
  missionsButton: string
  banquetStart: string
  rules: {
    title: string
    subtitle: string
    videoFrame: string
    perFamily: string
    sixFamilies: string
    twoMissions: string
    matAndDraw: string
    yourHand: string
    yourMissions: string
    queenTable: string
    aroundMat: string
    yourDomain: string
    inFrontOfYou: string
    opponentDomain: string
    opponentSubtitle: string
    endOfTurn: string
    spiesRevealed: string
    familyStatus: string
    points: string
  }
  missions: { lessThan: (plural: string) => string; atLeast: (n: number, roles: string) => string; disgrace: (pluralDef: string) => string; queens: [string, string, string, string] }
}

const s = (n: number, one: string, many: string) => (n > 1 ? many : one)

export const GAME: Record<Locale, GameDict> = {
  fr: {
    courtier: "Courtisan",
    status: { light: "dans la lumière", disgrace: "en disgrâce", neutral: "neutre" },
    families: {
      butterfly: { name: "Papillon", plural: "papillons", pluralDef: "Les papillons" },
      toad: { name: "Crapaud", plural: "crapauds", pluralDef: "Les crapauds" },
      nightingale: { name: "Rossignol", plural: "rossignols", pluralDef: "Les rossignols" },
      hare: { name: "Lièvre", plural: "lièvres", pluralDef: "Les lièvres" },
      stag: { name: "Cerf", plural: "cerfs", pluralDef: "Les cerfs" },
      carp: { name: "Carpe", plural: "carpes", pluralDef: "Les carpes" },
    },
    roles: { noble: { name: "Noble", plural: "nobles" }, spy: { name: "Espion", plural: "espions" }, assassin: { name: "Assassin", plural: "assassins" }, guard: { name: "Garde", plural: "gardes" } },
    zone: { table: "à la table de la Reine", mine: "chez vous", own: "chez lui", other: ["chez ", ""] },
    you: { play: "Vous jouez", eliminate: "Vous éliminez", draw: (n) => `Vous piochez ${n} ${s(n, "carte", "cartes")}` },
    they: { play: "joue", eliminate: "élimine", draw: (n) => `pioche ${n} ${s(n, "carte", "cartes")}` },
    gameOverLog: "La pioche est vide : fin de la partie !",
    missionsSucceeded: "Missions réussies",
    missionsButton: "Missions comprises",
    banquetStart: "Le banquet peut commencer !",
    rules: {
      title: "Règles du jeu",
      subtitle: "2 à 5 joueurs · 30 minutes",
      videoFrame: "Courtisans – règles en vidéo",
      perFamily: "par famille",
      sixFamilies: "Six familles",
      twoMissions: "Deux missions secrètes",
      matAndDraw: "Le tapis et la pioche",
      yourHand: "Votre main",
      yourMissions: "Vos missions",
      queenTable: "À la table de la reine",
      aroundMat: "autour du tapis",
      yourDomain: "Dans votre domaine",
      inFrontOfYou: "devant vous",
      opponentDomain: "Dans un domaine adverse",
      opponentSubtitle: "devant l'adversaire de votre choix",
      endOfTurn: "Fin du tour",
      spiesRevealed: "Les espions sont révélés",
      familyStatus: "Le statut des familles",
      points: "Les points",
    },
    missions: {
      lessThan: (p) => `Vous devez posséder moins de ${p} que votre voisin de gauche.`,
      atLeast: (n, r) => `Vous devez posséder au moins ${n} ${r}.`,
      disgrace: (p) => `${p} doivent être en disgrâce à la cour.`,
      queens: ["Au moins 2 familles doivent être en disgrâce à la cour.", "Au moins 2 familles doivent être dans la lumière.", "Au moins 3 familles doivent être en disgrâce à la cour.", "Au moins 1 famille doit être neutre."],
    },
  },
  en: {
    courtier: "Courtier",
    status: { light: "in the light", disgrace: "in disgrace", neutral: "neutral" },
    families: {
      butterfly: { name: "Butterfly", plural: "butterflies", pluralDef: "The butterflies" },
      toad: { name: "Toad", plural: "toads", pluralDef: "The toads" },
      nightingale: { name: "Nightingale", plural: "nightingales", pluralDef: "The nightingales" },
      hare: { name: "Hare", plural: "hares", pluralDef: "The hares" },
      stag: { name: "Stag", plural: "stags", pluralDef: "The stags" },
      carp: { name: "Carp", plural: "carp", pluralDef: "The carp" },
    },
    roles: { noble: { name: "Noble", plural: "nobles" }, spy: { name: "Spy", plural: "spies" }, assassin: { name: "Assassin", plural: "assassins" }, guard: { name: "Guard", plural: "guards" } },
    zone: { table: "at the Queen's table", mine: "in your domain", own: "in their domain", other: ["in ", "'s domain"] },
    you: { play: "You play", eliminate: "You eliminate", draw: (n) => `You draw ${n} ${s(n, "card", "cards")}` },
    they: { play: "plays", eliminate: "eliminates", draw: (n) => `draws ${n} ${s(n, "card", "cards")}` },
    gameOverLog: "The draw pile is empty: the game is over!",
    missionsSucceeded: "Missions completed",
    missionsButton: "Missions understood",
    banquetStart: "Let the banquet begin!",
    rules: {
      title: "Game rules",
      subtitle: "2 to 5 players · 30 minutes",
      videoFrame: "Courtisans – rules video",
      perFamily: "per family",
      sixFamilies: "Six families",
      twoMissions: "Two secret missions",
      matAndDraw: "The mat and the draw pile",
      yourHand: "Your hand",
      yourMissions: "Your missions",
      queenTable: "At the Queen's table",
      aroundMat: "around the mat",
      yourDomain: "In your domain",
      inFrontOfYou: "in front of you",
      opponentDomain: "In an opponent's domain",
      opponentSubtitle: "in front of the opponent of your choice",
      endOfTurn: "End of the turn",
      spiesRevealed: "Spies are revealed",
      familyStatus: "Family status",
      points: "Points",
    },
    missions: {
      lessThan: (p) => `You must own fewer ${p} than your left-hand neighbor.`,
      atLeast: (n, r) => `You must own at least ${n} ${r}.`,
      disgrace: (p) => `${p} must be in disgrace at court.`,
      queens: ["At least 2 families must be in disgrace at court.", "At least 2 families must be in the light.", "At least 3 families must be in disgrace at court.", "At least 1 family must be neutral."],
    },
  },
  es: {
    courtier: "Cortesano",
    status: { light: "en la luz", disgrace: "en desgracia", neutral: "neutral" },
    families: {
      butterfly: { name: "Mariposa", plural: "mariposas", pluralDef: "Las mariposas" },
      toad: { name: "Sapo", plural: "sapos", pluralDef: "Los sapos" },
      nightingale: { name: "Ruiseñor", plural: "ruiseñores", pluralDef: "Los ruiseñores" },
      hare: { name: "Liebre", plural: "liebres", pluralDef: "Las liebres" },
      stag: { name: "Ciervo", plural: "ciervos", pluralDef: "Los ciervos" },
      carp: { name: "Carpa", plural: "carpas", pluralDef: "Las carpas" },
    },
    roles: { noble: { name: "Noble", plural: "nobles" }, spy: { name: "Espía", plural: "espías" }, assassin: { name: "Asesino", plural: "asesinos" }, guard: { name: "Guardia", plural: "guardias" } },
    zone: { table: "en la mesa de la Reina", mine: "en tu dominio", own: "en su dominio", other: ["en el dominio de ", ""] },
    you: { play: "Juegas", eliminate: "Eliminas", draw: (n) => `Robas ${n} ${s(n, "carta", "cartas")}` },
    they: { play: "juega", eliminate: "elimina", draw: (n) => `roba ${n} ${s(n, "carta", "cartas")}` },
    gameOverLog: "El mazo está vacío: ¡fin de la partida!",
    missionsSucceeded: "Misiones cumplidas",
    missionsButton: "Misiones entendidas",
    banquetStart: "¡Que comience el banquete!",
    rules: {
      title: "Reglas del juego",
      subtitle: "De 2 a 5 jugadores · 30 minutos",
      videoFrame: "Courtisans – reglas en vídeo",
      perFamily: "por familia",
      sixFamilies: "Seis familias",
      twoMissions: "Dos misiones secretas",
      matAndDraw: "El tapete y el mazo",
      yourHand: "Tu mano",
      yourMissions: "Tus misiones",
      queenTable: "En la mesa de la reina",
      aroundMat: "alrededor del tapete",
      yourDomain: "En tu dominio",
      inFrontOfYou: "delante de ti",
      opponentDomain: "En el dominio de un rival",
      opponentSubtitle: "delante del rival que elijas",
      endOfTurn: "Fin del turno",
      spiesRevealed: "Se revelan los espías",
      familyStatus: "El estado de las familias",
      points: "Los puntos",
    },
    missions: {
      lessThan: (p) => `Debes poseer menos ${p} que tu vecino de la izquierda.`,
      atLeast: (n, r) => `Debes poseer al menos ${n} ${r}.`,
      disgrace: (p) => `${p} deben estar en desgracia en la corte.`,
      queens: ["Al menos 2 familias deben estar en desgracia en la corte.", "Al menos 2 familias deben estar en la luz.", "Al menos 3 familias deben estar en desgracia en la corte.", "Al menos 1 familia debe ser neutral."],
    },
  },
  de: {
    courtier: "Höfling",
    status: { light: "im Licht", disgrace: "in Ungnade", neutral: "neutral" },
    families: {
      butterfly: { name: "Schmetterling", plural: "Schmetterlinge", pluralDef: "Die Schmetterlinge" },
      toad: { name: "Kröte", plural: "Kröten", pluralDef: "Die Kröten" },
      nightingale: { name: "Nachtigall", plural: "Nachtigallen", pluralDef: "Die Nachtigallen" },
      hare: { name: "Hase", plural: "Hasen", pluralDef: "Die Hasen" },
      stag: { name: "Hirsch", plural: "Hirsche", pluralDef: "Die Hirsche" },
      carp: { name: "Karpfen", plural: "Karpfen", pluralDef: "Die Karpfen" },
    },
    roles: { noble: { name: "Adliger", plural: "Adlige" }, spy: { name: "Spion", plural: "Spione" }, assassin: { name: "Attentäter", plural: "Attentäter" }, guard: { name: "Wache", plural: "Wachen" } },
    zone: { table: "an der Tafel der Königin", mine: "in deinem Herrschaftsbereich", own: "in seinem Herrschaftsbereich", other: ["im Herrschaftsbereich von ", ""] },
    you: { play: "Du spielst", eliminate: "Du eliminierst", draw: (n) => `Du ziehst ${n} ${s(n, "Karte", "Karten")}` },
    they: { play: "spielt", eliminate: "eliminiert", draw: (n) => `zieht ${n} ${s(n, "Karte", "Karten")}` },
    gameOverLog: "Der Nachziehstapel ist leer: Ende der Partie!",
    missionsSucceeded: "Erfüllte Missionen",
    missionsButton: "Missionen verstanden",
    banquetStart: "Das Bankett kann beginnen!",
    rules: {
      title: "Spielregeln",
      subtitle: "2 bis 5 Spieler · 30 Minuten",
      videoFrame: "Courtisans – Regeln als Video",
      perFamily: "pro Familie",
      sixFamilies: "Sechs Familien",
      twoMissions: "Zwei geheime Missionen",
      matAndDraw: "Die Matte und der Nachziehstapel",
      yourHand: "Deine Hand",
      yourMissions: "Deine Missionen",
      queenTable: "An der Tafel der Königin",
      aroundMat: "rund um die Matte",
      yourDomain: "In deinem Herrschaftsbereich",
      inFrontOfYou: "vor dir",
      opponentDomain: "Im Herrschaftsbereich eines Gegners",
      opponentSubtitle: "vor dem Gegner deiner Wahl",
      endOfTurn: "Ende des Zuges",
      spiesRevealed: "Die Spione werden aufgedeckt",
      familyStatus: "Der Status der Familien",
      points: "Die Punkte",
    },
    missions: {
      lessThan: (p) => `Du musst weniger ${p} besitzen als dein linker Nachbar.`,
      atLeast: (n, r) => `Du musst mindestens ${n} ${r} besitzen.`,
      disgrace: (p) => `${p} müssen bei Hof in Ungnade sein.`,
      queens: ["Mindestens 2 Familien müssen bei Hof in Ungnade sein.", "Mindestens 2 Familien müssen im Licht stehen.", "Mindestens 3 Familien müssen bei Hof in Ungnade sein.", "Mindestens 1 Familie muss neutral sein."],
    },
  },
}

export const gameDict = (locale: Locale): GameDict => GAME[locale] ?? GAME.fr

/** Ordre des ids de missions par défaut : voir `default-missions.ts`. */
const MISSION_FAMILIES: Family[] = ["carp", "stag", "toad", "hare", "butterfly", "nightingale"]
const MISSION_ROLES: [Role, number][] = [["spy", 3], ["noble", 3], ["assassin", 2], ["guard", 4]]

/** Texte des missions par défaut (id → texte) dans une langue. */
export function defaultMissionTexts(locale: Locale): Record<string, string> {
  const d = gameDict(locale)
  return {
    ...Object.fromEntries(MISSION_FAMILIES.map((f, i) => [`mission-light-${i + 1}`, d.missions.lessThan(d.families[f].plural)])),
    ...Object.fromEntries(MISSION_ROLES.map(([r, n], i) => [`mission-light-${i + 7}`, d.missions.atLeast(n, d.roles[r].plural)])),
    ...Object.fromEntries(MISSION_FAMILIES.map((f, i) => [`mission-dark-${i + 1}`, d.missions.disgrace(d.families[f].pluralDef)])),
    ...Object.fromEntries(d.missions.queens.map((t, i) => [`mission-dark-${i + 7}`, t])),
  }
}

/** Ce que Courtisans fournit à @pbgo/core pour les langues autres que le français (`I18N` de @pbgo/binding). */
export const I18N: Partial<Record<Locale, GameI18n>> = {
  en: {
    description:
      "Play Courtisans online, for free, with your friends: 2 to 5 players, place your courtiers at the Queen's table, make families shine or fall from grace and become the court's favorite. Unofficial web adaptation of the Catch Up Games card game, no sign-up.",
    authors: "Romaric Galonnier and Anthony Perone, illustrated by Noëmie Chevalier",
    errors: {
      INVALID_PHASE: "It's not the time to play.",
      NOT_YOUR_TURN: "It's not your turn.",
      UNKNOWN_CARD: "This card is no longer in your hand.",
      ZONE_ALREADY_PLAYED: "You already played a card in this zone this turn.",
      INVALID_TARGET: "You can't play this card here.",
      INVALID_ASSASSINATION: "This card can't be eliminated.",
      INVALID_PLAYERS: "2 to 5 players are needed.",
      NOT_ENOUGH_MISSIONS: "There aren't enough missions to start the game.",
      UNKNOWN_PLAYER: "This player is not part of the banquet.",
      NOT_ENOUGH_PLAYERS: "At least 2 guests are needed to open the banquet.",
      GAME_FULL: "This banquet is full (5 guests).",
    },
    skin: {
      home: {
        title: "Welcome to the Queen's banquet!",
        intro:
          "Tonight is the Queen's banquet. A major event where the kingdom's families want to show themselves at their best. Scheming is in full swing and no move is off limits to put your favorite in the spotlight.",
        tagline: "The Queen's banquet, online with friends",
      },
      victoryPhrases: [
        "The one who truly knows how to court is, of course: {pseudo} ({points} pts)",
        "The Queen has eyes only for {pseudo} ({points} pts)",
        "The whole court bows before {pseudo} ({points} pts)",
      ],
      texts: {
        nicknamePlaceholder: "YOUR NAME…",
        createButton: "Court at the banquet",
        joinButton: "Court at the banquet",
        chooseNickname: "Pick your name first.",
        linkCopied: "Banquet link copied!",
        codeLabel: "Banquet code",
        copyLink: "Copy the banquet link",
        joinGameButton: "Join the banquet",
        gameNotFound: "This banquet can't be found. Check the code {code} or host a new one.",
        alreadyStarted: "This banquet has already started.",
        shareInvite: "Share the banquet code or link with your guests.",
        startButton: "Open the banquet",
        waitingPlayers: "Waiting for guests…",
        waiting: "The guests are taking their seats…",
        gameOver: "End of the banquet",
        leave: "Leave the game",
        winnerTitle: "The court bows before",
      },
    },
  },
  es: {
    description:
      "Juega a Courtisans en línea, gratis, con tus amigos: de 2 a 5 jugadores, coloca a tus cortesanos en la mesa de la Reina, haz brillar o caer en desgracia a las familias y conviértete en el favorito de la corte. Adaptación web no oficial del juego de cartas de Catch Up Games, sin registro.",
    authors: "Romaric Galonnier y Anthony Perone, ilustrado por Noëmie Chevalier",
    errors: {
      INVALID_PHASE: "No es el momento de jugar.",
      NOT_YOUR_TURN: "No es tu turno.",
      UNKNOWN_CARD: "Esta carta ya no está en tu mano.",
      ZONE_ALREADY_PLAYED: "Ya has jugado una carta en esta zona este turno.",
      INVALID_TARGET: "No puedes jugar esta carta aquí.",
      INVALID_ASSASSINATION: "Esta carta no se puede eliminar.",
      INVALID_PLAYERS: "Se necesitan de 2 a 5 jugadores.",
      NOT_ENOUGH_MISSIONS: "Faltan misiones para empezar la partida.",
      UNKNOWN_PLAYER: "Este jugador no forma parte del banquete.",
      NOT_ENOUGH_PLAYERS: "Se necesitan al menos 2 invitados para abrir el banquete.",
      GAME_FULL: "Este banquete está completo (5 invitados).",
    },
    skin: {
      home: {
        title: "¡Bienvenidos al banquete de la reina!",
        intro:
          "Esta noche se celebra el banquete de la reina. Un acontecimiento de primer orden en el que las familias del reino quieren lucirse. Las maniobras están en pleno apogeo y todo vale para poner a su favorito en primer plano.",
        tagline: "El banquete de la Reina, en línea y entre amigos",
      },
      victoryPhrases: [
        "Quien sabe cortejar es, evidentemente: {pseudo} ({points} pts)",
        "La Reina solo tiene ojos para {pseudo} ({points} pts)",
        "Toda la corte se inclina ante {pseudo} ({points} pts)",
      ],
      texts: {
        nicknamePlaceholder: "TU NOMBRE…",
        createButton: "Cortejar en el banquete",
        joinButton: "Cortejar en el banquete",
        chooseNickname: "Elige primero tu nombre.",
        linkCopied: "¡Enlace del banquete copiado!",
        codeLabel: "Código del banquete",
        copyLink: "Copiar el enlace del banquete",
        joinGameButton: "Unirse al banquete",
        gameNotFound: "No se encuentra este banquete. Comprueba el código {code} u organiza uno nuevo.",
        alreadyStarted: "Este banquete ya ha comenzado.",
        shareInvite: "Comparte el código o el enlace del banquete con tus invitados.",
        startButton: "Abrir el banquete",
        waitingPlayers: "Esperando invitados…",
        waiting: "Los invitados van tomando asiento…",
        gameOver: "Fin del banquete",
        leave: "Salir de la partida",
        winnerTitle: "La corte se inclina ante",
      },
    },
  },
  de: {
    description:
      "Spiele Courtisans kostenlos online mit deinen Freunden: 2 bis 5 Spieler, platziere deine Höflinge an der Tafel der Königin, lass Familien glänzen oder in Ungnade fallen und werde der Favorit des Hofes. Inoffizielle Web-Adaption des Kartenspiels von Catch Up Games, ohne Anmeldung.",
    authors: "Romaric Galonnier und Anthony Perone, illustriert von Noëmie Chevalier",
    errors: {
      INVALID_PHASE: "Es ist nicht der richtige Moment zum Spielen.",
      NOT_YOUR_TURN: "Du bist nicht dran.",
      UNKNOWN_CARD: "Diese Karte ist nicht mehr in deiner Hand.",
      ZONE_ALREADY_PLAYED: "Du hast in dieser Runde bereits eine Karte in dieser Zone gespielt.",
      INVALID_TARGET: "Du kannst diese Karte hier nicht spielen.",
      INVALID_ASSASSINATION: "Diese Karte kann nicht eliminiert werden.",
      INVALID_PLAYERS: "Es werden 2 bis 5 Spieler benötigt.",
      NOT_ENOUGH_MISSIONS: "Es fehlen Missionen, um die Partie zu starten.",
      UNKNOWN_PLAYER: "Dieser Spieler gehört nicht zum Bankett.",
      NOT_ENOUGH_PLAYERS: "Es werden mindestens 2 Gäste benötigt, um das Bankett zu eröffnen.",
      GAME_FULL: "Dieses Bankett ist voll (5 Gäste).",
    },
    skin: {
      home: {
        title: "Willkommen beim Bankett der Königin!",
        intro:
          "Heute Abend findet das Bankett der Königin statt. Ein bedeutendes Ereignis, bei dem die Familien des Königreichs sich von ihrer besten Seite zeigen wollen. Die Ränke sind in vollem Gange, und alle Mittel sind erlaubt, um den eigenen Favoriten ins Rampenlicht zu rücken.",
        tagline: "Das Bankett der Königin, online und unter Freunden",
      },
      victoryPhrases: [
        "Wer zu hofieren weiß, ist natürlich: {pseudo} ({points} Pkt.)",
        "Die Königin hat nur Augen für {pseudo} ({points} Pkt.)",
        "Der ganze Hof verneigt sich vor {pseudo} ({points} Pkt.)",
      ],
      texts: {
        nicknamePlaceholder: "DEIN NAME…",
        createButton: "Am Bankett hofieren",
        joinButton: "Am Bankett hofieren",
        chooseNickname: "Wähle zuerst deinen Namen.",
        linkCopied: "Bankettlink kopiert!",
        codeLabel: "Bankettcode",
        copyLink: "Bankettlink kopieren",
        joinGameButton: "Dem Bankett beitreten",
        gameNotFound: "Dieses Bankett wurde nicht gefunden. Prüfe den Code {code} oder richte ein neues aus.",
        alreadyStarted: "Dieses Bankett hat bereits begonnen.",
        shareInvite: "Teile den Bankettcode oder den Link mit deinen Gästen.",
        startButton: "Bankett eröffnen",
        waitingPlayers: "Warten auf Gäste…",
        waiting: "Die Gäste nehmen Platz…",
        gameOver: "Ende des Banketts",
        leave: "Partie verlassen",
        winnerTitle: "Der Hof verneigt sich vor",
      },
    },
  },
}
