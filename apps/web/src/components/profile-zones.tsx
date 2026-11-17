import Link from "next/link"
import type { GameFigures } from "@pbgo/accounts"
import { CoverTile, type CoverTileProps } from "@pbgo/ui/platform/cover-tile"
import { Podium, type PodiumEntry } from "@pbgo/ui/platform/podium"
import { StatBar, StatBarItem, StatBarNote, StatBarValue } from "@pbgo/ui/platform/stat-bar"
import { lengthOf } from "@pbgo/ui/results"
import { FriendsZone } from "@/components/profile-friends"
import type { ProfileFriend } from "@/lib/profile-friends"
import type { PodiumGame } from "@/lib/profile-podiums"

// The row of figures of a profile, in zones of their own (`StatBar`, as the stats of a game's page are): the playtime with the number of games under it and, at its right, a podium of the two games they spent the most time at (their time in each bar, which is as tall as the time is of the first one's: the most played game is at the left); the win rate with the number of wins under it
// and, at its right, a podium of the two games they win the most often (their share in each bar); and, on the member's own page, their friends. Each zone is as wide as what it holds and they follow one another from the left, side by side while the window has the room, sharing what is left of it, and on the next line when it has not. The podium is small and always at the right of the figure, with room between them.

/** A game of a podium with its picture from the catalog. */
export type PodiumPlace = PodiumGame & { picture: CoverTileProps }

/** The entries of a podium: each game's picture is a link to the game, 4 wide for 3 high like the covers of the rest of the profile, with the name for a screen reader. */
function entriesOf(places: readonly PodiumPlace[]): PodiumEntry[] {
  return places.map((place) => ({
    name: place.name,
    value: place.value,
    amount: place.amount,
    picture: (
      <Link href={`/game/${place.slug}`} title={place.name} className="block rounded-tile outline-none focus-visible:ring-3 focus-visible:ring-ring/30">
        <CoverTile className="size-auto w-full aspect-4/3 ring-1 ring-foreground/10" {...place.picture} />
        <span className="sr-only">{place.name}</span>
      </Link>
    ),
  }))
}

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** The look of a zone of the row: a little less air between its label and what it says, so that the row is not tall; as wide as what it holds and, from `sm`, with the others on its line, a share of the room that is left, but never wider than 28rem, so that a zone alone on its line does not stretch. */
const ZONE = "max-w-md gap-3 sm:grow"

/** What a zone says: the figure with its note under it and, always at its right, level with the foot of the note, the podium (when there is one): a small one of two bars. It never goes under the figure. */
function Body({ value, note, podium, label }: { value: string; note: string; podium: readonly PodiumPlace[]; label: string }) {
  return (
    <div className="flex items-end justify-between gap-10">
      <div className="flex shrink-0 flex-col gap-2">
        <StatBarValue className="truncate text-3xl leading-9">{value}</StatBarValue>
        <StatBarNote>{note}</StatBarNote>
      </div>
      {podium.length > 0 && <Podium entries={entriesOf(podium)} aria-label={label} className="ml-auto min-w-0" />}
    </div>
  )
}

export function Zones({ figures, playtime, winRate, friends }: { figures: GameFigures; playtime: readonly PodiumPlace[]; winRate: readonly PodiumPlace[]; friends?: readonly ProfileFriend[] | null }) {
  return (
    <StatBar aria-label="Figures" className="flex flex-wrap">
      <StatBarItem label="Playtime" className={ZONE}>
        <Body value={figures.seconds > 0 ? lengthOf(figures.seconds) : "—"} note={count(figures.played, "game", "games")} podium={playtime} label="Games played the longest" />
      </StatBarItem>
      <StatBarItem label="Win rate" className={ZONE}>
        <Body value={figures.winRate === null ? "—" : `${figures.winRate}%`} note={count(figures.wins, "win", "wins")} podium={winRate} label="Games won the most often" />
      </StatBarItem>
      {friends && <FriendsZone friends={friends} className={ZONE} />}
    </StatBar>
  )
}
