import { SparklesIcon } from "@sanity/icons/Sparkles"
import { defineField, defineType } from "sanity"
import { BONUS_TILE_NUMBERS } from "./constants"

// The tiles of the 5 Flamboyants extension: face down, one is revealed each time a firework is completed with a 5
export const bonusTile = defineType({
  name: "bonusTile",
  title: "Bonus tile",
  type: "document",
  icon: SparklesIcon,
  fields: [
    defineField({ name: "number", title: "Number", type: "number", options: { list: BONUS_TILE_NUMBERS.map((n) => ({ title: String(n), value: n })) }, validation: (r) => r.required() }),
    defineField({ name: "name", title: "Name", type: "localeString" }),
    defineField({ name: "effect", title: "Effect", description: "What the tile does when it is revealed", type: "localeText" }),
    defineField({ name: "icon", title: "Icon", type: "image" }),
  ],
  orderings: [{ name: "number", title: "Number", by: [{ field: "number", direction: "asc" }] }],
  preview: {
    select: { number: "number", name: "name.fr", media: "icon" },
    prepare: ({ number, name, media }) => ({ title: name ?? `Tile ${number ?? "?"}`, subtitle: `Tile ${number ?? "?"}`, media }),
  },
})
