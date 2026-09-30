"use client"

import type { RulesContent } from "../lib/rules"
import { FeedbackButton } from "./feedback"
import { GameRulesButton as RulesButton } from "./rules-slot"
import { SoundButton } from "./sound/sound"

/** Règles, son | feedback : les deux premiers concernent le jeu, le dernier le site (d'où le séparateur). */
export function Toolbar({ rules, gameCode }: { rules?: RulesContent; gameCode?: string }) {
  return (
    <>
      {rules && <RulesButton rules={rules} />}
      <SoundButton />
      <span aria-hidden className="mx-1 h-5 w-px bg-foreground/35" />
      <FeedbackButton gameCode={gameCode} />
    </>
  )
}
