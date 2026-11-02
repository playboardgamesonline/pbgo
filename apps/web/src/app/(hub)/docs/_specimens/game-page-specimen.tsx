// The live specimens of the blocks of a game's page, in the surfaces page of the design docs (`docs/design/03-components/04-surfaces.md`) and the controls page for the collapsible: the table card, the lobby panel, the stat tile, the leaderboard
// and the stats and the games around it. Their rows are made up and are in the shape the page's data will have (`GameTable`, `Standing`, `PlayerStats` and `HistoryEntry` of `lib/game-activity.ts`, the rows of PLT-13's schema), and they go
// through the same functions as the page's (`lib/game-activity-props.ts`) and the page's own blocks (`GamePlay`, `GameLobby`, `GameStats`, `GameLeaderboard`, `GameHistory`), so that what is drawn here is what the page will draw once it
// has data. They are never on the real page. The time is fixed (`NOW`): the docs are built once. The blocks that are laid out for a whole page (a row of the page) are drawn at the width of one (`Fit`) and scaled to this column.

import type { Specimens } from "@pbgo/docs/markdown"
import { DEMO_AVATARS } from "@pbgo/accounts/demo-avatars"
import { AchievementTile } from "@pbgo/ui/platform/achievement-tile"
import { Badge } from "@pbgo/ui/platform/badge"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@pbgo/ui/platform/collapsible"
import { GameCard } from "@pbgo/ui/platform/game-card"
import { Leaderboard } from "@pbgo/ui/platform/leaderboard"
import { LobbySettings } from "@pbgo/ui/platform/lobby-settings"
import { OpenSeat } from "@pbgo/ui/platform/open-seat"
import { ScrollRow } from "@pbgo/ui/platform/scroll-row"
import { StatTile } from "@pbgo/ui/platform/stat-tile"
import { SeatAvatar, TableCard, TableList, TableSeats } from "@pbgo/ui/platform/table-card"
import { TableEntries, TableEntry } from "@pbgo/ui/platform/table-entry"
import { UserCard } from "@pbgo/ui/platform/user-card"
import { seatsOf, type PlayerRating } from "@pbgo/ui/tables"
import { GameHead, type GameHeadProps } from "@/components/game-head"
import { GameHistory } from "@/components/game-history"
import { GameLeaderboard } from "@/components/game-leaderboard"
import { GameLobby } from "@/components/game-lobby"
import { GamePlay } from "@/components/game-play"
import { GameStats } from "@/components/game-stats"
import type { Expansion, GameTable, HistoryEntry, PlayerStats, Standing, TablePlayer, ViewerTable } from "@/lib/game-activity"
import { leaderboardRow, statFigures, tableCardProps, tableDetailProps, tableEntryProps } from "@/lib/game-activity-props"
import { ClosableDetail } from "./lobby-detail-specimen"
import { Fit } from "./scaled"
import { Frame } from "./text"

const NOW = Date.parse("2026-11-01T12:00:00Z")
const ago = (minutes: number) => new Date(NOW - minutes * 60_000).toISOString()

/** The width of a page of the hub on a desktop: the window less its two gutters of 64px, at 1440. */
const PAGE = 1312

const elo = (rating: number, wins: number, gamesPlayed: number): PlayerRating => ({ rating, wins, gamesPlayed })
const seated = (playerId: string, seat: number, name: string | null, avatarUrl: string | null = null, rating: PlayerRating | null = null): TablePlayer => ({ playerId, seat, name, avatarUrl, rating })

const MARLY = (seat: number) => seated("marly", seat, "Marly#4821", DEMO_AVATARS.marly, elo(1620, 52, 97))
const HERVE = (seat: number) => seated("herve", seat, "Hervé#0412", DEMO_AVATARS.herve, elo(1684, 41, 63))
const ZOE = (seat: number) => seated("zoe", seat, "Zoé#1033", DEMO_AVATARS.zoe, elo(1651, 38, 60))
const LINA = (seat: number) => seated("lina", seat, "Lina#2290", DEMO_AVATARS.lina, elo(1577, 19, 38))
const MAX = (seat: number) => seated("max", seat, "Max#5501", DEMO_AVATARS.max, elo(1544, 25, 52))
const INES = (seat: number) => seated("ines", seat, "Inès#3318", DEMO_AVATARS.ines, elo(1531, 14, 30))
const SAM = (seat: number) => seated("sam", seat, "Sam#9042", DEMO_AVATARS.sam, elo(1519, 12, 27))
const NOLAN = (seat: number) => seated("nolan", seat, "Nolan#7710", DEMO_AVATARS.nolan, elo(1507, 9, 22))
const TOM = (seat: number) => seated("tom", seat, "Tom", null)
const JO = (seat: number) => seated("jo", seat, "Jo#0007", DEMO_AVATARS.jade, elo(1431, 14, 24))

const table = (overrides: Partial<GameTable> & Pick<GameTable, "id" | "code" | "status" | "players">): GameTable => ({
  visibility: "public",
  hostId: overrides.players[0]?.playerId ?? null,
  seatsMax: 4,
  turnTimer: "normal",
  expansions: [],
  createdAt: ago(5),
  startedAt: null,
  ...overrides,
})

/** The tables a game's page lists: two that wait for players (the first with an expansion, the second on a clock and with two) and one that is being played. */
const TABLES: GameTable[] = [
  table({ id: "t1", code: "K7P2QX", status: "lobby", players: [MARLY(0), ZOE(1), TOM(2)], seatsMax: 5, expansions: ["first"], createdAt: ago(4) }),
  table({ id: "t2", code: "M3R9TA", status: "lobby", players: [HERVE(0), LINA(1), SAM(3)], seatsMax: 4, turnTimer: "fast", expansions: ["first", "second"], createdAt: ago(11) }),
  table({ id: "t3", code: "9QD4LZ", status: "playing", players: [MAX(0), INES(1), NOLAN(2), SAM(3)], seatsMax: 4, createdAt: ago(25), startedAt: ago(18) }),
]

/** One table of each thing a visitor may do: join, nothing left to join, and a table that is played, where there is nothing to do (nobody looks on at a game for now). */
const WAYS: GameTable[] = [
  table({ id: "w1", code: "AB12CD", status: "lobby", players: [MARLY(0)], seatsMax: 2, createdAt: ago(1) }),
  table({ id: "w2", code: "EF34GH", status: "lobby", players: [ZOE(0), TOM(1)], seatsMax: 2, createdAt: ago(7) }),
  table({ id: "w3", code: "JK56LM", status: "playing", players: [HERVE(0), LINA(1), MAX(2)], seatsMax: 3, turnTimer: "async", createdAt: ago(60 * 26), startedAt: ago(60 * 25) }),
]

/** A table of seven people at eight seats: its row stops at five pictures, the last one counting those who are left out. */
const CROWD: GameTable = table({
  id: "c1",
  code: "ZX90CV",
  status: "lobby",
  players: [MARLY(0), ZOE(1), HERVE(2), LINA(3), MAX(4), INES(5), NOLAN(6)],
  seatsMax: 8,
  turnTimer: "fast",
  expansions: ["second"],
  createdAt: ago(2),
})

/** The visitor's own table: a lobby they opened, private, with two friends at it and an expansion; a lobby a friend opened, on a clock; and a game they are playing. */
const MY_LOBBY: ViewerTable = { ...table({ id: "me1", code: "Q8W2ER", status: "lobby", visibility: "private", players: [JO(0), MARLY(1), ZOE(2)], seatsMax: 5, expansions: ["first"], createdAt: ago(3) }), viewerIsHost: true }
const FRIENDS_LOBBY: ViewerTable = { ...table({ id: "me3", code: "R6T8YU", status: "lobby", players: [MARLY(0), JO(1)], seatsMax: 4, turnTimer: "fast", expansions: ["second"], createdAt: ago(6) }), viewerIsHost: false }
const MY_GAME: ViewerTable = { ...table({ id: "me2", code: "T5Y7UI", status: "playing", visibility: "private", players: [JO(0), HERVE(1), LINA(2)], seatsMax: 3, createdAt: ago(40), startedAt: ago(26) }), viewerIsHost: true }

/** A cover for an expansion that has none of its own here: a gradient and a numeral, drawn as an SVG. */
const expansionArt = (hue: number, numeral: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 120"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue} 42% 34%)"/><stop offset="1" stop-color="hsl(${hue + 50} 48% 13%)"/></linearGradient></defs><rect width="160" height="120" fill="url(#g)"/><text x="80" y="78" text-anchor="middle" font-family="Georgia, serif" font-size="52" fill="white" fill-opacity=".82">${numeral}</text></svg>`,
  )}`

/** The front of the box of an expansion that has no cover here: a tall box with a numeral, drawn as an SVG. */
const expansionBox = (hue: number, numeral: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 90 120"><defs><linearGradient id="b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue} 52% 40%)"/><stop offset="1" stop-color="hsl(${hue + 40} 56% 16%)"/></linearGradient></defs><rect width="90" height="120" rx="6" fill="url(#b)"/><rect x="6" y="6" width="78" height="108" rx="3" fill="none" stroke="white" stroke-opacity=".5"/><text x="45" y="76" text-anchor="middle" font-family="Georgia, serif" font-size="40" fill="white" fill-opacity=".85">${numeral}</text></svg>`,
  )}`

/** The expansions of an imagined game: what its lobby offers, and what a table says it is played with. */
const EXPANSIONS: Expansion[] = [
  { id: "first", name: "First expansion", coverUrl: expansionArt(210, "I"), boxUrl: null },
  { id: "second", name: "Second expansion", coverUrl: expansionArt(340, "II"), boxUrl: null },
  // no cover: the front of its box is drawn whole in the frame
  { id: "third", name: "Third expansion", coverUrl: null, boxUrl: expansionBox(40, "III") },
]

/** An expansion with no picture at all: its frame holds the initials of its name. */
const BARE_EXPANSION: Expansion = { id: "fourth", name: "Fourth expansion", coverUrl: null, boxUrl: null }

const standing = (rank: number, playerId: string, nickname: string, rating: number, wins: number, gamesPlayed: number, avatarUrl: string | null): Standing => ({
  playerId,
  nickname,
  tag: 1000 + rank,
  avatarUrl,
  rating,
  wins,
  gamesPlayed,
  rank,
})

/** The best twelve players of a game, as `ratings` would give them. */
const STANDINGS: Standing[] = [
  standing(1, "herve", "Hervé", 1684, 41, 63, DEMO_AVATARS.herve),
  standing(2, "zoe", "Zoé", 1651, 38, 60, DEMO_AVATARS.zoe),
  standing(3, "marly", "Marly", 1620, 52, 97, DEMO_AVATARS.marly),
  standing(4, "tom", "Tom", 1598, 22, 41, DEMO_AVATARS.tom),
  standing(5, "lina", "Lina", 1577, 19, 38, DEMO_AVATARS.lina),
  standing(6, "jade", "Jade", 1560, 17, 35, DEMO_AVATARS.jade),
  standing(7, "max", "Max", 1544, 25, 52, DEMO_AVATARS.max),
  standing(8, "ines", "Inès", 1531, 14, 30, DEMO_AVATARS.ines),
  standing(9, "sam", "Sam", 1519, 12, 27, DEMO_AVATARS.sam),
  standing(10, "nolan", "A player with a very long nickname", 1507, 9, 22, DEMO_AVATARS.nolan),
  standing(11, "clara", "Clara", 1498, 8, 21, DEMO_AVATARS.clara),
  standing(12, "robin", "Robin", 1490, 7, 20, null),
]

/** The visitor: they are 27th, so outside a top of five. */
const ME: Standing = standing(27, "jo", "Jo", 1431, 14, 24, null)

/** Forty players, for a board that has to scroll. */
const MANY: Standing[] = Array.from({ length: 40 }, (_, index) => {
  const base = STANDINGS[index % STANDINGS.length]!
  const first = index < STANDINGS.length
  return standing(index + 1, `p${index + 1}`, first ? base.nickname : `${base.nickname} ${Math.floor(index / STANDINGS.length) + 1}`, 1700 - index * 7, Math.max(3, 40 - index), 70 - index, first ? base.avatarUrl : null)
})

/** What the visitor has done in the game, with the achievements they earned. */
const STATS: PlayerStats = {
  gamesPlayed: 24,
  secondsPlayed: 38 * 3600 + 25 * 60,
  wins: 14,
  rating: 1431,
  peak: 1502,
  rank: 27,
  rankedPlayers: 143,
  achievements: [
    { id: "a1", name: "First win", description: "Win a game.", earnedAt: "2026-10-04T18:20:00Z" },
    { id: "a2", name: "Regular", description: "Play 20 games.", earnedAt: "2026-10-26T21:05:00Z" },
    { id: "a3", name: "Comeback", description: "Win after being last at the half.", earnedAt: "2026-10-30T19:40:00Z" },
  ],
}

/** A visitor who is signed in and has played nothing. */
const NO_STATS: PlayerStats = { gamesPlayed: 0, secondsPlayed: 0, wins: 0, rating: null, peak: null, rank: null, rankedPlayers: 143, achievements: [] }

const opponent = (name: string | null, avatarUrl: string | null = null) => ({ name, avatarUrl })

const entry = (
  n: number,
  outcome: HistoryEntry["outcome"],
  rank: number | null,
  playerCount: number,
  ratingChange: number | null,
  score: number | null,
  xp: number | null,
  expansions: string[],
  opponents: HistoryEntry["opponents"],
  daysAgo: number,
): HistoryEntry => ({
  tableId: `g${n}`,
  finishedAt: new Date(NOW - daysAgo * 86_400_000).toISOString(),
  outcome,
  rank,
  playerCount,
  score,
  ratingChange,
  expansions,
  xp,
  opponents,
})

/** The visitor's latest games, the latest first: two wins, two losses, a draw and a game that was left, three of them with expansions. */
const HISTORY: HistoryEntry[] = [
  entry(1, "win", 1, 4, 14, 42, 120, ["first"], [opponent("Marly#4821", DEMO_AVATARS.marly), opponent("Zoé#1033", DEMO_AVATARS.zoe), opponent("Tom")], 0.4),
  entry(2, "loss", 3, 4, -9, 31, 45, [], [opponent("Hervé#0412", DEMO_AVATARS.herve), opponent("Lina#2290", DEMO_AVATARS.lina), opponent("Sam#9042", DEMO_AVATARS.sam)], 2),
  entry(3, "win", 1, 3, 12, 38, 110, ["first", "second"], [opponent("Max#5501", DEMO_AVATARS.max), opponent("Inès#3318", DEMO_AVATARS.ines)], 4),
  entry(4, "draw", 1, 2, 0, 30, 60, [], [opponent("Nolan#7710", DEMO_AVATARS.nolan)], 6),
  entry(5, "loss", 2, 2, -11, 22, 35, ["second"], [opponent(null)], 9),
  entry(6, "abandoned", null, 4, null, null, null, [], [opponent("Marly#4821", DEMO_AVATARS.marly), opponent("Zoé#1033", DEMO_AVATARS.zoe), opponent("Tom")], 12),
]

const card = (game: GameTable) => ({ ...tableCardProps(game, "a-game", NOW, EXPANSIONS), href: "#table-card" })

function TableCardWaitingAndPlaying() {
  return (
    <Frame
      className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
      code={`<TableCard
  state="waiting"
  title="Marly's table"
  seats={seatsOf(players, 5)}
  age="Opened 4 min ago"
  action="join"
  href="/a-game/game/K7P2QX"
/>

// The page makes them from its rows: tableCardProps(table, slug, now)`}
    >
      {TABLES.map((game) => (
        <TableCard key={game.id} {...card(game)} />
      ))}
    </Frame>
  )
}

function TableCardWhatAVisitorMayDo() {
  return (
    <Frame
      className="grid gap-4 md:grid-cols-2"
      code={`<TableCard action="join" href={href} … />   // a seat is free: Join
<TableCard action="full" … />                // it waits and is full: Full, disabled
<TableCard … />                              // it is played: nothing to do, nobody looks on at a game for now`}
    >
      {WAYS.map((game) => (
        <TableCard key={game.id} {...card(game)} />
      ))}
    </Frame>
  )
}

function TableCardOfSeveralGames() {
  return (
    <Frame className="grid gap-4 md:grid-cols-2" code={`<TableCard game={{ name: "Courtisans", icon: "/api/catalog/courtisans/icon" }} … />`}>
      <TableCard {...card(TABLES[0]!)} game={{ name: "Courtisans", icon: "/api/catalog/courtisans/icon" }} />
      <TableCard {...card(TABLES[2]!)} game={{ name: "Skull King" }} />
    </Frame>
  )
}

function TableCardTheSeats() {
  const people = [MARLY(0), ZOE(1), TOM(2), LINA(3), MAX(4)]
  return (
    <Frame
      className="flex max-w-md flex-col gap-5"
      code={`<TableSeats seats={seatsOf(players, 5)} />
<TableSeats seats={[{ name: "Alex" }, null, null]} />`}
    >
      <TableSeats seats={seatsOf(people.slice(0, 2), 2)} />
      <TableSeats seats={seatsOf(people.slice(0, 3), 5)} />
      <TableSeats seats={seatsOf([seated("a", 0, "Alex Doe#0001"), seated("b", 1, null), TOM(3)], 4)} />
      <TableSeats seats={seatsOf([MARLY(0)], 10)} />
    </Frame>
  )
}

function TableCardTheList() {
  const tables = TABLES.map((game) => ({ id: game.id, card: card(game) }))
  return (
    <Frame
      className="grid gap-6 md:grid-cols-3"
      code={`<TableList tables={tableListProps(tables, "a-game")} createHref="/a-game" />

// A page spreads the cards over as many columns as it has room for
<TableList tables={…} className="md:grid-cols-2" />

// With none to list: the empty state, with a button where a table is opened
<TableList tables={[]} createHref="/a-game" />
<TableList tables={[]} />`}
    >
      <TableList tables={tables.slice(0, 2)} createHref="#table-card" />
      <TableList tables={[]} createHref="#table-card" />
      <TableList tables={[]} emptyTitle="Nothing is being played" emptyDescription="The tables of this game that are played in public are listed here." />
    </Frame>
  )
}

function OpenSeatJoinAndInvite() {
  const note = "flex flex-col items-center gap-2 text-sm text-muted-foreground"
  return (
    <Frame
      className="flex flex-wrap items-start gap-12"
      code={`<OpenSeat join={{ href: "/a-game/game/K7P2QX" }} />                // a visitor who is not at the table: a link that joins it
<OpenSeat invite={{ link: "/a-game/game/K7P2QX", onInvite }} />    // one who is: the menu (press it)
<OpenSeat />                                                        // nothing to do: the dashed place alone`}
    >
      <div className={note}>
        <OpenSeat join={{ href: "#open-seat" }} className="size-10" />
        Join
      </div>
      <div className={note}>
        <OpenSeat invite={{ link: "/a-game/game/K7P2QX" }} className="size-10" />
        Invite
      </div>
      <div className={note}>
        <OpenSeat className="size-10" />
        Open
      </div>
    </Frame>
  )
}

/** What the head of an imagined game's page shows: the figures and the description, the credits, the rules in two languages and a page on BoardGameGeek. Its picture is the plain frame of a game that has none. */
const HEAD: GameHeadProps = {
  name: "A game",
  live: true,
  description: { text: "At the Queen's court, make the families you back shine and drag the others into disgrace. Play your cards at the Queen's table, in your estate or an opponent's, and fulfil your secret missions.", language: "en" },
  players: "2–5 players",
  duration: "20 min",
  age: "Ages 8+",
  released: "Released 2024",
  facts: [
    { label: "Designers", values: [{ text: "Ada Lovelace" }, { text: "Grace Hopper" }] },
    { label: "Artist", values: [{ text: "Édith Piaf" }] },
    { label: "Publisher", values: [{ text: "A Publisher", href: "https://example.com" }] },
  ],
  rulebooks: [
    { language: "en", label: "Rulebook - A game", href: "#rulebook-en" },
    { language: "fr", label: "Règles du jeu - A game", href: "#rulebook-fr" },
  ],
  bgg: "https://boardgamegeek.com/boardgame/39856",
  picture: {},
}

function GameHeadALiveGame() {
  return (
    <Frame
      code={`// A live game: "Find a game" leads to the open tables, "Create a game" to the space that opens a lobby. The rules are a menu when
// the game has several languages (a link when it has one), and BoardGameGeek is there when the Studio has the game's id
<GameHead {...game} />`}
    >
      <Fit width={PAGE}>
        <GameHead {...HEAD} />
      </Fit>
    </Frame>
  )
}

function GameHeadAGameToComeAndOneWithLittle() {
  return (
    <Frame
      className="flex flex-col gap-12"
      code={`// A game to come: both buttons are disabled, the links stay (here with one rulebook, so the rules are a link)
<GameHead {...game} live={false} rulebooks={[rulebook]} />

// A game the Studio knows little of: what it has is drawn, nothing is written in place of the rest
<GameHead name="A game" live description={null} players={null} duration={null} age={null} released={null} facts={[]} rulebooks={[]} bgg={null} picture={{}} />`}
    >
      <Fit width={PAGE}>
        <GameHead {...HEAD} live={false} rulebooks={HEAD.rulebooks.slice(0, 1)} />
      </Fit>
      <Fit width={PAGE}>
        <GameHead name="A game" live description={null} players="2–5 players" duration={null} age={null} released={null} facts={[]} rulebooks={[]} bgg={null} picture={{}} />
      </Fit>
    </Frame>
  )
}

function LobbySettingsSetAndRead() {
  return (
    <Frame
      className="grid gap-6 md:grid-cols-2"
      code={`// A lobby the visitor opened: they choose the expansions and the speed. An expansion is its cover, the front of its box when it has no cover, its initials when it has neither
<LobbySettings expansions={expansions} chosen={["first"]} pace="normal" visibility="public" editable />

// A table of the list: only what it is played with, and how fast
<LobbySettings expansions={expansions} chosen={table.expansions} pace={table.turnTimer} />`}
    >
      <div className="rounded-4xl bg-card p-8 shadow-surface ring-1 ring-foreground/10">
        <LobbySettings expansions={[...EXPANSIONS, BARE_EXPANSION]} chosen={["first"]} pace="normal" visibility="public" editable />
      </div>
      <div className="rounded-4xl bg-card p-8 shadow-surface ring-1 ring-foreground/10">
        <LobbySettings expansions={EXPANSIONS} chosen={["first", "second"]} pace="fast" />
      </div>
    </Frame>
  )
}

function LobbyPanelOpenALobby() {
  return (
    <Frame
      className="grid gap-6 md:grid-cols-2"
      code={`// A game with no expansion, as the page has it for now: the speed, who may find the table, and the way to the game's own site
<GameLobby slug="a-game" name="A game" live players="2–5 players" viewerTable={null} />

// A game that has some: each a picture with its name, outlined when it is chosen
<GameLobby slug="a-game" name="A game" live players="2–5 players" viewerTable={null} expansions={await getExpansions(slug)} />`}
    >
      <GameLobby slug="a-game" name="A game" live players="2–5 players" viewerTable={null} />
      <GameLobby slug="a-game" name="A game" live players="2–5 players" viewerTable={null} expansions={EXPANSIONS} />
    </Frame>
  )
}

function LobbyPanelYourLobby() {
  return (
    <Frame
      className="grid gap-6 md:grid-cols-2"
      code={`<GameLobby slug="a-game" name="A game" live players="2–5 players" viewerTable={await getViewerTable(slug, viewerId)} expansions={expansions} />

// viewerIsHost: the settings are theirs to set. A game in play has no icon to leave: that route takes a visitor out of a lobby only`}
    >
      <GameLobby slug="a-game" name="A game" live players="2–5 players" viewerTable={MY_LOBBY} expansions={EXPANSIONS} now={NOW} />
      <GameLobby slug="a-game" name="A game" live players="2–5 players" viewerTable={FRIENDS_LOBBY} expansions={EXPANSIONS} now={NOW} />
      <GameLobby slug="a-game" name="A game" live players="2–5 players" viewerTable={MY_GAME} expansions={EXPANSIONS} now={NOW} />
    </Frame>
  )
}

function LobbyPanelBesideTheOpenTables() {
  return (
    <Frame
      className="flex flex-col gap-10"
      code={`<GamePlay slug="a-game" name="A game" live players="2–5 players" tables={tables} viewerTable={null} />
<GamePlay slug="a-game" name="A game" live players="2–5 players" tables={[]} viewerTable={lobby} />
<GamePlay slug="a-game" name="A game" live={false} players={null} tables={[]} viewerTable={null} />`}
    >
      <Fit width={PAGE}>
        <GamePlay slug="a-game" name="A game" live players="2–5 players" tables={TABLES} viewerTable={null} expansions={EXPANSIONS} now={NOW} />
      </Fit>
      <Fit width={PAGE}>
        <GamePlay slug="a-game" name="A game" live players="2–5 players" tables={[]} viewerTable={MY_LOBBY} expansions={EXPANSIONS} now={NOW} />
      </Fit>
      <Fit width={PAGE}>
        <GamePlay slug="a-game" name="A game" live={false} players={null} tables={[]} viewerTable={null} now={NOW} />
      </Fit>
    </Frame>
  )
}

function StatTileTheFigures() {
  return (
    <Frame
      code={`<dl className="grid grid-cols-2 gap-x-6 gap-y-8 @xl:grid-cols-4">
  <StatTile label="Games played" value="24" hint="38 h played" />
  <StatTile label="Win rate" value="58%" hint="14 wins" />
  <StatTile label="Rating" value="1431" hint="Best 1502" />
  <StatTile label="Rank" value="27th" />
</dl>`}
    >
      <div className="@container">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-8 @xl:grid-cols-4">
          {statFigures(STATS).map((figure) => (
            <StatTile key={figure.label} {...figure} />
          ))}
        </dl>
      </div>
    </Frame>
  )
}

function CollapsibleOpenAndClosed() {
  const rows = ["Marly, Zoé and Tom", "Hervé, Lina and Sam", "Max and Inès"]
  return (
    <Frame
      className="grid items-start gap-6 md:grid-cols-2"
      code={`<Collapsible>
  <CollapsibleTrigger asChild>
    <button className="group/trigger …">
      Your latest games
      <HugeiconsIcon icon={ArrowDown01Icon} className="group-data-[state=open]/trigger:rotate-180" />
    </button>
  </CollapsibleTrigger>
  <CollapsibleContent>…</CollapsibleContent>
</Collapsible>`}
    >
      {[false, true].map((open) => (
        <Collapsible key={String(open)} defaultOpen={open} className="overflow-hidden rounded-3xl border">
          <CollapsibleTrigger className="group/trigger flex w-full items-center justify-between gap-3 px-6 py-4 text-left outline-none hover:bg-secondary focus-visible:ring-3 focus-visible:ring-ring/30 focus-visible:ring-inset">
            {open ? "Open when it is drawn" : "Closed when it is drawn"}
            <span aria-hidden className="text-muted-foreground transition-transform duration-base ease-standard group-data-[state=open]/trigger:rotate-180">
              ⌄
            </span>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <ul className="border-t">
              {rows.map((row) => (
                <li key={row} className="border-b px-6 py-3 text-sm text-muted-foreground last:border-b-0">
                  {row}
                </li>
              ))}
            </ul>
          </CollapsibleContent>
        </Collapsible>
      ))}
    </Frame>
  )
}

function LeaderboardTheTop() {
  return (
    <Frame
      code={`<Leaderboard rows={standings.top.map(leaderboardRow)} you={leaderboardRow(standings.viewer)} size={5} />

// A row is { id, rank, name, avatarUrl, rating, wins, played }`}
    >
      <Leaderboard rows={STANDINGS.map(leaderboardRow)} you={leaderboardRow(STANDINGS[3]!)} size={10} />
    </Frame>
  )
}

function LeaderboardTheVisitorOutsideTheTop() {
  return (
    <Frame
      code={`<Leaderboard rows={rows} you={leaderboardRow(me)} />   // me is 27th: their row follows the top, behind a gap
<Leaderboard rows={rows} you={{ …, rank: null }} /> // not ranked yet: a dash for a place`}
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <Leaderboard rows={STANDINGS.map(leaderboardRow)} you={leaderboardRow(ME)} size={5} />
        <Leaderboard rows={STANDINGS.map(leaderboardRow)} you={{ ...leaderboardRow(ME), rank: null, wins: 1, played: 3, rating: 1512 }} size={5} />
      </div>
    </Frame>
  )
}

function LeaderboardScrolling() {
  return (
    <Frame
      className="grid gap-6 md:grid-cols-2"
      code={`// Taller than the height it is given, the board scrolls: the header stays, and so does the visitor's row
<Leaderboard rows={standings.top.map(leaderboardRow)} you={leaderboardRow(standings.viewer)} className="max-h-120" />`}
    >
      <Leaderboard rows={MANY.map(leaderboardRow)} you={leaderboardRow(MANY[26]!)} className="max-h-120" />
      <Leaderboard rows={MANY.map(leaderboardRow)} you={{ ...leaderboardRow(ME), rank: 143 }} className="max-h-120" />
    </Frame>
  )
}

function LeaderboardNarrowAndEmpty() {
  return (
    <Frame
      className="grid gap-6 md:grid-cols-2"
      code={`// Inside a third of a page the column of the games played is left out
<div className="w-96"><Leaderboard rows={rows} /></div>

<Leaderboard rows={[]} />`}
    >
      <div className="max-w-sm">
        <Leaderboard rows={STANDINGS.slice(0, 6).map(leaderboardRow)} you={leaderboardRow(ME)} size={5} />
      </div>
      <Leaderboard rows={[]} />
    </Frame>
  )
}

function GameStatsSignedInAndOut() {
  return (
    <Frame
      className="flex flex-col gap-10"
      code={`<GameStats slug="a-game" stats={await getPlayerStats(slug, viewerId)} />   // null: nobody is signed in`}
    >
      <GameStats slug="a-game" stats={STATS} />
      <GameStats slug="a-game" stats={NO_STATS} />
      <GameStats slug="a-game" stats={null} />
    </Frame>
  )
}

function GameHistoryClosedAndOpen() {
  return (
    <Frame
      className="grid items-start gap-6 md:grid-cols-2"
      code={`<GameHistory entries={await getHistory(slug, viewerId)} name={game.name} expansions={expansions} />   // the first three, then a button for the rest; nothing for a visitor with no game`}
    >
      <GameHistory entries={HISTORY} name="A game" expansions={EXPANSIONS} now={NOW} />
      <GameHistory entries={HISTORY} name="A game" expansions={EXPANSIONS} now={NOW} defaultOpen />
    </Frame>
  )
}

function LeaderboardOnAGamesPage() {
  return (
    <Frame
      className="flex flex-col gap-10"
      code={`<GameStats slug={slug} stats={stats} className="lg:col-span-2">
  <GameHistory entries={history} name={game.name} expansions={expansions} />
</GameStats>
<GameLeaderboard standings={standings} />`}
    >
      <Fit width={PAGE}>
        <div className="grid gap-x-4 gap-y-24 lg:grid-cols-3 lg:items-start">
          <GameStats slug="a-game" stats={STATS} className="lg:col-span-2">
            <GameHistory entries={HISTORY} name="A game" expansions={EXPANSIONS} now={NOW} />
          </GameStats>
          <GameLeaderboard standings={{ top: STANDINGS.slice(0, 10), viewer: ME }} />
        </div>
      </Fit>
      <Fit width={PAGE}>
        <div className="grid gap-x-4 gap-y-24 lg:grid-cols-3 lg:items-start">
          <GameStats slug="a-game" stats={null} className="lg:col-span-2" />
          <GameLeaderboard standings={{ top: [], viewer: null }} />
        </div>
      </Fit>
    </Frame>
  )
}

/** A picture of a seat with a rating, a guest's and an account's that has not played the game ranked: what the cards say. */
const SEATS = seatsOf(
  [
    { seat: 0, name: "Marly", tag: "4821", avatarUrl: DEMO_AVATARS.marly, host: true, rating: elo(1620, 52, 97) },
    { seat: 1, name: "Inès", tag: "3318", avatarUrl: DEMO_AVATARS.ines, rating: null },
    { seat: 2, name: "Tom", tag: null, avatarUrl: null, rating: null },
  ],
  3,
)

function TableEntryTheRows() {
  // The table of seven people is the one the visitor sits at: its free seat invites where the others join
  const entry = (game: GameTable) => ({ ...tableEntryProps(game, "a-game", NOW, EXPANSIONS, game.id === CROWD.id), href: "#table-entry" })
  const rows = [TABLES[0]!, TABLES[1]!, TABLES[2]!, CROWD, WAYS[2]!]
  return (
    <Frame
      className="flex max-w-4xl flex-col gap-8"
      code={`<TableEntries aria-label="Open tables">
  <TableEntry {...tableEntryProps(table, "a-game")} selected={id === pickedId} onSelect={() => pick(id)} />
</TableEntries>`}
    >
      <TableEntries aria-label="Open tables">
        {rows.map((game, index) => (
          <TableEntry key={game.id} {...entry(game)} selected={index === 1} />
        ))}
      </TableEntries>
      {/* The same rows where there is little room, a phone's width: the state is its icon, the age and what to know are left to the details, which have the way in */}
      <TableEntries aria-label="Open tables, in a narrow column" className="w-88 max-w-full">
        {rows.slice(0, 4).map((game, index) => (
          <TableEntry key={game.id} {...entry(game)} selected={index === 1} />
        ))}
      </TableEntries>
    </Frame>
  )
}

function HoverCardAPlayersCard() {
  return (
    <Frame
      className="flex flex-wrap items-start gap-8"
      code={`<HoverCard>
  <HoverCardTrigger asChild><Avatar>…</Avatar></HoverCardTrigger>
  <HoverCardContent><UserCard player={player} /></HoverCardContent>
</HoverCard>

// A seat's picture does it: <SeatAvatar seat={seat} />`}
    >
      {SEATS.map((seat) => seat && <div key={seat.name} className="w-72 rounded-4xl glass p-5 shadow-float ring-1 ring-foreground/10"><UserCard player={seat} /></div>)}
      <div className="flex flex-col gap-3 text-sm text-muted-foreground">
        Rest the pointer on a picture:
        <span className="flex -space-x-2 *:data-[slot=avatar]:ring-2 *:data-[slot=avatar]:ring-(color:--cutout)">
          {SEATS.map((seat) => seat && <SeatAvatar key={seat.name} seat={seat} />)}
        </span>
      </div>
    </Frame>
  )
}

function LobbyPanelATablesDetails() {
  return (
    <Frame
      className="grid gap-6 md:grid-cols-2"
      code={`<LobbyDetail {...tableDetailProps(table, "a-game", now, false, expansions)} onClose={() => setPickedId(null)} />

// A table that is full has a button that cannot be pressed: { label: "Full", disabled: true }`}
    >
      <ClosableDetail {...tableDetailProps(TABLES[1]!, "a-game", NOW, false, EXPANSIONS)} />
      <ClosableDetail {...tableDetailProps(WAYS[1]!, "a-game", NOW, false, EXPANSIONS)} />
    </Frame>
  )
}

function AchievementTileTheBadges() {
  const earned = [
    ...STATS.achievements,
    { id: "a4", name: "A name that is a good deal too long", description: "Cut with an ellipsis; the pointer says it whole.", earnedAt: "2026-10-31T10:00:00Z" },
    { id: "streak", name: "Streak", description: "Win three games in a row.", earnedAt: "2026-11-01T09:30:00Z" },
    { id: "tournament", name: "Tournament", description: "Play in a tournament.", earnedAt: "2026-11-01T20:10:00Z" },
  ]
  return (
    <Frame
      className="flex max-w-3xl flex-col gap-4"
      code={`<h3 className="flex items-center gap-2 text-sm text-muted-foreground">
  Achievements <Badge variant="secondary">{achievements.length}</Badge>
</h3>
<AchievementTile badge="a2" name="Regular" date="26 Oct" description="Play 20 games." />   // the emblem is drawn from the id`}
    >
      <h3 className="flex items-center gap-2 text-sm text-muted-foreground">
        Achievements
        <Badge variant="secondary">{earned.length}</Badge>
      </h3>
      <ul className="grid grid-cols-3 gap-x-3 gap-y-6 sm:grid-cols-4 md:grid-cols-6">
        {earned.map((achievement) => (
          <li key={achievement.id}>
            <AchievementTile
              badge={achievement.id}
              name={achievement.name}
              date={new Date(achievement.earnedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })}
              description={achievement.description}
            />
          </li>
        ))}
      </ul>
    </Frame>
  )
}

function ScrollRowSimilarGames() {
  const names = ["Hellapagos", "Flip 7 Vengeance", "Skyjo Action", "Skyjo", "Exploding Kittens", "6 nimmt!", "King of Tokyo", "Odin"]
  return (
    <Frame
      code={`<ScrollRow title="Similar games" className="mt-section">
  {related.map(({ slug, card }) => <GameCard key={slug} {...card} />)}
</ScrollRow>`}
    >
      <div className="px-gutter">
        <ScrollRow title="Similar games">
          {names.map((name) => (
            <GameCard key={name} variant="soon" href="#scroll-row" name={name} players="2–5 players" duration="30 min" />
          ))}
        </ScrollRow>
      </div>
    </Frame>
  )
}

export const gamePageSpecimens: Specimens = {
  "table-card-waiting-and-playing": TableCardWaitingAndPlaying,
  "table-card-what-a-visitor-may-do": TableCardWhatAVisitorMayDo,
  "table-card-of-several-games": TableCardOfSeveralGames,
  "table-card-the-seats": TableCardTheSeats,
  "table-card-the-list": TableCardTheList,
  "open-seat-join-and-invite": OpenSeatJoinAndInvite,
  "game-head-a-live-game": GameHeadALiveGame,
  "game-head-a-game-to-come-and-one-with-little": GameHeadAGameToComeAndOneWithLittle,
  "lobby-settings-set-and-read": LobbySettingsSetAndRead,
  "lobby-panel-open-a-lobby": LobbyPanelOpenALobby,
  "lobby-panel-your-lobby": LobbyPanelYourLobby,
  "lobby-panel-beside-the-open-tables": LobbyPanelBesideTheOpenTables,
  "lobby-panel-a-tables-details": LobbyPanelATablesDetails,
  "table-entry-the-rows": TableEntryTheRows,
  "hover-card-a-players-card": HoverCardAPlayersCard,
  "achievement-tile-the-badges": AchievementTileTheBadges,
  "scroll-row-similar-games": ScrollRowSimilarGames,
  "stat-tile-the-figures": StatTileTheFigures,
  "collapsible-open-and-closed": CollapsibleOpenAndClosed,
  "leaderboard-the-top": LeaderboardTheTop,
  "leaderboard-the-visitor-outside-the-top": LeaderboardTheVisitorOutsideTheTop,
  "leaderboard-scrolling": LeaderboardScrolling,
  "leaderboard-narrow-and-empty": LeaderboardNarrowAndEmpty,
  "game-stats-signed-in-and-out": GameStatsSignedInAndOut,
  "game-history-closed-and-open": GameHistoryClosedAndOpen,
  "leaderboard-on-a-games-page": LeaderboardOnAGamesPage,
}
