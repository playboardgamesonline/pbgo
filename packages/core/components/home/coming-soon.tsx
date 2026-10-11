"use client"

import { motion } from "motion/react"
import { useBinding } from "../../lib/binding-context"
import { useSkin, useText } from "../skin-provider"
import { Paragraph, PrimaryLink, Screen } from "./screen"

/** Home of a game that cannot be played yet (no engine, or not live in production): its look, a short note and a link to every game. */
export function ComingSoon() {
  const t = useText()
  const { home } = useSkin()
  const { TAGLINE } = useBinding()
  return (
    <Screen
      feedback={false}
      cta={<PrimaryLink href="/">{t("allGames")}</PrimaryLink>}
      below={<p className="max-w-md text-center text-sm text-foreground/75 [text-shadow:0_1px_6px_rgb(0_0_0/60%)]">{t("comingSoonHint")}</p>}
    >
      <Paragraph>{home.tagline ?? TAGLINE}</Paragraph>
      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="mt-[5vh] shrink-0 px-4 text-center font-display text-2xl tracking-wide uppercase [text-shadow:0_1px_6px_rgb(0_0_0/60%)] md:text-3xl"
      >
        {t("comingSoon")}
      </motion.p>
    </Screen>
  )
}
