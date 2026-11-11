import "server-only"
import Link from "next/link"
import type { ProfileDetails } from "@pbgo/accounts"
import { getCatalog } from "@pbgo/catalog/server"
import { CoverTile } from "@pbgo/ui/platform/cover-tile"
import { gameThumb } from "@/lib/game-thumb"

/**
 * What a member says of themselves under the head of their profile, to every visitor: the bio, as text (never markup: React escapes it, and the line breaks are kept), and their favourite board games as tiles with their names under them, each leading to its page.
 * Nothing for a field that is empty, and nothing at all for a profile that has neither. A favourite that is not a game of the catalog any more is left out here: the slug stays until the member changes the list.
 */
export async function ProfileAbout({ details }: { details: ProfileDetails }) {
  const { bio, favoriteGames } = details
  if (bio === null && favoriteGames.length === 0) return null
  const entries = favoriteGames.length > 0 ? (await getCatalog()).entries : []
  const games = favoriteGames.flatMap((slug) => entries.find((entry) => entry.slug === slug) ?? [])
  if (bio === null && games.length === 0) return null
  return (
    <>
      {bio !== null && (
        <section aria-label="About" className="pt-6">
          <p className="ph-mask max-w-prose text-pretty break-words whitespace-pre-line">{bio}</p>
        </section>
      )}
      {games.length > 0 && (
        <section aria-labelledby="favorites" className="pt-8">
          <h2 id="favorites" className="mb-4 font-heading text-2xl">
            Favorite board games
          </h2>
          <ul className="flex flex-wrap gap-x-4 gap-y-5">
            {games.map((entry) => (
              <li key={entry.slug}>
                <Link href={`/game/${entry.slug}`} className="group/favorite flex w-24 flex-col gap-2 outline-none sm:w-28">
                  <CoverTile
                    className="size-24 ring-1 ring-foreground/10 transition-shadow duration-fast group-hover/favorite:ring-foreground/30 group-focus-visible/favorite:ring-3 group-focus-visible/favorite:ring-ring/30 sm:size-28"
                    {...gameThumb(entry.game)}
                  />
                  <span className="line-clamp-2 text-sm leading-snug group-hover/favorite:underline">{entry.game.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}
