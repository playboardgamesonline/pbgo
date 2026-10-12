"use client"

import { useBinding } from "../../lib/binding-context"
import { useText } from "../skin-provider"
import { Headline, PrimaryLink, Screen } from "./screen"

/** 404 inside a game (its look, a short note, a link to its home): a table, an admin section or a preview that does not exist here. */
export function PageNotFound() {
  const t = useText()
  const { SLUG } = useBinding()
  return (
    <Screen feedback={false} cta={<PrimaryLink href={`/${SLUG}`}>{t("backHome")}</PrimaryLink>}>
      <Headline>{t("pageNotFound")}</Headline>
    </Screen>
  )
}
