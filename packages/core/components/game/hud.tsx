"use client"

import { AnimatePresence, MotionConfig } from "motion/react"
import { useCallback, useEffect, useState } from "react"
import type { OptionValues } from "@pbgo/engine-kit"
import { cn } from "@pbgo/ui/utils"
import type { SeatAvatarInput } from "../../lib/seat-avatar"
import { Chat } from "./chat"
import { Announcement, type AnnouncementSettings } from "./announcement"
import { useGame } from "./context"
import { GuestDock, useGameMenu } from "./game-menu"
import { useHudDock } from "./hud-dock"
import { TableDebug } from "./table-debug"
import { TablePlayers } from "./table-players"
import { PromptHost } from "./prompt-host"

// The log of the turns is in its own file, in the game's look; the games keep importing it from here
export { groupTurns, PlayerName, Ticker, type HistoryTurn } from "./ticker"

/**
 * The top right of the screen, in the platform's look: the dock of the visitor's social panel (the app's, `useHudDock`), whose picture opens the menu of the game (its sound, its language, its setup, its rules, the way out…) with the
 * pages of their account, or, when there is no dock to show, the picture alone in a bar with the same menu (`GuestDock`); then the players of the table under it, with what each has so far. The dock opens over the players, hence the stacking.
 */
function TableCorner({ gameCode, options, onLeave, className }: { gameCode: string; options: OptionValues; onLeave: () => void; className?: string }) {
  const Dock = useHudDock()
  const menu = useGameMenu({ gameCode, options, onLeave })
  const guest = <GuestDock menu={menu} />
  return (
    <div className={cn("flex flex-col items-end gap-2", className)}>
      {/* eslint-disable-next-line react-hooks/static-components -- the dock is the app's component, given once by the context for the life of the page: it is not made while drawing */}
      <div className="platform relative z-20 font-sans text-foreground">{Dock ? <Dock menu={menu} fallback={guest} /> : guest}</div>
      <TablePlayers className="relative z-10" />
    </div>
  )
}

/**
 * Standard game screen: the table (children) full screen. What is said around it stands in the corners, so that the cards keep the middle and the bottom: top left the state of the game (`ticker`: whose turn it is, the round, the history),
 * in the game's look; top right the social dock, the one island in the platform's look, with the settings and the way out, and the players of the table with their scores under it; bottom right the chat of the table, which only shows when it has
 * something to say. The players and the chat are still drawn in the platform's look (`platform-look.test.ts` lists what has not moved to the game's yet).
 * `overlay` is for the game's own buttons and panels. The table is as tall as the window and the cookie banner floats over it; the HUD and the overlay stand above the banner's room, so a bottom-anchored button keeps its distance from the card.
 *
 * `MotionConfig` makes every `motion` component below it follow the visitor's `prefers-reduced-motion`.
 *
 * The root clips (`overflow-clip`), it does not hide: a board may run past the screen on purpose (Courtisans' hand peeks from the
 * bottom), and an `overflow-hidden` box is still a scroll container, so focusing a card or a `scrollIntoView` would scroll the
 * whole table, HUD included, out of view. A clipped box cannot be scrolled.
 */
export function GameHud({
  onLeave,
  ticker,
  overlay,
  children,
}: {
  onLeave: () => void
  ticker?: React.ReactNode
  overlay?: React.ReactNode
  children: React.ReactNode
}) {
  const { game } = useGame()
  // The table fills the whole screen, under the consent banner, which floats over it (`AnalyticsProvider floating`): a canvas that shrank with the banner would reflow the scene. The HUD and the game's overlays are in a layer that
  // ends above the banner (`--consent-h`, set on <body>; 0px without a banner), so what is anchored to the bottom is never under the card. The layer lets the pointer through to the table, and `contents` keeps the overlay's own pointer events
  return (
    <MotionConfig reducedMotion="user">
      <main className="group/hud relative h-dvh w-full overflow-clip bg-background text-foreground">
        <div className="absolute inset-0">{children}</div>
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[calc(100dvh-var(--consent-h,0px))]">
          <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-4 pt-[max(1.25rem,env(safe-area-inset-top))] pr-[max(1.5rem,env(safe-area-inset-right))] pb-8 pl-[max(1.5rem,env(safe-area-inset-left))] short:gap-2 short:pt-[max(0.75rem,env(safe-area-inset-top))] short:pr-[max(1rem,env(safe-area-inset-right))] short:pl-[max(1rem,env(safe-area-inset-left))]">
            {ticker}
            <TableCorner className="ml-auto" gameCode={game.code} options={game.options} onLeave={onLeave} />
          </header>
          <div className="pointer-events-auto contents">{overlay}</div>
        </div>
        <Chat />
        <TableDebug />
        <PromptHost />
      </main>
    </MotionConfig>
  )
}

type Queued<T extends string> = { id: number; text: string; subtitle?: string; type: T; sound?: string; seats?: SeatAvatarInput[] }
let counter = 0

/**
 * Queue of full-screen announcements: `announce(text, type, { subtitle, sound, seats, replace })`, one at a time, each for its preset's duration.
 * `seats` are the players shown with it (`seatsOf` in `lib/seat-avatar`): the viewer for "your turn", the winners for a victory.
 * `replace` drops the queued announcements of the given types (e.g. a stale "your turn"); `first` puts it at the front.
 * The current one is also read out in a polite live region, for visitors who do not see the screen.
 */
export function useAnnouncements<T extends string>(settings: Record<T, AnnouncementSettings>, { paused = false }: { paused?: boolean } = {}) {
  const [queue, setQueue] = useState<Queued<T>[]>([])
  // paused (e.g. during the opening), the queue waits without showing anything
  const current = paused ? null : (queue[0] ?? null)
  const announce = useCallback((text: string, type: T, options: { subtitle?: string; sound?: string; seats?: SeatAvatarInput[]; replace?: T[]; first?: boolean } = {}) => {
    const item = { id: ++counter, text, type, subtitle: options.subtitle, sound: options.sound, seats: options.seats }
    setQueue((q) => {
      const kept = options.replace ? q.filter((x) => !options.replace!.includes(x.type)) : q
      return options.first ? [item, ...kept] : [...kept, item]
    })
  }, [])
  const clear = useCallback(() => setQueue([]), [])
  const duration = current ? settings[current.type].duration : 0
  useEffect(() => {
    if (!current) return
    const timer = setTimeout(() => setQueue((q) => q.slice(1)), duration * 1000)
    return () => clearTimeout(timer)
  }, [current, duration])
  const element = (
    <>
      <div role="status" aria-live="polite" className="ph-mask sr-only">
        {current && [current.text, current.subtitle].filter(Boolean).join(". ")}
      </div>
      <AnimatePresence>
        {current && (
          <Announcement key={current.id} text={current.text} subtitle={current.subtitle} settings={settings[current.type]} sound={current.sound} seats={current.seats} live={false} />
        )}
      </AnimatePresence>
    </>
  )
  return { announce, clear, current, element }
}
