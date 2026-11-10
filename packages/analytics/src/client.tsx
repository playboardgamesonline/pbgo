"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import { ConsentBanner } from "./banner"
import { identifyPlayer, syncConsent, trackClient } from "./browser"
import { ANALYTICS_ENABLED, isExcludedPath } from "./config"
import { answerOf, type Answer } from "./consent"
import { gamePageClickOf } from "./cta"
import type { ClientEvents } from "./events"
import { consentStore } from "./store"

export { trackClient }

/** A link of the hub to a game (the cards of the live games): a plain link, `data-game` holds the slug. */
const GAME_LINK = "a[data-game]"

/** A button of a game's page that counts itself: `data-cta` says which and `data-cta-game` of which game (`gamePageClickOf`). */
const GAME_PAGE_BUTTON = "[data-cta]"

/** The visitor's answer: stored, followed by the SDK at once, then reported in the mode they just chose. */
function choose(answer: Answer): void {
  const consent = consentStore.choose(answer)
  syncConsent(consent)
  trackClient("cookie_consent", { choice: consent.choice, marketing: consent.marketing })
}

/**
 * Whether the page reports and offers a choice: analytics are configured and the page is not one of those that stay out of it
 * (the gamemaster, the previews, the docs). Components that add a way to reach the choice (a link, a menu row) check it first.
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
export function AnalyticsProvider({ floating = false }: { /** The banner floats over the page without padding it: the games, whose canvas keeps its whole height (`ConsentBanner`) */ floating?: boolean } = {}) {
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
  // leads to the game's page on the hub (`/game/<slug>`, whose own button is not counted). The docs of the design system show the same cards as a specimen.
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

  // The buttons of a game's page (`/game/<slug>`, which `/<slug>` shows too) count themselves from their markup: the page is a server component, so none has a handler of its own
  React.useEffect(() => {
    if (!reporting) return
    function onClick(event: MouseEvent) {
      const button = event.target instanceof Element ? event.target.closest<HTMLElement>(GAME_PAGE_BUTTON) : null
      const click = button ? gamePageClickOf(button.dataset.cta, button.dataset.ctaGame) : null
      // A button may leave for another page or another tab: the event leaves at once
      if (click) trackClient("game_page_clicked", click, { instant: true })
    }
    document.addEventListener("click", onClick)
    return () => document.removeEventListener("click", onClick)
  }, [reporting])

  if (!reporting || !ready || !open) return null
  return <ConsentBanner reopened={consent !== null} current={answerOf(consent)} floating={floating} onChoose={choose} onClose={consentStore.dismiss} />
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

/** How long a search is left alone before it is counted: a visitor who types a word, or ticks three filters, has made one search. */
export const SEARCH_PAUSE_MS = 1000

/**
 * Counts a search of a list (`list_searched`) once the visitor has stopped changing it for a second. `inputs` is what the visitor has asked of the list (null while they have asked nothing: a list nobody searched is not a search),
 * and the event is sent again only when it changes; `results` is how many it shows at that moment, which the page may refresh in the meantime without it counting for a new search.
 */
export function useSearchReport(inputs: Omit<ClientEvents["list_searched"], "results"> | null, results: number): void {
  const shown = React.useRef(results)
  React.useEffect(() => {
    shown.current = results
  }, [results])
  const key = inputs === null ? null : JSON.stringify(inputs)
  React.useEffect(() => {
    if (key === null) return
    const timer = setTimeout(() => trackClient("list_searched", { ...(JSON.parse(key) as Omit<ClientEvents["list_searched"], "results">), results: shown.current }), SEARCH_PAUSE_MS)
    return () => clearTimeout(timer)
  }, [key])
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
