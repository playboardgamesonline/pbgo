import { SparklesIcon } from "@sanity/icons/Sparkles"
import { defineField, defineType } from "sanity"
import { BONUS_TILE_NUMBERS, BONUS_TILES, titleOf } from "./constants"

// The tiles of the 5 Flamboyants extension: face down, one is revealed each time a firework is completed with a 5.
// Studio form rules (skill `game-sanity-create`): no Effect or Rule field, no `description`, English game key, the visual is the last field
export const bonusTile = defineType({
  name: "bonusTile",
  title: "Bonus tile",
  type: "document",
  icon: SparklesIcon,
  fields: [
    defineField({ name: "key", title: "Game key", type: "string", options: { list: BONUS_TILES, layout: "dropdown" }, validation: (r) => r.required() }),
    defineField({ name: "number", title: "Number", type: "number", options: { list: BONUS_TILE_NUMBERS.map((n) => ({ title: String(n), value: n })) }, validation: (r) => r.required() }),
    defineField({ name: "name", title: "Name", type: "localeString" }),
    defineField({ name: "icon", title: "Visual", type: "image" }),
  ],
  orderings: [{ name: "number", title: "Number", by: [{ field: "number", direction: "asc" }] }],
  preview: {
    select: { key: "key", number: "number", media: "icon" },
    prepare: ({ key, number, media }) => ({ title: titleOf(BONUS_TILES, key) ?? `Tile ${number ?? "?"}`, subtitle: `Tile ${number ?? "?"}`, media }),
  },
})
