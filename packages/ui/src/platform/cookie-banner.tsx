"use client"

import * as React from "react"
import { Cancel01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { cn } from "../utils"
import { Button } from "./button"

/** What the banner says, in the visitor's language: the caller picks the language, the banner only shows the words. */
type CookieBannerTexts = {
  /** Accessible name of the dialog. */
  label: string
  /** One sentence: what is counted whatever the answer, and what accepting adds. */
  body: string
  accept: string
  refuse: string
  /** The word of the link that ends the sentence and leads to the legal notice. */
  more: string
  close: string
}

type CookieBannerProps = {
  texts: CookieBannerTexts
  /** Where the link of `texts.more` leads: the part of the legal notice about cookies and statistics. */
  moreHref: string
  /** The language of `texts`, when it can differ from the page's (the hub is rendered in English for every visitor). */
  lang?: string
  onAccept(): void
  onRefuse(): void
  /**
   * Closes the banner and keeps the answer. Only passed once the visitor has answered, i.e. when they reopened the banner
   * from a "Cookies" link: before that, the banner stays until they choose.
   */
  onClose?(): void
  className?: string
  /** The fixed element, for the caller that measures it to keep its room free (`@pbgo/analytics` does). */
  ref?: React.Ref<HTMLDivElement>
}

/**
 * The consent banner: one line docked to the bottom of the screen, a sentence that ends with a link to the details, then Refuse
 * and Accept. They are the same button side by side (same variant, same size), so refusing is as easy and as visible as
 * accepting. Under the `sm` breakpoint the sentence takes a few short lines and the two buttons stack to its right, which keeps
 * the bar low on a phone as well.
 *
 * It is `fixed`, but it must never sit over what the page shows. It does not float: the caller measures it and makes the room
 * (`@pbgo/analytics` publishes its height as `--consent-h`, see `reserve.ts`), so a page has nothing under the banner, whether it
 * is a hub page that scrolls or a game screen that fills the viewport.
 *
 * A game page is not `.platform`, so the banner carries the class itself, the way a portal does. The words and the answers come
 * from the caller, which owns the stored choice.
 */
function CookieBanner({ texts, moreHref, lang, onAccept, onRefuse, onClose, className, ref }: CookieBannerProps) {
  const card = React.useRef<HTMLElement>(null)
  const reopened = onClose !== undefined

  // A banner the visitor reopened gets the focus, or a keyboard user would tab through the whole page to find it
  React.useEffect(() => {
    if (reopened) card.current?.focus({ preventScroll: true })
  }, [reopened])

  return (
    <div ref={ref} data-slot="cookie-banner" className={cn("platform pointer-events-none fixed inset-x-0 bottom-0 z-50", className)}>
      <section
        ref={card}
        role="dialog"
        lang={lang}
        aria-label={texts.label}
        tabIndex={-1}
        onKeyDown={(event) => {
          if (event.key === "Escape") onClose?.()
        }}
        className="pointer-events-auto animate-in border-t border-border bg-card text-card-foreground duration-slow ease-standard outline-none fade-in-0 slide-in-from-bottom-2"
      >
        <div className="mx-auto flex max-w-7xl items-center justify-center gap-x-4 px-gutter py-2 text-xs sm:gap-x-6 sm:py-2.5 sm:text-sm">
          <p className="min-w-0 max-sm:flex-1">
            {texts.body}{" "}
            <a href={moreHref} className="text-foreground underline underline-offset-4 hover:no-underline">
              {texts.more}
            </a>
          </p>
          <div className="flex shrink-0 flex-col gap-1.5 sm:flex-row sm:gap-2">
            <Button size="sm" className="max-sm:h-7 max-sm:text-xs" onClick={onRefuse}>
              {texts.refuse}
            </Button>
            <Button size="sm" className="max-sm:h-7 max-sm:text-xs" onClick={onAccept}>
              {texts.accept}
            </Button>
          </div>
          {reopened && (
            <Button variant="ghost" size="icon-sm" className="shrink-0 max-sm:self-start" onClick={onClose}>
              <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
              <span className="sr-only">{texts.close}</span>
            </Button>
          )}
        </div>
      </section>
    </div>
  )
}

export { CookieBanner, type CookieBannerProps, type CookieBannerTexts }
