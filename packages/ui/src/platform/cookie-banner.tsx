"use client"

import * as React from "react"
import { Cancel01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { cn } from "../utils"
import { Button } from "./button"

/** What the banner says, in the visitor's language: the caller picks the language, the banner only shows the words. */
type CookieBannerTexts = {
  /** The title of the card, which is also its accessible name. */
  label: string
  /** One sentence: what the site needs, and what the visitor's permission adds. */
  body: string
  /** Allows everything. */
  accept: string
  /** Refuses everything that is optional. */
  refuse: string
  /** The words of the link that ends the sentence and leads to the policy. */
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
  /** The fixed box around the card (margin included), for the caller that measures it to keep its room free. */
  ref?: React.Ref<HTMLDivElement>
}

/** Both answers are the same big button, 3rem high and 3.5rem from the bar layout on (`rounded-2xl`: a control of that height): refusing is as easy to hit as accepting, whatever their fill. */
const ANSWER = "h-12 rounded-2xl px-6 text-base max-sm:flex-1 lg:h-14 lg:px-8"

/**
 * The consent banner: a wide card that floats over the bottom of the screen, centred, with a title and a sentence that ends with a
 * link to the policy on its side, and two big buttons on the other: Reject optional (ghost) and Accept all. They are the same size
 * and the same shape, side by side. From `lg` the card is a bar (the words, then the buttons, centred on its height); under it the
 * words are over the buttons, which keep to the right, and on a phone they share the width of the card.
 *
 * It is `fixed`, but it must never sit over what the page shows. It floats inside a box that holds its margin (`px-4 pb-4`, `px-6 pb-6` from
 * `sm`: its own, since the page's gutter is 64px on a desktop), and the caller measures that box and makes the room (`@pbgo/analytics` publishes its height as `--consent-h`, see
 * `reserve.ts`), so a page has nothing under the card, whether it is a hub page that scrolls or a game screen that fills the
 * viewport.
 *
 * A game page is not `.platform`, so the banner carries the class itself, the way a portal does. The words and the answers come
 * from the caller, which owns the stored choice.
 */
function CookieBanner({ texts, moreHref, lang, onAccept, onRefuse, onClose, className, ref }: CookieBannerProps) {
  const card = React.useRef<HTMLElement>(null)
  const titleId = React.useId()
  const reopened = onClose !== undefined

  // A banner the visitor reopened gets the focus, or a keyboard user would tab through the whole page to find it
  React.useEffect(() => {
    if (reopened) card.current?.focus({ preventScroll: true })
  }, [reopened])

  return (
    <div
      ref={ref}
      data-slot="cookie-banner"
      className={cn("platform pointer-events-none fixed inset-x-0 bottom-0 z-50 px-4 pb-4 sm:px-6 sm:pb-6", className)}
    >
      <section
        ref={card}
        role="dialog"
        lang={lang}
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={(event) => {
          if (event.key === "Escape") onClose?.()
        }}
        className={cn(
          "pointer-events-auto relative mx-auto flex w-full max-w-4xl animate-in flex-col gap-3 rounded-4xl bg-card p-4 text-card-foreground shadow-float ring-1 ring-foreground/10 duration-slow ease-standard outline-none fade-in-0 slide-in-from-bottom-4 sm:gap-4 sm:p-5 lg:flex-row lg:items-center lg:gap-8 lg:p-6",
          reopened && "lg:pr-16"
        )}
      >
        {reopened && (
          <Button variant="ghost" size="icon-sm" className="absolute top-3 right-3" onClick={onClose}>
            <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
            <span className="sr-only">{texts.close}</span>
          </Button>
        )}
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
          <h2 id={titleId} className={cn("font-heading text-base", reopened && "pr-8 lg:pr-0")}>
            {texts.label}
          </h2>
          <p className="text-sm text-muted-foreground">
            {texts.body}{" "}
            <a href={moreHref} className="text-foreground underline underline-offset-4 hover:no-underline">
              {texts.more}
            </a>
          </p>
        </div>
        <div className="flex gap-2 sm:justify-end lg:shrink-0">
          <Button variant="ghost" size="lg" className={ANSWER} onClick={onRefuse}>
            {texts.refuse}
          </Button>
          <Button size="lg" className={ANSWER} onClick={onAccept}>
            {texts.accept}
          </Button>
        </div>
      </section>
    </div>
  )
}

export { CookieBanner, type CookieBannerProps, type CookieBannerTexts }
