import "server-only"
import Link from "next/link"
import type { ProfileDetails } from "@pbgo/accounts"
import { getCatalog } from "@pbgo/catalog/server"
import { CoverTile } from "@pbgo/ui/platform/cover-tile"
import { gameThumb } from "@/lib/game-thumb"

/**
 * What a member says of themselves under the head of their profile, to every visitor: the bio, as text (never markup: React escapes it, and the line breaks are kept), and their favourite games as small covers, each leading to its page. Nothing for a field that is
 * empty, and nothing at all for a profile that has neither. A favourite that is not a game of the catalog any more is left out here: the slug stays until the member changes the list.
 */
export async function ProfileAbout({ details }: { details: ProfileDetails }) {
  const { bio, favoriteGames } = details
  if (bio === null && favoriteGames.length === 0) return null
  const entries = favoriteGames.length > 0 ? (await getCatalog()).entries : []
  const games = favoriteGames.flatMap((slug) => entries.find((entry) => entry.slug === slug) ?? [])
  if (bio === null && games.length === 0) return null
  return (
    <section aria-label="About" className="flex flex-col gap-4 pt-6">
      {bio !== null && <p className="ph-mask max-w-prose text-pretty break-words whitespace-pre-line">{bio}</p>}
      {games.length > 0 && (
        <ul aria-label="Favourite games" className="flex flex-wrap gap-2">
          {games.map((entry) => (
            <li key={entry.slug}>
              <Link href={`/game/${entry.slug}`} title={entry.game.name} aria-label={entry.game.name} className="block rounded-tile outline-none focus-visible:ring-3 focus-visible:ring-ring/30">
                <CoverTile className="size-14 ring-1 ring-foreground/10" {...gameThumb(entry.game)} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
