"use client"

import * as React from "react"
import { Cancel01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { cn } from "../utils"
import { Button } from "./button"
import { Switch } from "./switch"

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
  /** Opens the choices one by one; also the title of that view. */
  customize: string
  /** The words of the link that ends the sentence and leads to the policy. */
  more: string
  close: string
  essential: string
  essentialBody: string
  analytics: string
  analyticsBody: string
  recordings: string
  recordingsBody: string
  /** Keeps the choices as the switches are set. */
  save: string
  /** Back to the card, nothing kept. */
  back: string
}

/** What the visitor lets the site do beyond what it needs to work: the switches of the preferences. A recording needs the analytics it hangs on. */
type CookiePreferences = {
  analytics: boolean
  recordings: boolean
}

const NOTHING: CookiePreferences = { analytics: false, recordings: false }

type CookieBannerProps = {
  texts: CookieBannerTexts
  /** Where the link of `texts.more` leads: the part of the legal notice about cookies and statistics. */
  moreHref: string
  /** The language of `texts`, when it can differ from the page's (the hub is rendered in English for every visitor). */
  lang?: string
  /** How the switches stand when the preferences open: what the visitor answered before, else nothing allowed. */
  preferences?: CookiePreferences
  onAccept(): void
  onRefuse(): void
  /** The visitor kept the preferences as the switches are set. */
  onSave(preferences: CookiePreferences): void
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
 * The consent banner: a wide card that floats over the bottom of the screen, centred, with a title and a sentence that ends with a
 * link to the policy on its side, and three small buttons on the other: Reject optional (ghost), Manage preferences (outline) and
 * Accept all, from the least to the most pushed. Refusing is one press away like accepting, the same size on the same line. From
 * `lg` the card is a bar (the words, then the buttons); under it the words are over the buttons, which keep to the right, and on a
 * phone they share the width of the card (two on a line, then the last). The card never grows taller than the window: past that its content scrolls.
 *
 * Manage preferences swaps the card's content for the choices one by one, in a list of switches: the essential cookies (always on),
 * the analytics (an identifier kept on the device) and the recordings, which need the analytics, then Back and Save. Nothing is
 * pre-ticked: the switches open on what the visitor answered before, else on nothing allowed.
 *
 * It is `fixed`, but it must never sit over what the page shows. It floats inside a box that holds its margin (`px-4 pb-4`, `px-6 pb-6` from
 * `sm`: its own, since the page's gutter is 64px on a desktop), and the caller measures that box and makes the room (`@pbgo/analytics` publishes its height as `--consent-h`, see
 * `reserve.ts`), so a page has nothing under the card, whether it is a hub page that scrolls or a game screen that fills the
 * viewport.
 *
 * A game page is not `.platform`, so the banner carries the class itself, the way a portal does. The words and the answers come
 * from the caller, which owns the stored choice.
 */
function CookieBanner({ texts, moreHref, lang, preferences = NOTHING, onAccept, onRefuse, onSave, onClose, className, ref }: CookieBannerProps) {
  const card = React.useRef<HTMLElement>(null)
  const titleId = React.useId()
  const reopened = onClose !== undefined
  const [view, setView] = React.useState<"card" | "preferences">("card")
  const [choices, setChoices] = React.useState<CookiePreferences>(preferences)
  const moved = React.useRef(false)

  // A banner the visitor reopened gets the focus, or a keyboard user would tab through the whole page to find it
  React.useEffect(() => {
    if (reopened) card.current?.focus({ preventScroll: true })
  }, [reopened])

  // So does the card when its content is swapped, for a screen reader to say the new title: not on the first render
  React.useEffect(() => {
    if (moved.current) card.current?.focus({ preventScroll: true })
  }, [view])

  function go(next: "card" | "preferences") {
    moved.current = true
    if (next === "preferences") setChoices(preferences)
    setView(next)
  }

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
          if (event.key !== "Escape") return
          if (view === "preferences") go("card")
          else onClose?.()
        }}
        className={cn(
          "pointer-events-auto relative mx-auto flex max-h-[calc(100dvh-2rem)] w-full max-w-4xl animate-in flex-col overflow-y-auto rounded-4xl bg-card p-4 text-card-foreground shadow-float ring-1 ring-foreground/10 duration-slow ease-standard outline-none fade-in-0 slide-in-from-bottom-4 sm:p-5 lg:p-6",
          reopened && "lg:pr-16"
        )}
      >
        {reopened && (
          <Button variant="ghost" size="icon-sm" className="absolute top-3 right-3" onClick={onClose}>
            <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
            <span className="sr-only">{texts.close}</span>
          </Button>
        )}
        {view === "card" ? (
          <div key="card" className="flex animate-in flex-col gap-3 duration-slow ease-standard fade-in-0 sm:gap-4 lg:flex-row lg:items-center lg:gap-8">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
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
            <div className="flex flex-wrap gap-2 sm:justify-end lg:shrink-0 lg:flex-nowrap">
              <Button variant="ghost" size="sm" className="max-sm:flex-1" onClick={onRefuse}>
                {texts.refuse}
              </Button>
              <Button variant="outline" size="sm" className="max-sm:flex-1" onClick={() => go("preferences")}>
                {texts.customize}
              </Button>
              <Button size="sm" className="max-sm:flex-1" onClick={onAccept}>
                {texts.accept}
              </Button>
            </div>
          </div>
        ) : (
          <div key="preferences" className="flex animate-in flex-col gap-4 duration-slow ease-standard fade-in-0">
            <h2 id={titleId} className={cn("font-heading text-base", reopened && "pr-8 lg:pr-0")}>
              {texts.customize}
            </h2>
            <ul className="flex flex-col divide-y divide-border">
              <PreferenceRow label={texts.essential} body={texts.essentialBody} checked disabled />
              <PreferenceRow
                label={texts.analytics}
                body={texts.analyticsBody}
                checked={choices.analytics}
                onCheckedChange={(on) => setChoices({ analytics: on, recordings: on && choices.recordings })}
              />
              <PreferenceRow
                label={texts.recordings}
                body={texts.recordingsBody}
                checked={choices.recordings}
                disabled={!choices.analytics}
                onCheckedChange={(on) => setChoices({ ...choices, recordings: on })}
              />
            </ul>
            <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
              <a href={moreHref} className="text-sm text-foreground underline underline-offset-4 hover:no-underline">
                {texts.more}
              </a>
              <div className="flex gap-2 max-sm:w-full [&>*]:max-sm:flex-1">
                <Button variant="ghost" size="sm" onClick={() => go("card")}>
                  {texts.back}
                </Button>
                <Button size="sm" onClick={() => onSave(choices)}>
                  {texts.save}
                </Button>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}

/** One choice of the preferences: what it is and what it does, then its switch. */
function PreferenceRow({
  label,
  body,
  checked,
  disabled,
  onCheckedChange,
}: {
  label: string
  body: string
  checked: boolean
  disabled?: boolean
  onCheckedChange?(checked: boolean): void
}) {
  const id = React.useId()
  return (
    <li className="flex items-start justify-between gap-6 py-3 first:pt-0 last:pb-3">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span id={`${id}-label`} className="font-heading text-sm">
          {label}
        </span>
        <span id={`${id}-body`} className="text-sm text-muted-foreground">
          {body}
        </span>
      </div>
      <Switch
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
        aria-labelledby={`${id}-label`}
        aria-describedby={`${id}-body`}
        className="mt-0.5"
      />
    </li>
  )
}

export { CookieBanner, type CookieBannerProps, type CookieBannerTexts, type CookiePreferences }
