"use client"

import * as React from "react"
import { CookieBanner } from "@pbgo/ui/platform/cookie-banner"
import type { Choice } from "./consent"
import type { Locale } from "./events"
import { reserveSpace } from "./reserve"
import { BANNER_TEXTS } from "./texts"

/**
 * The language of the banner: English, whoever the visitor is. The site, the hub and its legal pages, is in English only for now (the
 * owner, 2026-11-01), so the banner no longer follows the visitor's language (`pbgo-locale`, then the browser's). The drafts of the other
 * languages stay in `texts.ts`, and so do `pickLocale` and its tests (`locale.ts`), for the language pass (PLT-32): the day they come, this is
 * the line that reads the visitor's language again.
 */
const BANNER_LANGUAGE: Locale = "en"

type ConsentBannerProps = {
  /** The visitor already answered and asked to see the banner again: it then has a way out that keeps the answer. */
  reopened: boolean
  /** What they answered, for the analytics switch of the choices to open on it (none yet: off). */
  current?: Choice | null
  onChoose(choice: Choice): void
  onClose(): void
}

/**
 * The banner, in English. Mounted only in the browser, after the stored answer was read, so nothing here has to match what the server
 * rendered.
 *
 * The banner floats over the bottom of the screen and must never cover the page, so it keeps its room free (`reserveSpace`): the
 * page ends above it and the screens that fill the viewport are that much shorter. What is measured is the box around the card,
 * margin included. Done before the first paint, so nothing jumps under the banner.
 *
 * `ph-no-capture`: the answer is reported by the `cookie_consent` event, once it holds. Autocapture of the click itself would add
 * a second event, and for a refusal after an acceptance it would go out under the identity that is being given up.
 */
export function ConsentBanner({ reopened, current = null, onChoose, onClose }: ConsentBannerProps) {
  const root = React.useRef<HTMLDivElement>(null)
  React.useLayoutEffect(() => (root.current ? reserveSpace(root.current, document.body) : undefined), [])
  return (
    <CookieBanner
      ref={root}
      texts={BANNER_TEXTS[BANNER_LANGUAGE]}
      lang={BANNER_LANGUAGE}
      moreHref="/legal/cookies"
      analytics={current === "accepted"}
      onAccept={() => onChoose("accepted")}
      onRefuse={() => onChoose("refused")}
      // The choices have one switch the visitor sets: analytics, which the recordings hang on. On is what Accept all answers, off Reject optional
      onSave={({ analytics }) => onChoose(analytics ? "accepted" : "refused")}
      onClose={reopened ? onClose : undefined}
      className="ph-no-capture"
    />
  )
}
