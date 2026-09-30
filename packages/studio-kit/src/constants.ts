export const LANGUAGES = [
  { id: "fr", title: "Français" },
  { id: "en", title: "English" },
] as const

// Keep in sync with FONT_CHOICES in apps/web/src/lib/settings.ts
export const FONT_CHOICES = [
  "Inter",
  "Nunito",
  "Fredoka",
  "Baloo 2",
  "Poppins",
  "Outfit",
  "DM Sans",
  "Montserrat",
  "Space Grotesk",
  "Lilita One",
  "Bangers",
  "Bebas Neue",
  "Cinzel",
  "Playfair Display",
  "Alegreya",
  "Press Start 2P",
] as const

/**
 * Libellés d'interface communs à tous les jeux, modifiables dans Sanity (document « Texts », onglet « Interface »).
 * `fr` = valeur par défaut. Variables entre accolades : {code}, {name}, {count}, {max}.
 */
export const UI_TEXTS = [
  // Accueil
  { key: "nicknamePlaceholder", group: "home", title: "Nickname placeholder", fr: "VOTRE PSEUDO…" },
  { key: "createButton", group: "home", title: "Create button", fr: "Créer une partie" },
  { key: "joinButton", group: "home", title: "Join button (code typed)", fr: "Rejoindre la partie" },
  { key: "chooseNickname", group: "home", title: "Error: no nickname", fr: "Choisissez d'abord votre pseudo." },
  { key: "codeLength", group: "home", title: "Error: code length", fr: "Le code de partie fait 6 caractères." },
  { key: "linkCopied", group: "home", title: "Toast: link copied", fr: "Lien de la partie copié !" },
  { key: "linkCopiedHint", group: "home", title: "Toast: link copied (detail)", fr: "Envoyez-le à vos amis pour qu'ils vous rejoignent." },
  { key: "gameCreated", group: "home", title: "Toast: game created", fr: "Partie {code} créée !" },
  { key: "codeLabel", group: "home", title: "Code field label", fr: "Code de la partie" },
  { key: "copyLink", group: "home", title: "Copy link button", fr: "Copier le lien de la partie" },
  { key: "feedbackButton", group: "home", title: "Feedback: button", fr: "Donner votre avis" },
  { key: "feedbackTitle", group: "home", title: "Feedback: title", fr: "Un avis, un bug ?" },
  { key: "feedbackPlaceholder", group: "home", title: "Feedback: placeholder", fr: "Ce qui vous plaît, ce qui coince, une idée…" },
  { key: "feedbackSend", group: "home", title: "Feedback: send button", fr: "Envoyer" },
  { key: "feedbackThanks", group: "home", title: "Feedback: thanks", fr: "Merci, votre message est bien arrivé !" },
  // Invitation et lobby
  { key: "joinGameButton", group: "lobby", title: "Join button (invitation)", fr: "Rejoindre la partie" },
  { key: "gameNotFound", group: "lobby", title: "Game not found", fr: "Cette partie est introuvable. Vérifiez le code {code} ou créez-en une nouvelle." },
  { key: "alreadyStarted", group: "lobby", title: "Game already started", fr: "Cette partie a déjà commencé." },
  { key: "backHome", group: "lobby", title: "Back home button", fr: "Retour à l'accueil" },
  { key: "shareInvite", group: "lobby", title: "Lobby: share invite", fr: "Partagez le code ou le lien de la partie à vos amis." },
  { key: "playerCount", group: "lobby", title: "Lobby: player count", fr: "{count}/{max} joueurs" },
  { key: "you", group: "lobby", title: "Lobby: (you)", fr: "(vous)" },
  { key: "host", group: "lobby", title: "Lobby: host label", fr: "Hôte" },
  { key: "startButton", group: "lobby", title: "Start button (host)", fr: "Lancer la partie" },
  { key: "waitingPlayers", group: "lobby", title: "Start button: not enough players", fr: "En attente de joueurs…" },
  { key: "waitingHost", group: "lobby", title: "Waiting for host", fr: "En attente de l'hôte" },
  // En partie
  { key: "yourTurn", group: "game", title: "Your turn", fr: "C'est votre tour" },
  { key: "turnOf", group: "game", title: "Turn of a player", fr: "Au tour de {name}" },
  { key: "yourTurnShort", group: "game", title: "History: your turn", fr: "Votre tour" },
  { key: "turnOfShort", group: "game", title: "History: turn of a player", fr: "Tour de {name}" },
  { key: "waiting", group: "game", title: "Waiting (no active player)", fr: "La partie se prépare…" },
  { key: "gameOver", group: "game", title: "Game over (ticker)", fr: "Fin de la partie" },
  { key: "leave", group: "game", title: "Leave button", fr: "Quitter" },
  { key: "takeoverPrompt", group: "game", title: "Absent player: prompt", fr: "{name} ne répond plus ?" },
  { key: "takeoverButton", group: "game", title: "Absent player: button", fr: "Jouer à sa place" },
  { key: "replay", group: "game", title: "Replay button", fr: "Rejouer" },
  { key: "winnerTitle", group: "game", title: "Scoreboard: above the winner", fr: "Victoire de" },
  { key: "showScores", group: "game", title: "Scoreboard: show", fr: "Afficher le tableau des scores" },
  { key: "hideScores", group: "game", title: "Scoreboard: hide", fr: "Masquer le tableau des scores" },
  { key: "shareResult", group: "game", title: "Scoreboard: share", fr: "Partager le résultat" },
  { key: "desktopOnly", group: "game", title: "Desktop only message", fr: "Ce jeu se joue sur ordinateur : agrandissez la fenêtre ou revenez depuis un écran plus large." },
] as const

export type UiTextKey = (typeof UI_TEXTS)[number]["key"]
export const UI_TEXT_GROUPS = [
  { name: "home", title: "Home" },
  { name: "lobby", title: "Invitation & lobby" },
  { name: "game", title: "In game" },
] as const
