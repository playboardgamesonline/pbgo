import type { UiTextKey } from "@pbgo/studio-kit/constants"
import { describe, expect, it } from "vitest"
import type { GameBinding } from "./binding"
import type { Locale } from "./i18n"
import { baseSkin, fill } from "./skin"
import { DEFAULT_REACTIONS, gameReactions, reactionLabel, type Reaction } from "./soundboard"

/** What `useText()` returns for a visitor of that language (a game without its own texts). */
function textsOf(locale: Locale) {
  const { texts } = baseSkin({} as GameBinding, locale)
  return (key: UiTextKey) => fill(texts[key])
}

const play = () => {}

// order of DEFAULT_REACTIONS: clap, laugh, wow, party, evil, sad, fire, love
const BUILT_IN_LABELS: Record<Locale, string[]> = {
  fr: ["Bravo", "Haha", "Oh !", "Fête", "Muahaha", "Snif", "Feu", "Love"], // the labels the reactions had before they were translated
  en: ["Bravo", "Haha", "Oh!", "Party", "Muahaha", "Sniff", "Fire", "Love"],
  es: ["Bravo", "Jaja", "¡Oh!", "Fiesta", "Muajaja", "Snif", "Fuego", "Amor"],
  de: ["Bravo", "Haha", "Oh!", "Party", "Muahaha", "Schnief", "Feuer", "Liebe"],
}

describe("built-in reactions", () => {
  it.each(Object.keys(BUILT_IN_LABELS) as Locale[])("are labelled in the visitor's language (%s)", (locale) => {
    expect(DEFAULT_REACTIONS.map((r) => reactionLabel(r, textsOf(locale)))).toEqual(BUILT_IN_LABELS[locale])
  })

  it("ask for a shared text, not for a label of their own", () => {
    for (const r of DEFAULT_REACTIONS) {
      expect(r.labelKey).toMatch(/^reaction[A-Z]/)
      expect(r.label).toBeUndefined()
    }
  })
})

describe("a game's own reactions", () => {
  const own: Reaction[] = [
    { id: "clap", emoji: "🙌", label: "Yay", play },
    { id: "gong", emoji: "🔔", label: "Gong", play },
  ]
  const labelsIn = (locale: Locale, reactions: Reaction[]) => Object.fromEntries(reactions.map((r) => [r.id, reactionLabel(r, textsOf(locale))]))

  it("replace a built-in one and add the others, with their label shown as written, in every language", () => {
    const reactions = gameReactions(own)
    expect(reactions.map((r) => r.id)).toEqual(["clap", "laugh", "wow", "party", "evil", "sad", "fire", "love", "gong"])
    for (const locale of Object.keys(BUILT_IN_LABELS) as Locale[]) {
      expect(labelsIn(locale, reactions)).toMatchObject({ clap: "Yay", gong: "Gong" })
    }
  })

  it("leave the other built-in reactions translated", () => {
    const reactions = gameReactions(own)
    expect(labelsIn("de", reactions)).toMatchObject({ fire: "Feuer", love: "Liebe" })
    expect(labelsIn("fr", reactions)).toMatchObject({ fire: "Feu", love: "Love" })
  })

  it("can borrow a shared text through labelKey", () => {
    const reactions = gameReactions([{ id: "gong", emoji: "🔔", labelKey: "reactionFire", play }])
    expect(labelsIn("es", reactions).gong).toBe("Fuego")
  })
})
