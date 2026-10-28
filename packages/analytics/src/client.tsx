"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import { ConsentBanner } from "./banner"
import { identifyPlayer, syncConsent, trackClient } from "./browser"
import { ANALYTICS_ENABLED, isExcludedPath } from "./config"
import type { Choice } from "./consent"
import { consentStore } from "./store"

export { trackClient }

/** A link of the hub to a game (the cards of the live games): a plain link, `data-game` holds the slug. */
const GAME_LINK = "a[data-game]"

/** The visitor's answer: stored, followed by the SDK at once, then reported in the mode they just chose. */
function choose(choice: Choice): void {
  const consent = consentStore.choose(choice)
  syncConsent(consent)
  trackClient("cookie_consent", { choice })
}

/**
 * Whether the page reports and offers a choice: analytics are configured and the page is not one of those that stay out of it
 * (the gamemaster, the previews, `/design`). Components that add a way to reach the choice (a link, a menu row) check it first.
 */
export function useReporting(): boolean {
  const pathname = usePathname()
  return ANALYTICS_ENABLED && !isExcludedPath(pathname)
}

/** Shows the banner again, whatever was answered, so the visitor can change their mind. */
export function reopenConsent(): void {
  consentStore.reopen()
}

/**
 * Everything the browser side needs, mounted once per root layout that reports (the hub, the games, the 404), never in the
 * gamemaster. It follows the visitor's answer, shows the banner while there is none (or when they reopen it), and counts the
 * clicks from the hub to a game. Without a configuration it renders nothing and does nothing.
 *
 * A game's preview pages share the game's layout: they are told apart by their address, and neither show the banner nor report.
 */
export function AnalyticsProvider() {
  const { ready, consent, open } = React.useSyncExternalStore(
    consentStore.subscribe,
    consentStore.getSnapshot,
    consentStore.getServerSnapshot
  )
  const pathname = usePathname()
  const reporting = useReporting()

  React.useEffect(() => {
    if (ready) syncConsent(consent)
  }, [ready, consent, pathname])

  // The hub's two lists of games are the pages whose links are counted, the home (its popular games and its results) and `/games`: a card
  // leads to the game's page on the hub (`/game/<slug>`, whose own button is not counted). `/design` shows the same cards as a specimen.
  const onGameList = pathname === "/" || pathname === "/games"
  React.useEffect(() => {
    if (!reporting || !onGameList) return
    function onClick(event: MouseEvent) {
      const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>(GAME_LINK) : null
      const game = link?.dataset.game
      // The link is a full page load: the event leaves at once instead of waiting in the batch.
      if (game) trackClient("game_opened_from_hub", { game }, { instant: true })
    }
    document.addEventListener("click", onClick)
    return () => document.removeEventListener("click", onClick)
  }, [reporting, onGameList])

  if (!reporting || !ready || !open) return null
  return <ConsentBanner reopened={consent !== null} onChoose={choose} onClose={consentStore.dismiss} />
}

/**
 * A "Cookies" link: reopens the banner so the visitor can change their answer. Renders nothing when analytics are off (no
 * configuration) or on a page that does not report, since there would be nothing to change. It is a button that takes the usual
 * button props (a click handler of the caller runs first).
 */
export function ConsentLink({ onClick, ...props }: Omit<React.ComponentProps<"button">, "type">) {
  const reporting = useReporting()
  if (!reporting) return null
  return (
    <button
      {...props}
      type="button"
      onClick={(event) => {
        onClick?.(event)
        reopenConsent()
      }}
    />
  )
}

/**
 * Tells the SDK which player of the table is on screen (null: none, a visitor who has not joined). Only a visitor who accepted is
 * tied to the player; the others stay anonymous. The id is the one the server's events already carry, so both sides line up.
 */
export function useIdentifyPlayer(id: string | null): void {
  React.useEffect(() => {
    if (id) identifyPlayer(id)
  }, [id])
}
