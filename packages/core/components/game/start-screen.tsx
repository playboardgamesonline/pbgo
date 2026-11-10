"use client"

import type { ReactNode } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@pbgo/ui/platform/avatar"
import { Badge } from "@pbgo/ui/platform/badge"
import { Item, ItemActions, ItemContent, ItemMedia, ItemTitle } from "@pbgo/ui/platform/item"
import { Logo as PlatformLogo } from "@pbgo/ui/platform/logo"
import { Progress } from "@pbgo/ui/platform/progress"
import { Spinner } from "@pbgo/ui/platform/spinner"
import { useBinding } from "../../lib/binding-context"
import type { LoadingRow } from "../../lib/ready-curtain"
import { useSiteSettings } from "../settings-provider"

/**
 * The screen between the platform and a game (PLT-107): a table has been started and its boards load, or a player comes back to a game under way. It is the platform's, not the game's: the one screen of a game's page that the platform draws (the
 * cookie banner is the other), black and white in Geist, built from `@pbgo/ui/platform` and its tokens, in English until the language pass (PLT-32), with the game's logo, which is art and is shown as it is. A game page is not `.platform`, so the
 * screen carries the class itself, as the banner does. It holds the viewport above the board, less the room of the cookie banner (`--consent-h`).
 */
export function StartScreen({
  title,
  subtitle,
  busy = false,
  progress = null,
  caption,
  seconds = null,
  rows,
  children,
}: {
  title: string
  subtitle?: string
  /** A spinner for what has no share yet (the table is being read) */
  busy?: boolean
  /** The collective bar, 0 to 1; null for no bar */
  progress?: number | null
  /** Under the bar, at its left ("3 of 4 players ready") */
  caption?: string
  /** Under the bar, at its right: the seconds left of the ready check */
  seconds?: number | null
  /** Seat by seat, how far each board is */
  rows?: readonly LoadingRow[]
  /** What goes under the title and its line: a button */
  children?: ReactNode
}) {
  return (
    <div className="platform flex h-[calc(100dvh-var(--consent-h,0px))] flex-col overflow-y-auto bg-background font-sans text-foreground">
      <header className="px-gutter pt-6">
        <PlatformLogo className="h-7" />
      </header>
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-8 px-gutter py-10">
        <GameMark />
        <div role="status" aria-live="polite" className="flex flex-col items-center gap-2 text-center">
          {busy && <Spinner className="size-6" />}
          <h1 className="text-2xl sm:text-3xl">{title}</h1>
          {subtitle && <p className="text-muted-foreground">{subtitle}</p>}
        </div>
        {children}
        {progress !== null && (
          <section aria-label="Loading" className="flex w-full flex-col gap-3">
            <Progress value={Math.round(progress * 100)} />
            <div className="flex items-center justify-between gap-4 text-sm text-muted-foreground tabular-nums">
              <span>{caption}</span>
              {seconds !== null && <span>{seconds} s</span>}
            </div>
          </section>
        )}
        {rows && rows.length > 0 && (
          <ul className="flex w-full flex-col gap-2">
            {rows.map((row) => (
              <li key={row.id}>
                <Item size="sm">
                  <ItemMedia>
                    <Avatar>
                      {row.avatarUrl && <AvatarImage src={row.avatarUrl} alt="" />}
                      <AvatarFallback className="ph-mask">{row.name.slice(0, 1).toUpperCase()}</AvatarFallback>
                    </Avatar>
                  </ItemMedia>
                  <ItemContent>
                    <ItemTitle>
                      {/* a nickname is typed by its player: session recordings show it masked */}
                      <span className="ph-mask truncate">{row.name}</span>
                      {row.me && <span className="text-muted-foreground">You</span>}
                    </ItemTitle>
                  </ItemContent>
                  <ItemActions>
                    {row.ready ? (
                      <Badge variant="success">Ready</Badge>
                    ) : (
                      <span className="text-sm text-muted-foreground tabular-nums">{Math.round(row.progress * 100)}%</span>
                    )}
                  </ItemActions>
                </Item>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  )
}

/** The game's logo, as it is (art is the only colour of the platform), or its name when the Studio has no logo. */
function GameMark() {
  const { title, logo } = useSiteSettings()
  const { Logo } = useBinding()
  return logo ? <Logo src={logo} alt={title} className="h-20 w-auto max-w-full object-contain" /> : <p className="text-lg text-muted-foreground">{title}</p>
}
