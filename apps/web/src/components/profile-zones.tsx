import Link from "next/link"
import type { GameFigures } from "@pbgo/accounts"
import { CoverTile, type CoverTileProps } from "@pbgo/ui/platform/cover-tile"
import { Podium, type PodiumEntry } from "@pbgo/ui/platform/podium"
import { StatBar, StatBarItem, StatBarNote, StatBarValue } from "@pbgo/ui/platform/stat-bar"
import { lengthOf } from "@pbgo/ui/results"
import { FriendsZone } from "@/components/profile-friends"
import type { ProfileFriend } from "@/lib/profile-friends"
import type { PodiumGame } from "@/lib/profile-podiums"

// The row of figures of a profile, in zones of their own (`StatBar`, as the stats of a game's page are): the playtime with the number of games under it, and a podium of the games they spent the most time at (their time under each step); the win rate with the number of wins under it,
// and a podium of the games they win the most often (their share under each step); and, on the member's own page, their friends. The cards are one under the other on a phone, the first two side by side from `sm`, and the three in a row from `lg`, where the friends have a card as wide as the others.
// Without the friends (another visitor's view) the first two have the row.

/** A game of a podium with its picture from the catalog. */
export type PodiumPlace = PodiumGame & { picture: CoverTileProps }

/** The entries of a podium: each game's picture is a link to the game, 4 wide for 3 high like the covers of the rest of the profile, with the name for a screen reader. */
function entriesOf(places: readonly PodiumPlace[]): PodiumEntry[] {
  return places.map((place) => ({
    name: place.name,
    value: place.value,
    picture: (
      <Link href={`/game/${place.slug}`} title={place.name} className="block rounded-tile outline-none focus-visible:ring-3 focus-visible:ring-ring/30">
        <CoverTile className="size-auto w-full aspect-4/3 ring-1 ring-foreground/10" {...place.picture} />
        <span className="sr-only">{place.name}</span>
      </Link>
    ),
  }))
}

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

export function Zones({ figures, playtime, winRate, friends }: { figures: GameFigures; playtime: readonly PodiumPlace[]; winRate: readonly PodiumPlace[]; friends?: readonly ProfileFriend[] | null }) {
  return (
    <StatBar aria-label="Figures" className={friends ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" : "grid-cols-1 sm:grid-cols-2"}>
      <StatBarItem label="Playtime">
        <StatBarValue className="truncate text-3xl leading-9">{figures.seconds > 0 ? lengthOf(figures.seconds) : "—"}</StatBarValue>
        <StatBarNote>{count(figures.played, "game", "games")}</StatBarNote>
        {playtime.length > 0 && <Podium entries={entriesOf(playtime)} aria-label="Games played the longest" className="mt-4" />}
      </StatBarItem>
      <StatBarItem label="Win rate">
        <StatBarValue className="truncate text-3xl leading-9">{figures.winRate === null ? "—" : `${figures.winRate}%`}</StatBarValue>
        <StatBarNote>{count(figures.wins, "win", "wins")}</StatBarNote>
        {winRate.length > 0 && <Podium entries={entriesOf(winRate)} aria-label="Games won the most often" className="mt-4" />}
      </StatBarItem>
      {friends && <FriendsZone friends={friends} className="sm:col-span-2 lg:col-span-1" />}
    </StatBar>
  )
}
