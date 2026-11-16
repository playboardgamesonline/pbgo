"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Alert02Icon, ArrowRight01Icon, Calendar01Icon, DiceIcon, PlayIcon, SlidersHorizontalIcon, TrophyIcon } from "@hugeicons/core-free-icons"
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
import type { ComboboxOption } from "@pbgo/ui/platform/combobox"
import { DropdownMenuItem, DropdownMenuSeparator } from "@pbgo/ui/platform/dropdown-menu"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@pbgo/ui/platform/empty"
import { GameSelect } from "@pbgo/ui/platform/game-select"
import { FriendPicker } from "@pbgo/ui/platform/invite-friend"
import { LobbyAccess, type LanguageOption } from "@pbgo/ui/platform/lobby-access"
import { LobbyPlayerCount, LobbySettings, type ExpansionOption } from "@pbgo/ui/platform/lobby-settings"
import { ModeSwitch, type ModeOption } from "@pbgo/ui/platform/mode-switch"
import { AddGameTile, PickedGame } from "@pbgo/ui/platform/picked-game"
import { PlayerSlots, type SlotPlayer } from "@pbgo/ui/platform/player-slots"
import { QueueButton } from "@pbgo/ui/platform/queue"
import { Section, SectionAction } from "@pbgo/ui/platform/section"
import { PLAY_ZONE_LABELS, PLAY_ZONE_MODES, SLOT_COLUMNS, searchModeOf, type PlayZoneMode } from "@pbgo/ui/play-zone"
import type { QueueCriteria } from "@pbgo/ui/queue"
import { rankLabel, type Rank } from "@pbgo/ui/ranks"
import { defaultSeats, type Pace } from "@pbgo/ui/tables"
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

/** What the member sets for one game, in a search or at the table they open: how fast it is played and the expansions it is played with. The usual is the usual speed and no expansion. */
type GameConfig = { pace: Pace; expansions: readonly string[] }
const USUAL: GameConfig = { pace: "normal", expansions: [] }

const MODE_ICONS: Record<PlayZoneMode, IconSvgElement> = { normal: DiceIcon, ranked: TrophyIcon, tournaments: Calendar01Icon, custom: SlidersHorizontalIcon }

const MODES: readonly ModeOption<PlayZoneMode>[] = PLAY_ZONE_MODES.map((value) => ({ value, label: PLAY_ZONE_LABELS[value], icon: MODE_ICONS[value] }))

/** The friends the panel of a free place lists before the search: the connected ones first, then the others, never more than this. */
const FRIENDS_LISTED = 8

/** How wide a tile is for how many there are, as the old zone sized them: up to four games have large tiles, up to nine medium ones and more small ones, so that one game and ten both fit the column. A phone has smaller ones. */
const TILE_WIDTHS = { large: "w-36 sm:w-44", medium: "w-28 sm:w-32", small: "w-20 sm:w-24" }
const tileWidth = (count: number) => TILE_WIDTHS[count <= 4 ? "large" : count <= 9 ? "medium" : "small"]

/** The tournaments, until there are some: the empty state of the page of their tab, and the way to it. */
function TournamentsPanel() {
  return (
    <div className="flex w-full max-w-2xl flex-col items-center gap-6">
      <Empty className="border p-6">
        <EmptyHeader>
          <EmptyTitle>No tournament yet</EmptyTitle>
          <EmptyDescription>Your tournaments, and the coming ones on the games you play, are listed here.</EmptyDescription>
        </EmptyHeader>
      </Empty>
      <SectionAction asChild>
        <Link href="/tournaments">See all tournaments</Link>
      </SectionAction>
    </div>
  )
}

/**
 * The play zone of the signed-in home, one central interface with no title and no surface, its parts floating on the page's black: a switch at the top that fits its cases (Normal, Ranked, Tournaments, Custom: PLT-21, PLT-119, PLT-135), under it the select of the games, the games that are
 * picked as tiles (a press on one opens its settings: its speed and its expansions), the row of players, nine places on one line with the member in the middle, and the button. Normal and Ranked look for a table among players the member does not know, in as many games as they pick (ten at the most),
 * the places being their group; Custom opens a table of one game for friends, private to begin with, the places being its seats, whose number the game's settings set; a friend picked in a place is invited when the table opens. Tournaments has the empty state of the tournaments.
 * A game that the group cannot play stays in the list and as a tile, off, with the reason; the same reason is in small type above the button. The button says "Find a game" (Normal and Ranked) or "Start game" (Custom), and is off when no game is left and for a member of a group who is not its leader
 * (`@pbgo/core/lib/play-eligibility`). The search is the platform's one queue (`lib/matchmaking.ts`): while one is on, whichever page began it,
 * the zone shows its games and its kind and cannot be changed until it is stopped.
 */
export function HomePlay({ games, languages, account }: { games: readonly PlayGame[]; languages: readonly LanguageOption[]; account: { id: string; nickname: string; avatarUrl?: string | null } }) {
  const router = useRouter()
  const { friends, group } = useSocial(account)
  const groups = useGroupActions(friends)
  const [copied, copy] = useCopied()
  const { guard, demand, fail, dialog: ageDialog } = useAgeGate()
  const queue = useQueue()
  const seconds = useQueueSeconds(queue)
  const searching = queue !== null

  const [mode, setMode] = useState<PlayZoneMode>("normal")
  // A search sits the member at a table of each game, so it holds ten at the most (`SEARCH_MAX_GAMES`): the first ten are in to begin with
  const [picked, setPicked] = useState<readonly string[]>(() => games.slice(0, SEARCH_MAX_GAMES).map((game) => game.slug))
  const [customSlug, setCustomSlug] = useState<string | null>(null)
  // The settings of a game are the member's whichever kind of play they are for, so they are kept by game
  const [configs, setConfigs] = useState<Readonly<Record<string, GameConfig>>>({})
  // The table opened by hand: how many seats (the game's median until the member picks), who may join (private to begin with) and the friends to invite once it exists
  const [seats, setSeats] = useState<number | null>(null)
  const [access, setAccess] = useState<AccessChoice>(PRIVATE_TABLE)
  const [invitees, setInvitees] = useState<readonly Friend[]>([])
  const [opening, setOpening] = useState(false)

  // What the zone shows is the search when there is one, else what the member has set up so far
  const shownMode = queue ? queue.mode : mode
  const searchMode = searchModeOf(shownMode)
  const chosen = queue ? queue.games.map((game) => game.slug) : searchMode ? picked : customSlug ? [customSlug] : []
  const shown = games.filter((game) => chosen.includes(game.slug))
  const customGame = games.find((game) => game.slug === customSlug)
  const configOf = (slug: string): GameConfig => configs[slug] ?? USUAL
  const isUsual = (slug: string) => configOf(slug).pace === USUAL.pace && configOf(slug).expansions.length === 0

  // The member and the people who play with them: their group (the leader first), the friends invited to it who have not answered, or, for a table of their own, the friends they picked
  const members = group ? orderedMembers(group).filter((member) => !member.you) : []
  const waiting = friends.filter((friend) => friend.pending === "invited")
  const me: SlotPlayer = { id: "you", name: account.nickname, avatarUrl: account.avatarUrl, you: true, leader: searchMode ? (group ? youLead(group) : false) : !group || youLead(group) }
  const slotOf = (friend: Friend | GroupMember, rest: Partial<SlotPlayer> = {}): SlotPlayer => ({ id: friend.id, name: friend.nickname, tag: friend.tag, avatarUrl: friend.avatarUrl, status: friend.status, ...rest })
  const players: SlotPlayer[] = searchMode
    ? [me, ...members.map((member) => slotOf(member, { leader: member.leader })), ...waiting.map((friend) => slotOf(friend, { pending: true }))]
    : [me, ...invitees.map((friend) => slotOf(friend, { pending: true }))]
  const tableSeats = seats ?? (customGame ? defaultSeats(customGame.range.min, customGame.range.max) : SLOT_COLUMNS)
  const size = searchMode ? SLOT_COLUMNS : customGame ? Math.max(tableSeats, players.length) : SLOT_COLUMNS

  // What the group cannot do: games it is too large for stay, off, a member who is in a game stops the search, and only the leader of a group looks for a game or opens a table
  const playGroup: PlayGroup = { size: group ? group.members.length : 1, inGame: members.filter((member) => member.status === "playing").map((member) => member.nickname), leads: group ? youLead(group) : true }
  const refusals = new Map(games.flatMap((game) => { const refusal = searchMode ? gameRefusal(playGroup, game.range) : null; return refusal ? [[game.slug, gameRefusalText(refusal)] as const] : [] }))
  const searchBlocked = searchMode ? searchBlock(playGroup) : null
  const tableBlocked = shownMode === "custom" ? tableBlock(playGroup) : null
  const asked = shown.filter((game) => !refusals.has(game.slug))
  const refused = shown.filter((game) => refusals.has(game.slug))
  const notices = searching ? [] : searchBlocked ? [searchBlockText(searchBlocked)] : tableBlocked ? [tableBlockText(tableBlocked)] : [...refused.slice(0, 2).map((game) => `${game.name}: ${refusals.get(game.slug)}`), ...(refused.length > 2 ? [`${refused.length - 2} more games can't be played by your group.`] : [])]

  // The tile that adds a game ends the row while a game can still be added: a search takes ten, a table of one's own one, and a search that is on is read and not set
  const canAdd = !searching && games.length > 0 && (searchMode ? true : customSlug === null)
  const tiles = shown.length + (canAdd ? 1 : 0)

  const options: ComboboxOption[] = games.map((game) => ({
    value: game.slug,
    label: game.name,
    cover: { picture: game.picture, logo: game.logo },
    ...(refusals.has(game.slug) ? { unavailable: refusals.get(game.slug) } : shownMode === "ranked" ? { description: game.rank ? rankLabel(game.rank) : "Unranked" } : {}),
  }))

  function pickCustom(slug: string | undefined) {
    setCustomSlug(slug ?? null)
    setSeats(null)
    const game = games.find((candidate) => candidate.slug === slug)
    // A game that takes fewer players has no room for all the friends that were picked
    if (game) setInvitees((current) => current.slice(0, Math.max(0, game.range.max - 1)))
  }

  /** The settings panel of a game's tile: the speed (not for a ranked search, which is played at the usual speed), the number of players of a table of one's own, and the expansions. */
  function settingsOf(game: PlayGame) {
    return (
      <LobbySettings
        // The settings of a game are that game's, and the speed is left out of a ranked search's: another game or kind starts the panel again
        key={`${game.slug}:${shownMode}`}
        editable
        speed={shownMode !== "ranked"}
        pace={configOf(game.slug).pace}
        chosen={configOf(game.slug).expansions}
        expansions={game.expansions}
        afterSpeed={shownMode === "custom" ? <LobbyPlayerCount range={game.range} count={Math.max(tableSeats, players.length)} onCountChange={setSeats} disabled={opening} /> : undefined}
        onChange={(value) => setConfigs((all) => ({ ...all, [game.slug]: { pace: value.pace, expansions: value.expansions } }))}
        onLockedPick={(_id, locked) => void demand(locked.kind as AgeRefusal)}
      />
    )
  }

  /** The panel of a free place: the friends right away. In a search they are invited to the group, with a link for someone who has no account yet; for a table of one's own they are picked, and invited when it opens, a table that does not exist having no link to copy. */
  const picker = searchMode ? (
    <FriendPicker
      friends={friends.filter((friend) => friend.group === undefined)}
      invited={new Set(friends.filter((friend) => friend.pending === "invited").map((friend) => friend.id))}
      limit={FRIENDS_LISTED}
      onInvite={groups.inviteFromPicker}
      link={{ onCopy: copy, copied }}
    />
  ) : (
    <FriendPicker
      friends={friends}
      invited={new Set(invitees.map((friend) => friend.id))}
      limit={FRIENDS_LISTED}
      labels={{ action: "Add", done: "Added" }}
      onInvite={(friend) => {
        if (invitees.length + 1 >= size) return false
        setInvitees((current) => (current.some((other) => other.id === friend.id) ? current : [...current, friend]))
        return true
      }}
    />
  )

  /** What a press on a person of the row opens: in a group, their profile and, for the leader, the lead and the way out of the group; the member's own place has "Leave group". For a table of one's own, a friend picked can be taken out. */
  function menuOf(player: SlotPlayer) {
    if (player.pending && searchMode) return null
    if (!searchMode) {
      return player.you ? null : (
        <DropdownMenuItem variant="destructive" onSelect={() => setInvitees((current) => current.filter((friend) => friend.id !== player.id))}>
          Remove
        </DropdownMenuItem>
      )
    }
    if (!group) return null
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
    // What the member set on each tile goes with the search: a speed other than the usual one (not in a ranked search, which is played at it) and the expansions
    const criteria = Object.fromEntries(
      asked.flatMap((game) => {
        const config = configOf(game.slug)
        const entry: QueueCriteria = { ...(searchMode === "normal" && config.pace !== USUAL.pace ? { pace: config.pace } : {}), ...(config.expansions.length > 0 ? { expansions: [...config.expansions] } : {}) }
        return Object.keys(entry).length > 0 ? [[game.slug, entry] as const] : []
      }),
    )
    try {
      await guard(() => startSearch(asked.map(({ slug, name }) => ({ slug, name })), searchMode, {}, criteria))
    } catch (error) {
      fail(error)
    }
  }

  /** Opens the table with the game's own route, as the game's page does, keeps who may join, the speed and the seats with it, sends the engine its options, invites the friends picked and takes the member to its lobby, where they share its link. */
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
      await Promise.all(invitees.map((friend) => inviteToTable(friend, { game: customGame.slug, code: table.code })))
      router.push(`/game/${customGame.slug}/${table.code}`)
    } catch (error) {
      fail(error)
      setOpening(false)
    }
  }

  return (
    <Section aria-labelledby="home-play" className="items-center gap-10 pt-4">
      <h2 id="home-play" className="sr-only">
        Play
      </h2>
      <ModeSwitch options={MODES} value={shownMode} onValueChange={setMode} disabled={searching} aria-label="What to play" />
      {shownMode === "tournaments" ? (
        <TournamentsPanel />
      ) : (
        <div className="flex w-full max-w-4xl flex-col items-center gap-10">
          {games.length === 0 ? (
            <p className="text-sm text-muted-foreground">The games you can play are listed here.</p>
          ) : (
            <div className="flex w-full flex-col items-center gap-6">
              <div role="group" aria-label="Games to play" className="flex w-full max-w-2xl flex-wrap justify-center gap-x-4 gap-y-6">
                {shown.map((game, index) => (
                  <PickedGame
                    key={game.slug}
                    className={tileWidth(tiles)}
                    name={game.name}
                    picture={game.picture}
                    logo={game.logo}
                    showRank={shownMode === "ranked"}
                    rank={game.rank}
                    unavailable={refusals.get(game.slug)}
                    config={searching ? undefined : settingsOf(game)}
                    configured={!isUsual(game.slug)}
                    onRemove={searching ? undefined : searchMode ? () => setPicked(picked.filter((slug) => slug !== game.slug)) : () => pickCustom(undefined)}
                    loading={index < 6 ? "eager" : "lazy"}
                  />
                ))}
                {canAdd && (
                  <GameSelect
                    options={options}
                    value={searchMode ? picked : customSlug ? [customSlug] : []}
                    onValueChange={(next) => (searchMode ? setPicked(next) : pickCustom(next[0]))}
                    max={searchMode ? SEARCH_MAX_GAMES : 1}
                    searchPlaceholder="Search games..."
                    empty="No game matches."
                    fullNote={`A search takes ${SEARCH_MAX_GAMES} games at the most. Take one out to add another.`}
                    aria-label="Games"
                  >
                    <AddGameTile label={searchMode ? "Add a game" : "Choose a game"} className={tileWidth(tiles)} />
                  </GameSelect>
                )}
              </div>
              <p aria-live="polite" className="sr-only">
                {chosen.length === 0 ? (searchMode ? "Pick at least one game" : "Pick a game") : `${chosen.length} selected`}
              </p>
            </div>
          )}
          <PlayerSlots players={players} size={size} picker={picker} menu={menuOf} disabled={searching || opening} />
          <div className="flex flex-col items-center gap-4">
            {notices.length > 0 && (
              <div role="status" className="flex max-w-md flex-col gap-1 text-center text-sm text-muted-foreground">
                {notices.map((text) => (
                  <p key={text} className="ph-mask flex items-start justify-center gap-2">
                    <HugeiconsIcon icon={Alert02Icon} strokeWidth={2} aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-destructive" />
                    {text}
                  </p>
                ))}
              </div>
            )}
            {searchMode ? (
              <QueueButton size="xl" searching={searching} seconds={seconds} disabled={asked.length === 0 || searchBlocked !== null} onSearch={search} onCancel={leaveQueue}>
                <HugeiconsIcon icon={PlayIcon} strokeWidth={2} data-icon="inline-start" aria-hidden="true" />
                Find a game
              </QueueButton>
            ) : (
              <div className="flex items-center gap-3">
                <Button size="xl" disabled={opening || !customGame || tableBlocked !== null} onClick={open}>
                  Start game
                  <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} data-icon="inline-end" aria-hidden="true" />
                </Button>
                <LobbyAccess languages={languages} defaultVisibility="private" onChange={setAccess} size="icon-xl" disabled={opening} />
              </div>
            )}
          </div>
        </div>
      )}
      {groups.dialogs}
      {ageDialog}
    </Section>
  )
}
