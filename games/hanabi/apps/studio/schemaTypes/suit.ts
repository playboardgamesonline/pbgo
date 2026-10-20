import { ColorWheelIcon } from "@sanity/icons/ColorWheel"
import { defineField, defineType } from "sanity"
import { DIRECTIONS, EXTENSIONS, PATTERNS, SUITS, titleOf } from "./constants"

// The colors of the deck, listed once with their symbols: a card picks its color by key.
// Studio form rules (skill `game-sanity-create`): no `description`, English game key, the visual is the last field
export const suit = defineType({
  name: "suit",
  title: "Color",
  type: "document",
  icon: ColorWheelIcon,
  fields: [
    defineField({ name: "key", title: "Game key", type: "string", options: { list: SUITS, layout: "dropdown" }, validation: (r) => r.required() }),
    defineField({ name: "name", title: "Name", type: "localeString" }),
    defineField({
      name: "color",
      title: "Hex code",
      type: "string",
      validation: (r) => r.required().regex(/^#[0-9a-fA-F]{6}$/, { name: "hex" }).error("Main color as #RRGGBB (the multicolor color gets a flat fallback)"),
    }),
    defineField({ name: "extension", title: "Comes from", type: "string", options: { list: EXTENSIONS, layout: "radio" }, initialValue: "base", validation: (r) => r.required() }),
    defineField({ name: "direction", title: "Firework order", type: "string", options: { list: DIRECTIONS, layout: "radio" }, initialValue: "ascending", validation: (r) => r.required() }),
    defineField({ name: "symbol", title: "Shape", type: "string", validation: (r) => r.required() }),
    defineField({ name: "letter", title: "Letter on the cards", type: "string", validation: (r) => r.required().length(1).error("One letter") }),
    defineField({ name: "pattern", title: "Pattern", type: "string", options: { list: PATTERNS, layout: "dropdown" }, initialValue: "none", validation: (r) => r.required() }),
    defineField({ name: "symbolImage", title: "Symbol", type: "image" }),
  ],
  preview: {
    select: { key: "key", color: "color", media: "symbolImage" },
    prepare: ({ key, color, media }) => ({ title: titleOf(SUITS, key) ?? key, subtitle: color, media }),
  },
})
