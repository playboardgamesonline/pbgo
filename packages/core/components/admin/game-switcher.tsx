"use client"

import { usePathname, useRouter } from "next/navigation"
import { Avatar, AvatarFallback, AvatarImage } from "@pbgo/ui/platform/avatar"
import { Badge } from "@pbgo/ui/platform/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@pbgo/ui/platform/select"
import { switchHref } from "../../lib/admin-nav"

/** A game as the gamemaster lists it: what the registry knows, without loading the game (the switcher lists all of them on every page). */
export type SwitcherGame = { slug: string; name: string; live: boolean; visual: string | null }

/** The game's cover art (registry `visual`), else its first letter. */
export function GameMark({ game, size = "sm", className }: { game: { name: string; visual?: string | null }; size?: "default" | "sm" | "lg"; className?: string }) {
  return (
    <Avatar size={size} className={className}>
      {game.visual && <AvatarImage src={game.visual} alt="" />}
      <AvatarFallback>{([...game.name][0] ?? "").toUpperCase()}</AvatarFallback>
    </Avatar>
  )
}

function GameLabel({ game }: { game: SwitcherGame }) {
  return (
    <>
      <GameMark game={game} />
      <span className="min-w-0 flex-1 truncate">{game.name}</span>
      {game.live && <Badge variant="secondary">Live</Badge>}
    </>
  )
}

/**
 * Header of the sidebar: every game of the registry, the current one selected (none on the overview). Choosing a game stays on the
 * same page of the sidebar (Mechanics stays Mechanics) and goes to the game's first page when there is no such page to keep.
 * `confirmLeave` asks before dropping unsaved changes.
 */
export function GameSwitcher({ games, slug, confirmLeave }: { games: SwitcherGame[]; slug: string | null; confirmLeave: () => boolean }) {
  const router = useRouter()
  const pathname = usePathname()
  const current = games.find((g) => g.slug === slug)

  return (
    <Select
      value={current?.slug ?? ""}
      onValueChange={(next) => {
        if (next !== slug && confirmLeave()) router.push(switchHref(next, pathname))
      }}
    >
      <SelectTrigger aria-label="Game" className="w-full">
        {/* Children rather than the selected item's text: the server renders the trigger as it is, without waiting for the list to mount */}
        <SelectValue placeholder="Choose a game">{current && <GameLabel game={current} />}</SelectValue>
      </SelectTrigger>
      <SelectContent position="popper" align="start">
        {games.map((game) => (
          <SelectItem key={game.slug} value={game.slug} textValue={game.name}>
            <GameLabel game={game} />
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
