"use client"

import type { RulesContent } from "../lib/rules"
import { FeedbackButton } from "./feedback"
import { LanguageSelect } from "./language-select"
import { GameRulesButton as RulesButton } from "./rules-slot"
import { SoundButton } from "./sound/sound"

/** Règles, son | langue, feedback : les deux premiers concernent le jeu, les deux derniers le site (d'où le séparateur). */
export function Toolbar({ rules, gameCode }: { rules?: RulesContent; gameCode?: string }) {
  return (
    <>
      {rules && <RulesButton rules={rules} />}
      <SoundButton />
      <span aria-hidden className="mx-1 h-5 w-px bg-foreground/35" />
      <LanguageSelect />
      <FeedbackButton gameCode={gameCode} />
    </>
  )
}
