"use client"

import * as React from "react"
import { CookieBanner } from "@pbgo/ui/platform/cookie-banner"
import type { Choice } from "./consent"
import type { Locale } from "./events"
import { cookieValue, LOCALE_COOKIE, pickLocale } from "./locale"
import { reserveSpace } from "./reserve"
import { BANNER_TEXTS } from "./texts"

/** The language of the site as the visitor set it (the cookie of the language selector), else the browser's. */
function readLanguage(): Locale {
  return pickLocale({ cookie: cookieValue(document.cookie, LOCALE_COOKIE), languages: navigator.languages })
}

/** The selector changes `<html lang>` when the visitor picks another language, which is the cue to read it again. */
function watchLanguage(notify: () => void): () => void {
  const observer = new MutationObserver(notify)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] })
  return () => observer.disconnect()
}

type ConsentBannerProps = {
  /** The visitor already answered and asked to see the banner again: it then has a way out that keeps the answer. */
  reopened: boolean
  onChoose(choice: Choice): void
  onClose(): void
}

/**
 * The banner in the visitor's language. Mounted only in the browser, after the stored answer was read, so nothing here has to
 * match what the server rendered.
 *
 * The banner floats over the bottom of the screen and must never cover the page, so it keeps its room free (`reserveSpace`): the
 * page ends above it and the screens that fill the viewport are that much shorter. What is measured is the box around the card,
 * margin included. Done before the first paint, so nothing jumps under the banner.
 *
 * `ph-no-capture`: the answer is reported by the `cookie_consent` event, once it holds. Autocapture of the click itself would add
 * a second event, and for a refusal after an acceptance it would go out under the identity that is being given up.
 */
export function ConsentBanner({ reopened, onChoose, onClose }: ConsentBannerProps) {
  const locale = React.useSyncExternalStore(watchLanguage, readLanguage, () => "en" as const)
  const root = React.useRef<HTMLDivElement>(null)
  React.useLayoutEffect(() => (root.current ? reserveSpace(root.current, document.body) : undefined), [])
  return (
    <CookieBanner
      ref={root}
      texts={BANNER_TEXTS[locale]}
      lang={locale}
      moreHref="/legal#cookies"
      onAccept={() => onChoose("accepted")}
      onRefuse={() => onChoose("refused")}
      onClose={reopened ? onClose : undefined}
      className="ph-no-capture"
    />
  )
}
