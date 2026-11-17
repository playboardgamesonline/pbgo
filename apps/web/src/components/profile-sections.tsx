import Link from "next/link"
import { figuresOf, type ProfileDetails, type TimeFormat } from "@pbgo/accounts"
import { getCatalog } from "@pbgo/catalog/server"
import { Alert, AlertDescription } from "@pbgo/ui/platform/alert"
import { Button } from "@pbgo/ui/platform/button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@pbgo/ui/platform/empty"
import { GameRecord } from "@/components/game-record"
import { FavoriteGames, type FavoriteGame } from "@/components/profile-favorites"
import { hasAbout, ProfileAbout } from "@/components/profile-about"
import { Zones, type PodiumPlace } from "@/components/profile-zones"
import { gameThumb } from "@/lib/game-thumb"
import type { MemberGames } from "@/lib/member-games"
import type { ProfileFriend } from "@/lib/profile-friends"
import { playtimePodium, winRatePodium } from "@/lib/profile-podiums"

type ProfileSectionsProps = {
  /** What the member says of themselves: the bio and the languages stand at the left of the favourite games they picked. */
  details: ProfileDetails
  /** Their games, records and ranks; null when the member keeps them private and the visitor is somebody else. */
  games: MemberGames | null
  /** The visitor is the member: an empty profile leads to the games, and a member who hides their games is told so. */
  own: boolean
  /** The member chose to show no games to the others: said to them on their own page, where they see everything. */
  hideHistory: boolean
  /** The member's friends, for their own page only: another visitor never sees a list of friends. Null or absent: no zone (null where they could not be read). */
  friends?: readonly ProfileFriend[] | null
  /** How many of the latest games are listed. */
  recent: number
  /** Where the whole history is, for the member's own page. */
  allGamesHref?: string
  timeFormat?: TimeFormat
}

/**
 * What a profile says under its head, the same on their own page and on anybody's: the bio in a card of its own with the languages they speak under it, and a card of the favourite games they picked just at its right, whose rank and record are one hover away; the figures in zones (the playtime with a podium of the games
 * they spent the most time at, the win rate with a podium of the games they win the most often and, on their own page, their friends); and the latest games with their opponents (each opponent with an account links to their profile). The games are the recorded ones (PLT-13). When the member
 * hides their games, another visitor sees the bio, the favourites with no card on them and a line that says so. The member sees everything, with a note that the others do not. A member who has played nothing has an empty state in place of the games.
 */
export async function ProfileSections({ details, games, own, hideHistory, friends, recent, allGamesHref, timeFormat }: ProfileSectionsProps) {
  const { entries } = await getCatalog()
  const catalog = new Map(entries.map((entry) => [entry.slug, entry]))
  const recordOf = new Map((games?.perGame ?? []).map((row) => [row.slug, row]))
  const rankIn = new Map((games?.ranks ?? []).map((entry) => [entry.slug, entry.rank]))
  // The games the member picked, in the order they put them. A game that is not in the catalog any more has no picture to draw: it is left out of the row (and of the podiums), and its slug stays in the profile until the member changes the list
  const favorites = details.favoriteGames.flatMap((slug): FavoriteGame[] => {
    const entry = catalog.get(slug)
    if (!entry) return []
    const row = recordOf.get(slug)
    // What they did at a game is their games': left out where the visitor may not see them
    return [{ slug, name: entry.game.name, picture: gameThumb(entry.game), record: games === null ? null : { played: row?.played ?? 0, wins: row?.wins ?? 0, rank: rankIn.get(slug) ?? null } }]
  })
  // What the member says of themselves: the bio in a card of its own with the languages they speak under it (each a chip with its own fill) and, just at its right (under it below `lg`, where five tiles do not leave the bio its room), a card of the favourite games they picked. Each card is as wide as
  // what it holds and the whole is aligned to the left, never stretched to the width of the page: the bio has a least width (a bio of a word is no sliver) and a most that keeps the favourites next to it, and it gives way a little before they leave it
  const about = (hasAbout(details) || favorites.length > 0) && (
    <div className="flex flex-col items-start gap-4 lg:flex-row lg:items-stretch">
      <ProfileAbout details={details} className="min-w-64 max-w-md" />
      {favorites.length > 0 && <FavoriteGames games={favorites} className="lg:shrink-0" />}
    </div>
  )
  if (games === null) {
    return (
      <div className="flex flex-col gap-10">
        {about}
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>Games are private</EmptyTitle>
            <EmptyDescription>This player chose not to show their games.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    )
  }
  const { perGame } = games
  const figures = figuresOf(perGame)
  const placesOf = (podium: ReturnType<typeof playtimePodium>): PodiumPlace[] =>
    podium.flatMap((place) => {
      const entry = catalog.get(place.slug)
      return entry ? [{ ...place, name: entry.game.name, picture: gameThumb(entry.game) }] : []
    })
  const latest = games.games.filter((game) => game.state === "finished").slice(0, recent)

  return (
    <div className="flex flex-col gap-10">
      {own && hideHistory && (
        <Alert>
          <AlertDescription>
            Your games are hidden from the other players: they see your name and your picture, and nothing else.{" "}
            <Link href="/me/settings/privacy" className="text-foreground underline underline-offset-4">
              Change it in Data &amp; Privacy
            </Link>
          </AlertDescription>
        </Alert>
      )}

      {about}

      <Zones figures={figures} playtime={placesOf(playtimePodium(perGame))} winRate={placesOf(winRatePodium(perGame))} friends={friends} />

      {perGame.length === 0 && (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>No game yet</EmptyTitle>
            <EmptyDescription>{own ? "The games you finish while you are signed in are counted here, game by game." : "This player has not finished a game yet."}</EmptyDescription>
          </EmptyHeader>
          {own && (
            <EmptyContent>
              <Button asChild>
                <Link href="/games">Pick a game</Link>
              </Button>
            </EmptyContent>
          )}
        </Empty>
      )}

      {latest.length > 0 && (
        <section aria-labelledby="recent">
          <div className="mb-4 flex items-baseline justify-between gap-4">
            <h2 id="recent" className="font-heading text-2xl">
              Recent games
            </h2>
            {allGamesHref && (
              <Link href={allGamesHref} className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
                See all
              </Link>
            )}
          </div>
          <div className="flex flex-col gap-2">
            {latest.map((game) => (
              <GameRecord key={game.id} game={game} timeFormat={timeFormat} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
