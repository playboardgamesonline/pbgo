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
  /** The fixed box around the card (margin included), for the caller that measures it to keep its room free. */
  ref?: React.Ref<HTMLDivElement>
}

/**
 * The consent banner: a card that floats over the bottom of the screen, centred, with a title, a sentence that ends with a link
 * to the details, then Refuse and Accept. They are the same button side by side (same variant, same size), so refusing is as
 * easy and as visible as accepting. On a phone the card takes the width of the screen, less its margin.
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
        className="pointer-events-auto mx-auto flex w-full max-w-lg animate-in flex-col gap-3 rounded-4xl bg-card p-5 text-card-foreground shadow-float ring-1 ring-foreground/10 duration-slow ease-standard outline-none fade-in-0 slide-in-from-bottom-4"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 id={titleId} className="font-heading text-base">
            {texts.label}
          </h2>
          {reopened && (
            <Button variant="ghost" size="icon-sm" className="-mr-2 shrink-0" onClick={onClose}>
              <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
              <span className="sr-only">{texts.close}</span>
            </Button>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          {texts.body}{" "}
          <a href={moreHref} className="text-foreground underline underline-offset-4 hover:no-underline">
            {texts.more}
          </a>
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Button size="lg" onClick={onRefuse}>
            {texts.refuse}
          </Button>
          <Button size="lg" onClick={onAccept}>
            {texts.accept}
          </Button>
        </div>
      </section>
    </div>
  )
}

export { CookieBanner, type CookieBannerProps, type CookieBannerTexts }
