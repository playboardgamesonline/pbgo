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
  /** What accepting changes. */
  body: string
  /** What stays the same whatever the answer. */
  extra: string
  accept: string
  refuse: string
  /** The words of the link to the legal notice. */
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
}

/**
 * The consent banner: a compact card at the bottom centre of the screen. Accept and Refuse are the same button side by side
 * (same variant, same size), so refusing is as easy and as visible as accepting.
 *
 * It sits over a hub page or a game page alike. A game page is not `.platform`, so the banner carries the class itself, the
 * way a portal does. The words and the answers come from the caller (`@pbgo/analytics`), which owns the stored choice.
 */
function CookieBanner({ texts, moreHref, lang, onAccept, onRefuse, onClose, className }: CookieBannerProps) {
  const card = React.useRef<HTMLElement>(null)
  const reopened = onClose !== undefined

  // A banner the visitor reopened gets the focus, or a keyboard user would tab through the whole page to find it
  React.useEffect(() => {
    if (reopened) card.current?.focus({ preventScroll: true })
  }, [reopened])

  return (
    <div
      data-slot="cookie-banner"
      className={cn("platform pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-gutter pb-gutter", className)}
    >
      <section
        ref={card}
        role="dialog"
        lang={lang}
        aria-label={texts.label}
        tabIndex={-1}
        onKeyDown={(event) => {
          if (event.key === "Escape") onClose?.()
        }}
        className="pointer-events-auto relative flex w-full max-w-md animate-in flex-col gap-4 rounded-4xl bg-card p-5 text-sm text-card-foreground shadow-float ring-1 ring-foreground/10 duration-slow ease-standard outline-none fade-in-0 slide-in-from-bottom-2"
      >
        <div className={cn("flex flex-col gap-2", reopened && "pr-8")}>
          <p>{texts.body}</p>
          <p className="text-muted-foreground">
            {texts.extra}{" "}
            <a href={moreHref} className="text-foreground underline underline-offset-4 hover:no-underline">
              {texts.more}
            </a>
          </p>
        </div>
        <div className="flex gap-2">
          <Button className="flex-1" onClick={onRefuse}>
            {texts.refuse}
          </Button>
          <Button className="flex-1" onClick={onAccept}>
            {texts.accept}
          </Button>
        </div>
        {reopened && (
          <Button variant="ghost" size="icon-sm" className="absolute top-3 right-3" onClick={onClose}>
            <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
            <span className="sr-only">{texts.close}</span>
          </Button>
        )}
      </section>
    </div>
  )
}

export { CookieBanner, type CookieBannerProps, type CookieBannerTexts }
