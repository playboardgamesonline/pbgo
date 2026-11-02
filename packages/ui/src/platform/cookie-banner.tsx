"use client"

import * as React from "react"
import { Cancel01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { cn } from "../utils"
import { Button } from "./button"
import { Switch } from "./switch"

/** What the banner says, in the visitor's language: the caller picks the language, the banner only shows the words. */
type CookieBannerTexts = {
  /** The title of the card, in both of its views, which is also its accessible name. */
  label: string
  /** What the cookies are for, ending on the words that lead into the link. */
  body: string
  /** Allows everything. */
  accept: string
  /** Refuses everything that is optional. */
  refuse: string
  /** Opens the choices one by one. */
  customize: string
  /** The words of the link that ends the sentence and leads to the policy: the banner puts the full stop after it. */
  more: string
  close: string
  /** The sentence of the choices, which ends on the words that lead into the same link. */
  intro: string
  necessary: string
  necessaryBody: string
  analytics: string
  analyticsBody: string
  marketing: string
  marketingBody: string
  /** What stands beside a switch: the word for what the site needs (always on), then the two a switch of the visitor can show. */
  required: string
  on: string
  off: string
  /** Keeps the choices as the switches are set. */
  save: string
  /** Back to the card, nothing kept. */
  back: string
}

/** What the visitor lets the site do beyond what it needs to work: the switches of the choices. */
type CookiePreferences = {
  analytics: boolean
  marketing: boolean
}

const NOTHING: CookiePreferences = { analytics: false, marketing: false }

type CookieBannerProps = {
  texts: CookieBannerTexts
  /** Where the links of `texts.more` lead: the cookie policy. */
  moreHref: string
  /** The language of `texts`, when it can differ from the page's (the hub is rendered in English for every visitor). */
  lang?: string
  /** How the switches stand when the choices open: what the visitor answered before, else all off. */
  preferences?: CookiePreferences
  /** The view the card opens on, for a specimen or a test; a visitor always starts on the bar. */
  defaultView?: "bar" | "preferences"
  onAccept(): void
  onRefuse(): void
  /** The visitor kept the choices as the switches are set. */
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

/** The three buttons of the bar are the same size and the same shape, 2.5rem high: refusing is as easy to hit as accepting, whatever their fill. */
const ANSWER = "h-10 rounded-2xl px-4 text-sm lg:px-5"

/**
 * The consent banner: a wide card that floats over the bottom of the screen, centred, with a title and a sentence that ends with a
 * link to the policy on its side, and three buttons on the other, the way Claude's has them: Customize (secondary, the grey one) over
 * Reject optional (secondary) and Accept all (the plain one). They are the same size and the same shape, so refusing is as easy to hit as
 * accepting. From `lg` the card is a bar (the words, then the buttons, centred on its height, the block as wide as its longest label);
 * under it the words are over the buttons, which take the width of the card.
 *
 * Customize swaps the card's content for the choices one by one, in a list of switches: what the site needs (always on), the analytics
 * (an identifier kept on the device, and the recordings that hang on it) and the marketing, then Back and Save. Nothing is pre-ticked: the
 * switches open on what the visitor answered before, else off. The site has no marketing cookie yet, but the switch is real and its answer
 * is kept, for the day one comes. The card never grows taller than the window: past that its content scrolls.
 *
 * It is `fixed`, but it must never sit over what the page shows. It floats inside a box that holds its margin (`px-4 pb-4`, `px-6 pb-6` from
 * `sm`: its own, since the page's gutter is 64px on a desktop), and the caller measures that box and makes the room (`@pbgo/analytics` publishes its height as `--consent-h`, see
 * `reserve.ts`), so a page has nothing under the card, whether it is a hub page that scrolls or a game screen that fills the
 * viewport. The box is measured again when the choices open, which are taller than the bar.
 *
 * A game page is not `.platform`, so the banner carries the class itself, the way a portal does. The words and the answers come
 * from the caller, which owns the stored choice.
 */
function CookieBanner({
  texts,
  moreHref,
  lang,
  preferences = NOTHING,
  defaultView = "bar",
  onAccept,
  onRefuse,
  onSave,
  onClose,
  className,
  ref,
}: CookieBannerProps) {
  const card = React.useRef<HTMLElement>(null)
  const titleId = React.useId()
  const reopened = onClose !== undefined
  const [view, setView] = React.useState<"bar" | "preferences">(defaultView)
  const [choices, setChoices] = React.useState<CookiePreferences>(preferences)
  const moved = React.useRef(false)

  // A banner the visitor reopened gets the focus, or a keyboard user would tab through the whole page to find it
  React.useEffect(() => {
    if (reopened) card.current?.focus({ preventScroll: true })
  }, [reopened])

  // So does the card when its content is swapped, for a screen reader to say where it is: not on the first render
  React.useEffect(() => {
    if (moved.current) card.current?.focus({ preventScroll: true })
  }, [view])

  function go(next: "bar" | "preferences") {
    moved.current = true
    if (next === "preferences") setChoices(preferences)
    setView(next)
  }

  const policy = (
    <>
      <a href={moreHref} className="text-foreground underline underline-offset-4 hover:no-underline">
        {texts.more}
      </a>
      .
    </>
  )

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
          if (view === "preferences") go("bar")
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
        {view === "bar" ? (
          <div key="bar" className="flex flex-col gap-3 sm:gap-4 lg:flex-row lg:items-center lg:gap-8">
            <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
              <h2 id={titleId} className={cn("font-heading text-base", reopened && "pr-8 lg:pr-0")}>
                {texts.label}
              </h2>
              <p className="text-sm text-muted-foreground">
                {texts.body} {policy}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 lg:w-max lg:shrink-0">
              <Button variant="secondary" size="lg" className={cn(ANSWER, "col-span-2")} onClick={() => go("preferences")}>
                {texts.customize}
              </Button>
              <Button variant="secondary" size="lg" className={ANSWER} onClick={onRefuse}>
                {texts.refuse}
              </Button>
              <Button size="lg" className={ANSWER} onClick={onAccept}>
                {texts.accept}
              </Button>
            </div>
          </div>
        ) : (
          <div key="preferences" className="flex animate-in flex-col gap-4 duration-slow ease-standard fade-in-0 lg:flex-row lg:gap-10">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <h2 id={titleId} className={cn("font-heading text-base", reopened && "pr-8 lg:pr-0")}>
                {texts.label}
              </h2>
              <p className="text-sm text-muted-foreground">
                {texts.intro} {policy}
              </p>
            </div>
            <div className="flex flex-col gap-4 lg:w-[36rem] lg:shrink-0">
              <ul className="flex flex-col divide-y divide-border">
                <PreferenceRow label={texts.necessary} body={texts.necessaryBody} status={texts.required} checked disabled />
                <PreferenceRow
                  label={texts.analytics}
                  body={texts.analyticsBody}
                  status={choices.analytics ? texts.on : texts.off}
                  checked={choices.analytics}
                  onCheckedChange={(on) => setChoices({ ...choices, analytics: on })}
                />
                <PreferenceRow
                  label={texts.marketing}
                  body={texts.marketingBody}
                  status={choices.marketing ? texts.on : texts.off}
                  checked={choices.marketing}
                  onCheckedChange={(on) => setChoices({ ...choices, marketing: on })}
                />
              </ul>
              <div className="flex gap-2 max-sm:[&>*]:flex-1 sm:justify-end">
                <Button variant="ghost" size="lg" className={ANSWER} onClick={() => go("bar")}>
                  {texts.back}
                </Button>
                <Button size="lg" className={ANSWER} onClick={() => onSave(choices)}>
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

/** One choice of the card: what it is and what it does, then what stands for it (the word beside its switch) and the switch. */
function PreferenceRow({
  label,
  body,
  status,
  checked,
  disabled,
  onCheckedChange,
}: {
  label: string
  body: string
  status: string
  checked: boolean
  disabled?: boolean
  onCheckedChange?(checked: boolean): void
}) {
  const id = React.useId()
  return (
    <li className="flex items-center justify-between gap-6 py-3 first:pt-0 last:pb-0">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span id={`${id}-label`} className="font-heading text-base">
          {label}
        </span>
        <span id={`${id}-body`} className="text-sm text-muted-foreground">
          {body}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span className="text-sm text-muted-foreground">{status}</span>
        <Switch
          checked={checked}
          disabled={disabled}
          onCheckedChange={onCheckedChange}
          aria-labelledby={`${id}-label`}
          aria-describedby={`${id}-body`}
        />
      </div>
    </li>
  )
}

export { CookieBanner, type CookieBannerProps, type CookieBannerTexts, type CookiePreferences }
