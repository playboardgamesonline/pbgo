"use client"

import { SquareArrowUpRight02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useState, type ReactNode } from "react"
import { reopenConsent, trackClient, useReporting } from "@pbgo/analytics/client"
import type { OptionValues } from "@pbgo/engine-kit"
import { initials } from "@pbgo/ui/friends"
import { Avatar, AvatarFallback } from "@pbgo/ui/platform/avatar"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@pbgo/ui/platform/dropdown-menu"
import { PresenceDot } from "@pbgo/ui/platform/friends-panel"
import { useBinding } from "../../lib/binding-context"
import { LOCALE_NAMES, LOCALES } from "../../lib/i18n"
import { useSiteSettings } from "../settings-provider"
import { useSkin, useText } from "../skin-provider"
import { useSoundEnabled, useSounds } from "../sound/sound"
import { useGame } from "./context"
import { FeedbackWindow, LanguageWindow, SetupWindow, SoundWindow, TextWindow } from "./game-windows"
import { HudBar, type HudMenu } from "./hud-dock"

type Shown = "sound" | "language" | "setup" | "cookies" | "legal" | "feedback"

/** What a row is set to, at its end. */
function Value({ children }: { children: ReactNode }) {
  return <span className="ml-auto text-xs text-muted-foreground">{children}</span>
}

/**
 * What a player does about the game rather than in it, as the rows of the menu of their picture at the top right of the screen, in the platform's look, each one apart, in two groups by who is looking. `game` is for everyone: the
 * sound, the setup of the game, its rules, a word to the people who make it, and the way out (in red, last). `site` is what a member finds in their account, where it is kept for them (their language, the cookies, the legal notice) and
 * a guest, who has no account, finds here: only the bar of a guest draws it (`GuestDock`). The sound, the setup, the feedback, the language, the cookies and the legal notice open a window (`game-windows.tsx`), the rules open their PDF
 * in a new tab, and the cookies reopen the choice of the banner where analytics are active. The rows go in a `DropdownMenuContent` that the app draws (`HudMenu`), and the windows beside it.
 */
export function useGameMenu({ gameCode, options, onLeave }: { gameCode: string; options: OptionValues; onLeave: () => void }): HudMenu {
  const t = useText()
  const { SLUG, AUTHOR, CONTACT } = useBinding()
  const { locale } = useSkin()
  const { credits, rulesPdf } = useSiteSettings()
  const reporting = useReporting()
  const sounds = useSounds()
  const soundOn = useSoundEnabled()
  const [shown, setShown] = useState<Shown | null>(null)
  const hasSounds = Object.keys(sounds.effects).length > 0 || !!sounds.music || !!sounds.ambience
  // rules: link to the PDF in the player's language, else the English one, then the first available
  const rulesUrl = [locale, "en" as const, ...LOCALES].map((l) => rulesPdf[l]).find((u): u is string => !!u) ?? null
  const legalText = t("legalBody", { publisher: credits.publisher ?? AUTHOR.name, authors: credits.authors ?? AUTHOR.name, contact: CONTACT })
  // Where analytics are active this row is the way back to the choice of the banner; elsewhere it explains the storage.
  const openCookies = () => (reporting ? reopenConsent() : setShown("cookies"))
  const windowOf = (name: Shown) => ({ open: shown === name, onOpenChange: (open: boolean) => setShown(open ? name : null) })

  const game = (
    <>
      {hasSounds && (
        <DropdownMenuItem onSelect={() => setShown("sound")}>
          {t("soundTitle")}
          <Value>{soundOn ? t("gameSettingsOn") : t("gameSettingsOff")}</Value>
        </DropdownMenuItem>
      )}
      <DropdownMenuItem onSelect={() => setShown("setup")}>{t("gameSettingsMenu")}</DropdownMenuItem>
      {rulesUrl && (
        <DropdownMenuItem asChild>
          <a href={rulesUrl} target="_blank" rel="noopener noreferrer" onClick={() => trackClient("rules_opened", { game: SLUG })}>
            {t("rulesTitle")}
            <HugeiconsIcon icon={SquareArrowUpRight02Icon} strokeWidth={2} aria-hidden="true" className="ml-auto size-3.5 text-muted-foreground" />
          </a>
        </DropdownMenuItem>
      )}
      <DropdownMenuItem onSelect={() => setShown("feedback")}>{t("feedbackButton")}</DropdownMenuItem>
      <DropdownMenuItem variant="destructive" onSelect={onLeave}>
        {t("leave")}
      </DropdownMenuItem>
    </>
  )
  const site = (
    <>
      <DropdownMenuItem onSelect={() => setShown("language")}>
        {t("language")}
        <Value>{LOCALE_NAMES[locale]}</Value>
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={openCookies}>{t("cookiesMenu")}</DropdownMenuItem>
      <DropdownMenuItem onSelect={() => setShown("legal")}>{t("legalMenu")}</DropdownMenuItem>
    </>
  )
  const windows = (
    <>
      {hasSounds && <SoundWindow {...windowOf("sound")} />}
      <LanguageWindow {...windowOf("language")} />
      <SetupWindow {...windowOf("setup")} options={options} />
      <TextWindow {...windowOf("cookies")} title={t("cookiesMenu")} text={t("cookiesBody")} />
      <TextWindow {...windowOf("legal")} title={t("legalMenu")} text={legalText} />
      <FeedbackWindow {...windowOf("feedback")} gameCode={gameCode} />
    </>
  )
  return { game, site, windows }
}

/**
 * What a visitor who is not signed in has at the top right: no friends to show, so no dock, but their picture, in a bar of its own, opens the menu of the game, then what a member has in their account (`site`: the language, the
 * cookies, the legal notice). Nothing of an account is offered, not even to sign in. Its head is the player's: their picture (their initials), their nickname at the table and that they are a guest.
 */
export function GuestDock({ menu }: { menu: HudMenu }) {
  const t = useText()
  const { game } = useGame()
  const me = game.players.find((player) => player.id === game.meId)
  const name = me?.nickname ?? t("guest")
  return (
    <>
      <HudBar>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={t("menu")}
              className="flex size-10 cursor-pointer items-center justify-center rounded-xl outline-none transition-colors hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/30 data-[state=open]:bg-muted/50"
            >
              <Avatar>
                <AvatarFallback className="ph-mask">{initials(name)}</AvatarFallback>
                <PresenceDot status="online" />
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72">
            <DropdownMenuLabel className="flex flex-col items-start gap-3 px-2 pt-2 pb-1.5">
              <Avatar size="xl">
                <AvatarFallback className="ph-mask">{initials(name)}</AvatarFallback>
                <PresenceDot status="online" />
              </Avatar>
              <span className="flex max-w-full flex-col gap-0.5">
                <span className="ph-mask truncate text-base text-foreground">{name}</span>
                <span className="truncate text-xs">{t("guest")}</span>
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {menu.game}
            <DropdownMenuSeparator />
            {menu.site}
          </DropdownMenuContent>
        </DropdownMenu>
      </HudBar>
      {menu.windows}
    </>
  )
}
