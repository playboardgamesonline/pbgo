"use client"

import { Tick02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { ImagePlusIcon, XIcon } from "lucide-react"
import { useState } from "react"
import { optionGroup, optionHelpKey, optionLabelKey, type OptionValues } from "@pbgo/engine-kit"
import { Button } from "@pbgo/ui/platform/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@pbgo/ui/platform/dialog"
import { Input } from "@pbgo/ui/platform/input"
import { Slider } from "@pbgo/ui/platform/slider"
import { Spinner } from "@pbgo/ui/platform/spinner"
import { Switch } from "@pbgo/ui/platform/switch"
import { Textarea } from "@pbgo/ui/platform/textarea"
import { cn } from "@pbgo/ui/utils"
import { useBinding } from "../../lib/binding-context"
import { LOCALE_NAMES, LOCALES, type Locale } from "../../lib/i18n"
import { currentVolumes, playSound, setVolumes } from "../../lib/sound"
import { DEFAULT_REACTIONS, playReaction } from "../../lib/soundboard"
import { FEEDBACK_TYPES, useFeedback, type FeedbackType } from "../feedback"
import { displayOption } from "../game-settings"
import { useChooseLocale } from "../language-select"
import { useSiteSettings } from "../settings-provider"
import { useEngineTexts, useSkin, useText } from "../skin-provider"
import { setSoundEnabled, useSoundEnabled, useSounds } from "../sound/sound"

/**
 * The windows that the rows of the menu of a game's screen open, in the platform's look (the platform's `Dialog`, which carries the `platform` class itself since it is portaled). Each is controlled by the page that draws the menu,
 * which keeps them mounted when the menu closes. The same pieces exist in the game's look (`GameSettingsDialog`, `InfoDialog`, `FeedbackButton`) for the screens that are still drawn in it.
 */
type WindowProps = { open: boolean; onOpenChange: (open: boolean) => void }

const TITLE = "text-xl leading-tight"

type Channel = "music" | "ambience" | "effects" | "alerts" | "reactions"

/** The sound of the game: on or off, then one slider for each kind of sound the game has. */
export function SoundWindow({ open, onOpenChange }: WindowProps) {
  const t = useText()
  const on = useSoundEnabled()
  const sounds = useSounds()
  const [volumes, setLocal] = useState(currentVolumes)
  const rows: { key: Channel; label: string; show: boolean; preview: () => void }[] = [
    { key: "music", label: t("soundMusic"), show: Object.keys(sounds.music ?? {}).length > 0, preview: () => undefined },
    { key: "ambience", label: t("soundAmbience"), show: !!sounds.ambience, preview: () => undefined },
    { key: "effects", label: t("soundEffects"), show: Object.keys(sounds.effects).length > 0, preview: () => playSound("click") },
    { key: "alerts", label: t("soundAlerts"), show: true, preview: () => playSound("turn", { bus: "alerts" }) },
    { key: "reactions", label: t("soundReactions"), show: true, preview: () => playReaction(DEFAULT_REACTIONS[0]!) },
  ]
  const change = (key: Channel, value: number) => {
    setLocal((v) => ({ ...v, [key]: value }))
    setVolumes({ [key]: value })
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className={TITLE}>{t("soundTitle")}</DialogTitle>
          <DialogDescription className="sr-only">{t("soundSettings")}</DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-between gap-3">
          <span className="text-base">{on ? t("gameSettingsOn") : t("gameSettingsOff")}</span>
          <Switch checked={on} onCheckedChange={setSoundEnabled} aria-label={on ? t("soundOff") : t("soundOn")} />
        </div>
        <div className={cn("flex flex-col gap-5 transition-opacity", !on && "opacity-45")}>
          {rows
            .filter((row) => row.show)
            .map((row) => (
              <div key={row.key} className="mx-1 flex flex-col gap-2">
                <span className="text-sm text-muted-foreground">{row.label}</span>
                <Slider value={[volumes[row.key]]} min={0} max={1} step={0.01} aria-label={row.label} onValueChange={([value]) => change(row.key, value!)} onValueCommit={row.preview} />
              </div>
            ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** The language of the game: the ones it has, each in its own words, the one in use ticked. Choosing one closes the window and draws the page again in it. */
export function LanguageWindow({ open, onOpenChange }: WindowProps) {
  const t = useText()
  const { locale } = useSkin()
  const chooseLocale = useChooseLocale()
  const choose = (next: Locale) => {
    onOpenChange(false)
    void chooseLocale(next)
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className={TITLE}>{t("language")}</DialogTitle>
          <DialogDescription className="sr-only">{t("language")}</DialogDescription>
        </DialogHeader>
        <ul className="-mx-2 flex flex-col gap-0.5">
          {LOCALES.map((l) => (
            <li key={l}>
              <button
                type="button"
                lang={l}
                aria-current={l === locale}
                onClick={() => choose(l)}
                className="flex w-full cursor-pointer items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-base outline-none transition-colors hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/30"
              >
                <span className="flex-1">{LOCALE_NAMES[l]}</span>
                {l === locale && <HugeiconsIcon icon={Tick02Icon} strokeWidth={2} className="size-4" aria-hidden="true" />}
              </button>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  )
}

/** The setup of the game the table is playing, read-only: its parameters and its extensions (the options that the admin hides are not listed). */
export function SetupWindow({ open, onOpenChange, options }: WindowProps & { options: OptionValues }) {
  const t = useText()
  const { text: words, optional } = useEngineTexts()
  const { GAME } = useBinding()
  const { options: settings } = useSiteSettings()
  const entries = Object.entries(GAME?.options ?? {}).filter(([key]) => !settings.hidden.includes(key))
  const parameters = entries.filter(([, def]) => optionGroup(def) === "parameter")
  const extensions = entries.filter(([, def]) => optionGroup(def) === "extension")
  const standard = entries.every(([key, def]) => (options[key] ?? def.defaultValue) === def.defaultValue)
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className={TITLE}>{t("gameSettingsMenu")}</DialogTitle>
          <DialogDescription className="sr-only">{t("gameSettingsMenu")}</DialogDescription>
        </DialogHeader>
        {entries.length > 0 && standard && <p className="text-sm text-muted-foreground">{t("gameSettingsStandard")}</p>}
        {entries.length === 0 && <p className="text-sm text-muted-foreground">{t("gameSettingsNone")}</p>}
        {parameters.length > 0 && (
          <section className="flex flex-col gap-2">
            <h3 className="text-xs text-muted-foreground">{t("gameParameters")}</h3>
            <ul className="divide-y">
              {parameters.map(([key, def]) => (
                <li key={key} className="flex items-center justify-between gap-4 py-2.5 text-sm">
                  <span>{words(optionLabelKey(key), def.label)}</span>
                  <span className="font-strong tabular-nums">{displayOption(key, def, options[key] ?? def.defaultValue, t, words)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
        {extensions.length > 0 && (
          <section className="flex flex-col gap-2">
            <h3 className="text-xs text-muted-foreground">{t("gameExtensions")}</h3>
            <ul className="flex flex-col gap-2">
              {extensions.map(([key, def]) => {
                const active = options[key] === true
                const help = optional(optionHelpKey(key), def.help)
                return (
                  <li key={key} className={cn("flex items-center gap-3 rounded-2xl border p-3 text-sm", active ? "border-primary/50 bg-primary/10" : "opacity-50")}>
                    {def.icon && (
                      <span className="text-xl" aria-hidden="true">
                        {def.icon}
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-strong">{words(optionLabelKey(key), def.label)}</p>
                      {help && <p className="text-xs text-muted-foreground">{help}</p>}
                    </div>
                    <span className="shrink-0 text-xs">{active ? t("gameSettingsOn") : t("gameSettingsOff")}</span>
                  </li>
                )
              })}
            </ul>
          </section>
        )}
      </DialogContent>
    </Dialog>
  )
}

/** A plain text (the cookies, the legal notice): paragraphs split on blank lines, line breaks kept. */
export function TextWindow({ open, onOpenChange, title, text }: WindowProps & { title: string; text: string }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className={TITLE}>{title}</DialogTitle>
          <DialogDescription className="sr-only">{title}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 text-sm leading-relaxed text-foreground/80">
          {text.split(/\n{2,}/).map((paragraph, i) => (
            <p key={i} className="whitespace-pre-line">
              {paragraph}
            </p>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** The select of the feedback form: a native one, drawn like the platform's input. */
const SELECT =
  "h-9 w-full cursor-pointer rounded-xl border border-transparent bg-input/50 px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 md:text-sm [&>option]:bg-popover [&>option]:text-popover-foreground"

/** A word to the people who make the game: type, message, optional e-mail and screenshot. What it holds and how it is sent is `useFeedback`, the same as the game's window. */
export function FeedbackWindow({ open, onOpenChange, gameCode }: WindowProps & { gameCode?: string }) {
  const t = useText()
  const { type, setType, message, setMessage, email, setEmail, trap, setTrap, preview, removeScreenshot, sending, pick, send } = useFeedback({ gameCode, onSent: () => onOpenChange(false) })
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className={TITLE}>{t("feedbackTitle")}</DialogTitle>
          <DialogDescription className="sr-only">{t("feedbackButton")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={send} autoComplete="off" className="flex flex-col gap-3">
          <select aria-label={t("feedbackType")} value={type} onChange={(e) => setType(e.target.value as FeedbackType)} className={SELECT}>
            {FEEDBACK_TYPES.map((o) => (
              <option key={o.value} value={o.value}>
                {t(o.text)}
              </option>
            ))}
          </select>
          <Textarea
            autoFocus
            required
            value={message}
            maxLength={2000}
            onChange={(e) => setMessage(e.target.value)}
            onPaste={(e) => {
              const image = [...e.clipboardData.files].find((f) => f.type.startsWith("image/"))
              if (image) {
                e.preventDefault()
                void pick(image)
              }
            }}
            placeholder={t("feedbackPlaceholder")}
            className="min-h-32"
          />
          <Input type="email" inputMode="email" autoComplete="email" maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("feedbackEmail")} />
          {/* Honeypot: invisible to humans, filled in by bots */}
          <input tabIndex={-1} aria-hidden autoComplete="off" name="website" value={trap} onChange={(e) => setTrap(e.target.value)} className="absolute -left-[9999px] h-0 w-0 opacity-0" />
          {preview ? (
            <div className="relative w-fit">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt="" className="max-h-32 rounded-xl border" />
              <Button type="button" variant="secondary" size="icon-xs" aria-label={t("feedbackScreenshotRemove")} title={t("feedbackScreenshotRemove")} onClick={removeScreenshot} className="absolute -top-2 -right-2 rounded-full">
                <XIcon aria-hidden="true" />
              </Button>
            </div>
          ) : (
            <label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-lg py-1 text-sm text-muted-foreground transition-colors hover:text-foreground">
              <ImagePlusIcon className="size-4.5" strokeWidth={1.8} aria-hidden="true" />
              {t("feedbackScreenshotAdd")}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                onChange={(e) => {
                  void pick(e.target.files?.[0])
                  e.target.value = ""
                }}
              />
            </label>
          )}
          <Button type="submit" size="xl" disabled={!message.trim() || sending} className="mt-1">
            {sending && <Spinner />}
            {t("feedbackSend")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
