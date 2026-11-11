import "server-only"
import { countryOptions } from "@pbgo/accounts"
import { getCatalog } from "@pbgo/catalog/server"
import { EditProfileDialog } from "@/components/edit-profile-dialog"
import { gameThumb } from "@/lib/game-thumb"
import type { ProfileHead } from "@/lib/profile-data"

/**
 * The Edit profile button of a member's own profile, which opens the window that edits it (`EditProfileDialog`). It gives the window what only the server can: every game of the catalog with its small cover, and the countries with their English names, drawn once here so that the
 * browser never draws a name of its own for the same code. A profile that has no tag (the database cannot be read, or has not got the profiles yet) cannot be edited and has no button: nothing would be saved.
 */
export async function EditProfileButton({ head, demo, address }: { head: ProfileHead; demo: boolean; address: "me" | "player" }) {
  if (head.tag === null) return null
  const { entries } = await getCatalog()
  const games = entries.map((entry) => ({ value: entry.slug, label: entry.game.name, cover: gameThumb(entry.game) }))
  return <EditProfileDialog nickname={head.nickname} tag={head.tag} details={head.details} games={games} countries={countryOptions()} demo={demo} address={address} />
}
