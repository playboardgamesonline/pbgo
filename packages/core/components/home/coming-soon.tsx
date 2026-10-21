"use client"

import { useSkin, useText } from "../skin-provider"
import { Headline, Paragraph, PrimaryLink, Screen } from "./screen"

/** Home of a game that cannot be played yet (no engine, or not live in production): its look, a short note and a link to every game. */
export function ComingSoon() {
  const t = useText()
  const { home } = useSkin()
  return (
    <Screen
      feedback={false}
      cta={<PrimaryLink href="/">{t("allGames")}</PrimaryLink>}
      below={<p className="max-w-md text-center text-sm text-foreground/75 [text-shadow:0_1px_6px_rgb(0_0_0/60%)]">{t("comingSoonHint")}</p>}
    >
      <Paragraph>{home.tagline}</Paragraph>
      <Headline>{t("comingSoon")}</Headline>
    </Screen>
  )
}
