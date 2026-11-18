"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Alert02Icon, ArrowRight01Icon, DiceIcon, PlayIcon, SlidersHorizontalIcon, TrophyIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"
import type { AgeRefusal } from "@pbgo/accounts"
import { createApi } from "@pbgo/core/lib/api"
import { gameRefusal, gameRefusalText, searchBlock, searchBlockText, tableBlock, tableBlockText, type PlayGroup } from "@pbgo/core/lib/play-eligibility"
import { SEARCH_MAX_GAMES } from "@pbgo/core/lib/quick-play"
import { engineOptionsOf } from "@pbgo/core/lib/table-options"
import { creationSettings, PRIVATE_TABLE, type AccessChoice } from "@pbgo/core/lib/table-settings"
import type { Friend } from "@pbgo/ui/friends"
import { orderedMembers, youLead, type GroupMember } from "@pbgo/ui/groups"
import { Button } from "@pbgo/ui/platform/button"
import { Card } from "@pbgo/ui/platform/card"
import type { ComboboxOption } from "@pbgo/ui/platform/combobox"
import { DropdownMenuItem, DropdownMenuSeparator } from "@pbgo/ui/platform/dropdown-menu"
import { GameSelect } from "@pbgo/ui/platform/game-select"
import { FriendPicker } from "@pbgo/ui/platform/invite-friend"
import { LobbyAccess, type LanguageOption } from "@pbgo/ui/platform/lobby-access"
import { LobbyPlayerCount, LobbySettings, type ExpansionOption } from "@pbgo/ui/platform/lobby-settings"
import { ModeSwitch, type ModeOption } from "@pbgo/ui/platform/mode-switch"
import { AddGameTile, PickedGame } from "@pbgo/ui/platform/picked-game"
import { PlayerSlots, type SlotPlayer } from "@pbgo/ui/platform/player-slots"
import { QueueButton } from "@pbgo/ui/platform/queue"
import { gameSlotsFor, PLAY_ZONE_LABELS, PLAY_ZONE_MODES, placesFor, searchModeOf, SLOT_BASE, type PlayZoneMode } from "@pbgo/ui/play-zone"
import type { QueueCriteria } from "@pbgo/ui/queue"
import { rankLabel, type Rank } from "@pbgo/ui/ranks"
import { defaultSeats, type Pace } from "@pbgo/ui/tables"
import { cn } from "@pbgo/ui/utils"
import { leaveQueue, startSearch, useQueue, useQueueSeconds } from "@/lib/matchmaking"
import { useCopied } from "@/lib/use-copied"
import { useSocial } from "@/lib/use-social"
import { useAgeGate } from "./age-gate"
import { useGroupActions } from "./group-actions"
import { inviteToTable } from "./invitation-actions"

/** A game that the play zone can look for a table of, or open one of: the picture its tile draws (`gamePicture`), the member's rank in it (none for a game they have not rated), what it asks of them for their age (PLT-125), how many may play and its expansions. */
export type PlayGame = {
  slug: string
  name: string
  picture?: string
  logo?: string
  rank?: Rank | null
  refusal?: AgeRefusal | null
  range: { min: number; max: number }
  expansions: readonly ExpansionOption[]
}

/** What the member sets for one game, in a search or at the table they open: how fast it is played, the expansions it is played with and, for a search, the most players at a table (none set is the game's most: any size). The usual is the usual speed, no expansion and no limit. */
type GameConfig = { pace: Pace; expansions: readonly string[]; maxPlayers?: number }
const USUAL: GameConfig = { pace: "normal", expansions: [] }

const MODE_ICONS: Record<PlayZoneMode, IconSvgElement> = { normal: DiceIcon, ranked: TrophyIcon, custom: SlidersHorizontalIcon }

const MODES: readonly ModeOption<PlayZoneMode>[] = PLAY_ZONE_MODES.map((value) => ({ value, label: PLAY_ZONE_LABELS[value], icon: MODE_ICONS[value] }))

/** The friends the panel of a free place lists before the search: the connected ones first, then the others, never more than this. */
const FRIENDS_LISTED = 8

/**
 * The slots of the games are the cells of one grid, aligned to the left: five columns, the most slots a search has, so that four slots and five are one row, or three columns in a card too narrow for five (`@xl`, the room of their section), so that a game has the same size whatever the number of games and the kind of play, and as large as its column allows up to a most (`max-w`).
 * A slot is as tall as its picture (4:3), its name and the rank under it that Ranked draws, which it keeps the room of in Normal too, so that the zone under the games never moves from one kind to the other.
 */
const SLOTS = "grid grid-cols-3 gap-x-3 gap-y-4 @xl:grid-cols-5 max-w-6xl"

/**
 * The play zone of the signed-in home: one central interface in a card that takes the height of what is left of the screen, with the same margin at its two sides and a little more under it, in the left column of the home (the right one is `HomeAside`'s: PLT-21, PLT-119, PLT-135). Its four parts are spread over the
 * height of the card: a switch that fits its cases (Normal, Ranked, Custom) at the top, then at a fixed distance (the "2xl" step, 3rem) the "Board games" (four slots to begin with: the games that are picked as tiles and, after them, the slots that are free, each
 * of which opens the panel of the games, a fifth, free, when the four are taken, five games at the most; a press on a tile opens its settings, in a window: its speed, its expansions and, for a search, the most players at a table), then the "Players" (the row of players, every place of one size too,
 * as large as the row allows, five to begin with and one more each time they are all taken, nine at the most, the member first), both with a little room at their sides, and at the foot of the card the button, with what says why it is off at its right. The places are the member's group in every mode, and a press on a friend in the panel of a free place invites them to it at once. Normal and Ranked look for a table among players the member does not know, in as many games as they pick; Custom opens a table of one game
 * for the group, private to begin with, whose number of seats the game's settings set, and invites each member of the group to it. A game that the group cannot play (it is larger than the game's most players) stays in the list and as a tile, off, with the reason, in every mode; the same reason is at the right of the button. The button says
 * "Play" (Normal and Ranked) or "Start game" (Custom), and is off when no game is left and for a member of a group who is not its leader (`@pbgo/core/lib/play-eligibility`). The search is the platform's one queue (`lib/matchmaking.ts`): while one is on, whichever page began it, the zone shows
 * its games and its kind and cannot be changed until it is stopped.
 */
export function HomePlay({ games, languages, account, className }: { games: readonly PlayGame[]; languages: readonly LanguageOption[]; account: { id: string; nickname: string; avatarUrl?: string | null }; className?: string }) {
  const router = useRouter()
  const { friends, group } = useSocial(account)
  const groups = useGroupActions()
  const [copied, copy] = useCopied()
  const { guard, demand, fail, dialog: ageDialog } = useAgeGate()
  const queue = useQueue()
  const seconds = useQueueSeconds(queue)
  const searching = queue !== null

  const [mode, setMode] = useState<PlayZoneMode>("normal")
  // A search sits the member at a table of each game, so it holds five at the most (`SEARCH_MAX_GAMES`): the first five are in to begin with
  const [picked, setPicked] = useState<readonly string[]>(() => games.slice(0, SEARCH_MAX_GAMES).map((game) => game.slug))
  const [customSlug, setCustomSlug] = useState<string | null>(null)
  // The settings of a game are the member's whichever kind of play they are for, so they are kept by game
  const [configs, setConfigs] = useState<Readonly<Record<string, GameConfig>>>({})
  // The table opened by hand: how many seats (the game's median until the member picks) and who may join (private to begin with)
  const [seats, setSeats] = useState<number | null>(null)
  const [access, setAccess] = useState<AccessChoice>(PRIVATE_TABLE)
  const [opening, setOpening] = useState(false)
  // Whether the panel of the games is open: every free slot opens it, the first one being its trigger
  const [adding, setAdding] = useState(false)

  // What the zone shows is the search when there is one, else what the member has set up so far
  const shownMode = queue ? queue.mode : mode
  const searchMode = searchModeOf(shownMode)
  const chosen = queue ? queue.games.map((game) => game.slug) : searchMode ? picked : customSlug ? [customSlug] : []
  const shown = games.filter((game) => chosen.includes(game.slug))
  const customGame = games.find((game) => game.slug === customSlug)
  const configOf = (slug: string): GameConfig => configs[slug] ?? USUAL
  // The most players at a table that a search accepts in a game: the number set, else the game's most, which asks nothing
  const maxPlayersOf = (game: PlayGame) => Math.min(game.range.max, configOf(game.slug).maxPlayers ?? game.range.max)
  const isUsual = (game: PlayGame) => configOf(game.slug).pace === USUAL.pace && configOf(game.slug).expansions.length === 0 && maxPlayersOf(game) === game.range.max

  // The member and the people who play with them, whichever the kind of play: their group (the leader first) and the friends invited to it who have not answered
  const members = group ? orderedMembers(group).filter((member) => !member.you) : []
  const waiting = friends.filter((friend) => friend.pending === "invited")
  const me: SlotPlayer = { id: "you", name: account.nickname, avatarUrl: account.avatarUrl, you: true, leader: searchMode ? (group ? youLead(group) : false) : !group || youLead(group) }
  const slotOf = (friend: Friend | GroupMember, rest: Partial<SlotPlayer> = {}): SlotPlayer => ({ id: friend.id, name: friend.nickname, tag: friend.tag, avatarUrl: friend.avatarUrl, status: friend.status, ...rest })
  const players: SlotPlayer[] = [me, ...members.map((member) => slotOf(member, { leader: member.leader })), ...waiting.map((friend) => slotOf(friend, { pending: true }))]
  const tableSeats = seats ?? (customGame ? defaultSeats(customGame.range.min, customGame.range.max) : SLOT_BASE)
  // A search has five places to begin with and one more each time they are all taken; a table of one's own has the seats of its game, never fewer than the people in the row, and five until a game is picked
  const size = searchMode ? placesFor(players.length) : customGame ? Math.max(tableSeats, players.length) : SLOT_BASE

  // What the group cannot do: games it is too large for stay, off, a member who is in a game stops the search, and only the leader of a group looks for a game or opens a table
  const playGroup: PlayGroup = { size: group ? group.members.length : 1, inGame: members.filter((member) => member.status === "playing").map((member) => member.nickname), leads: group ? youLead(group) : true }
  const refusals = new Map(games.flatMap((game) => { const refusal = gameRefusal(playGroup, game.range); return refusal ? [[game.slug, gameRefusalText(refusal)] as const] : [] }))
  const searchBlocked = searchMode ? searchBlock(playGroup) : null
  const tableBlocked = shownMode === "custom" ? tableBlock(playGroup) : null
  const asked = shown.filter((game) => !refusals.has(game.slug))
  const refused = shown.filter((game) => refusals.has(game.slug))
  const notices = searching ? [] : searchBlocked ? [searchBlockText(searchBlocked)] : tableBlocked ? [tableBlockText(tableBlocked)] : [...refused.slice(0, 2).map((game) => `${game.name}: ${refusals.get(game.slug)}`), ...(refused.length > 2 ? [`${refused.length - 2} more games can't be played by your group.`] : [])]

  // The slots of the games: four to begin with and a fifth, free, when they are all taken, five at the most (`SEARCH_MAX_GAMES`), counted from the games of the search whatever the kind of play, so that the zone under them never moves when the kind changes. A table of one's own
  // holds one game: of its free slots only the one that can be pressed is drawn, the others are invisible, there for the room of the rows. The games that are picked have the first slots and the free ones come after them; the ones of a search stay drawn while it is on, off, since it is read and not set
  const slots = gameSlotsFor(searchMode ? shown.length : picked.length, SEARCH_MAX_GAMES)
  const freeSlots = Math.max(0, slots - shown.length)
  const pressable = searchMode ? freeSlots : customSlug === null ? 1 : 0
  const addLabel = searchMode ? "Add a game" : "Choose a game"

  const options: ComboboxOption[] = games.map((game) => ({
    value: game.slug,
    label: game.name,
    cover: { picture: game.picture, logo: game.logo },
    ...(refusals.has(game.slug) ? { unavailable: refusals.get(game.slug) } : shownMode === "ranked" ? { description: game.rank ? rankLabel(game.rank) : "Unranked" } : {}),
  }))

  function pickCustom(slug: string | undefined) {
    setCustomSlug(slug ?? null)
    setSeats(null)
  }

  /** The settings panel of a game's tile: for a search the most players at a table, above the speed (not for a ranked search, which is played at the usual speed), the number of players of a table of one's own, and the expansions. */
  function settingsOf(game: PlayGame) {
    return (
      <LobbySettings
        // The settings of a game are that game's, and the speed is left out of a ranked search's: another game or kind starts the panel again
        key={`${game.slug}:${shownMode}`}
        editable
        speed={shownMode !== "ranked"}
        beforeSpeed={
          searchMode && game.range.max > game.range.min ? (
            <LobbyPlayerCount
              title="Max players"
              label="Most players at the table"
              range={game.range}
              count={maxPlayersOf(game)}
              onCountChange={(count) => setConfigs((all) => ({ ...all, [game.slug]: { ...configOf(game.slug), maxPlayers: count } }))}
            />
          ) : undefined
        }
        pace={configOf(game.slug).pace}
        chosen={configOf(game.slug).expansions}
        expansions={game.expansions}
        afterSpeed={shownMode === "custom" ? <LobbyPlayerCount range={game.range} count={Math.max(tableSeats, players.length)} onCountChange={setSeats} disabled={opening} /> : undefined}
        onChange={(value) => setConfigs((all) => ({ ...all, [game.slug]: { ...configOf(game.slug), pace: value.pace, expansions: value.expansions } }))}
        onLockedPick={(_id, locked) => void demand(locked.kind as AgeRefusal)}
      />
    )
  }

  /** The panel of a free place, the same in every mode: the friends who are in no group, right away, with a link to copy for someone who has no account yet. One press invites the friend to the member's group, which the row then shows as a faint picture until they answer. */
  const picker = (
    <FriendPicker
      friends={friends.filter((friend) => friend.group === undefined)}
      invited={new Set(waiting.map((friend) => friend.id))}
      limit={FRIENDS_LISTED}
      onInvite={groups.inviteFromPicker}
      link={{ onCopy: copy, copied }}
    />
  )

  /** What a press on a person of the row opens, in every mode: in a group, their profile and, for the leader, the lead and the way out of the group; the member's own place has "Leave group". A friend who was invited and has not answered has none, nor does a member with no group. */
  function menuOf(player: SlotPlayer) {
    if (player.pending || !group) return null
    if (player.you) return <DropdownMenuItem onSelect={() => groups.leave()}>Leave group</DropdownMenuItem>
    const member = group.members.find((candidate) => candidate.id === player.id)
    if (!member) return null
    return (
      <>
        <DropdownMenuItem onSelect={() => groups.viewProfile(member)}>View profile</DropdownMenuItem>
        {youLead(group) && (
          <>
            <DropdownMenuItem onSelect={() => groups.makeLeader(member)}>Make leader</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => groups.kick(member)}>
              Remove from group
            </DropdownMenuItem>
          </>
        )}
      </>
    )
  }

  async function search() {
    if (!searchMode) return
    // A game for adults needs the member's date of birth before the search begins
    if (asked.some((game) => game.refusal === "date") && !(await demand("date"))) return
    // What the member set on each tile goes with the search: a speed other than the usual one (not in a ranked search, which is played at it), the expansions and a limit on the players at a table
    const criteria = Object.fromEntries(
      asked.flatMap((game) => {
        const config = configOf(game.slug)
        const entry: QueueCriteria = { ...(searchMode === "normal" && config.pace !== USUAL.pace ? { pace: config.pace } : {}), ...(config.expansions.length > 0 ? { expansions: [...config.expansions] } : {}), ...(maxPlayersOf(game) < game.range.max ? { maxPlayers: maxPlayersOf(game) } : {}) }
        return Object.keys(entry).length > 0 ? [[game.slug, entry] as const] : []
      }),
    )
    try {
      await guard(() => startSearch(asked.map(({ slug, name }) => ({ slug, name })), searchMode, {}, criteria))
    } catch (error) {
      fail(error)
    }
  }

  /** Opens the table with the game's own route, as the game's page does, keeps who may join, the speed and the seats with it, sends the engine its options, invites each member of the member's group to it and takes the member to its lobby, where they share its link. */
  async function open() {
    if (!customGame) return
    const config = configOf(customGame.slug)
    setOpening(true)
    try {
      const api = createApi(customGame.slug)
      // A game for adults asks for the member's date of birth when it is missing (PLT-125): they give it, and the call goes on
      const table = await guard(() => api.create({}, creationSettings(access, config.pace, Math.max(tableSeats, players.length), customGame.range)))
      const options = engineOptionsOf({ expansions: config.expansions, helpers: [] }, { expansions: customGame.expansions.map(({ id }) => id), helpers: [] }, Object.keys(table.options))
      if (Object.keys(options).length > 0) await guard(() => api.options(table.code, options)).catch(fail)
      await Promise.all(members.map((member) => inviteToTable(member, { game: customGame.slug, code: table.code })))
      router.push(`/game/${customGame.slug}/${table.code}`)
    } catch (error) {
      fail(error)
      setOpening(false)
    }
  }

  return (
    <Card
      role="region"
      aria-labelledby="home-play"
      className={cn("min-h-[calc(100svh-var(--consent-h,0px)-var(--spacing-navbar)-1rem-var(--spacing-gutter)-1rem)] min-w-0 gap-0 overflow-visible py-0 [--cutout:var(--card)]", className)}
    >
      {/* The switch, the games and the players follow one another from the top, the games at the "2xl" distance (`mt-12`, 3rem) from the switch and the players at 2rem (`mt-8`) from the games, and the button is at the foot with what is left of the height above it (never under 1.5rem). The games and the players have a little room at their sides */}
      <div className="flex flex-1 flex-col p-6 pb-7">
        <h2 id="home-play" className="sr-only">
          Play
        </h2>
        <ModeSwitch options={MODES} value={shownMode} onValueChange={setMode} disabled={searching} aria-label="What to play" className="justify-start" />
        <section aria-labelledby="home-games" className="@container mt-12 flex flex-col gap-4 px-2">
          <h3 id="home-games" className="font-heading text-lg">
            {searchMode ? "Board games" : "Board game"}
          </h3>
          {games.length === 0 ? (
            <p className="text-sm text-muted-foreground">The games you can play are listed here.</p>
          ) : (
            <>
              <div role="group" aria-label="Games to play" className={SLOTS}>
                {shown.map((game, index) => (
                  <PickedGame
                    key={game.slug}
                    name={game.name}
                    picture={game.picture}
                    logo={game.logo}
                    showRank={shownMode === "ranked"}
                    rank={game.rank}
                    unavailable={refusals.get(game.slug)}
                    config={searching ? undefined : settingsOf(game)}
                    configured={!isUsual(game)}
                    onRemove={searching ? undefined : searchMode ? () => setPicked(picked.filter((slug) => slug !== game.slug)) : () => pickCustom(undefined)}
                    loading={index < 6 ? "eager" : "lazy"}
                  />
                ))}
                {Array.from({ length: freeSlots }, (_, index) =>
                  index >= pressable ? (
                    // Room only, for the second row and the rest of a table of one's own: not drawn, not pressed, not read
                    <AddGameTile key={`room-${index}`} label={addLabel} className="invisible" disabled />
                  ) : index === 0 ? (
                    <GameSelect
                      key="free-0"
                      options={options}
                      value={searchMode ? picked : customSlug ? [customSlug] : []}
                      onValueChange={(next) => (searchMode ? setPicked(next) : pickCustom(next[0]))}
                      max={searchMode ? SEARCH_MAX_GAMES : 1}
                      searchPlaceholder="Search games..."
                      empty="No game matches."
                      fullNote={`A search takes ${SEARCH_MAX_GAMES} games at the most. Take one out to add another.`}
                      aria-label="Games"
                      open={adding && !searching}
                      onOpenChange={setAdding}
                    >
                      <AddGameTile label={addLabel} disabled={searching} />
                    </GameSelect>
                  ) : (
                    // The other free slots open the same panel, so only the first of them is a stop for the keyboard's Tab
                    <AddGameTile key={`free-${index}`} label={addLabel} disabled={searching} tabIndex={-1} onClick={() => setAdding(true)} />
                  ),
                )}
              </div>
              <p aria-live="polite" className="sr-only">
                {chosen.length === 0 ? (searchMode ? "Pick at least one game" : "Pick a game") : `${chosen.length} selected`}
              </p>
            </>
          )}
        </section>
        <section aria-labelledby="home-players" className="@container mt-8 flex flex-col gap-4 px-2">
          <h3 id="home-players" className="font-heading text-lg">
            Players
          </h3>
          <PlayerSlots players={players} size={size} picker={picker} menu={menuOf} disabled={searching || opening} />
        </section>
        <div aria-hidden="true" className="min-h-6 grow" />
        {/* The button is at the foot of the card, which is the foot of the screen, with what says why it is off at its right. Under `xl` a card taller than the screen keeps it in view above the consent banner, over what scrolls under it (the fade is the card's own grey); from `xl` the card is made to fit the screen and it stays at its foot. It has 1.75rem under it, a quarter of a rem more than the card has at its sides (`pb-7`, on the card's content and, under `xl`, on this wrapper, which cancels the content's) */}
        <div className="sticky bottom-[var(--consent-h,0px)] z-10 -mx-6 -mb-7 flex flex-wrap items-center gap-x-6 gap-y-3 rounded-b-4xl bg-gradient-to-t from-card from-70% to-transparent px-6 pt-4 pb-7 xl:static xl:m-0 xl:bg-none xl:p-0">
          {searchMode ? (
            <QueueButton size="2xl" searching={searching} seconds={seconds} disabled={asked.length === 0 || searchBlocked !== null} onSearch={search} onCancel={leaveQueue}>
              <HugeiconsIcon icon={PlayIcon} strokeWidth={2} data-icon="inline-start" aria-hidden="true" />
              Play
            </QueueButton>
          ) : (
            <div className="flex items-center gap-3">
              <Button size="2xl" disabled={opening || asked.length === 0 || tableBlocked !== null} onClick={open}>
                Start game
                <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} data-icon="inline-end" aria-hidden="true" />
              </Button>
              <LobbyAccess languages={languages} defaultVisibility="private" onChange={setAccess} size="icon-2xl" disabled={opening} />
            </div>
          )}
          {notices.length > 0 && (
            <div role="status" className="flex min-w-0 max-w-md flex-col gap-1 text-sm text-muted-foreground">
              {notices.map((text) => (
                <p key={text} className="ph-mask flex items-start gap-2">
                  <HugeiconsIcon icon={Alert02Icon} strokeWidth={2} aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-destructive" />
                  {text}
                </p>
              ))}
            </div>
          )}
        </div>
      </div>
      {groups.dialogs}
      {ageDialog}
    </Card>
  )
}
