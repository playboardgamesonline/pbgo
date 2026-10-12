import { ColorWheelIcon } from "@sanity/icons/ColorWheel"
import { defineField, defineType } from "sanity"
import { DIRECTIONS, EXTENSIONS, PATTERNS, SUITS, titleOf } from "./constants"

export const suit = defineType({
  name: "suit",
  title: "Suit",
  type: "document",
  icon: ColorWheelIcon,
  fields: [
    defineField({ name: "key", title: "Game key", type: "string", options: { list: SUITS, layout: "dropdown" }, validation: (r) => r.required() }),
    defineField({ name: "name", title: "Name", type: "localeString" }),
    defineField({ name: "color", title: "Color", description: "Main color, #RRGGBB. The multicolor suit gets a flat fallback here.", type: "string", validation: (r) => r.required().regex(/^#[0-9a-fA-F]{6}$/, { name: "hex" }) }),
    defineField({ name: "extension", title: "Comes from", type: "string", options: { list: EXTENSIONS, layout: "radio" }, initialValue: "base", validation: (r) => r.required() }),
    defineField({ name: "direction", title: "Firework order", type: "string", options: { list: DIRECTIONS, layout: "radio" }, initialValue: "ascending", validation: (r) => r.required() }),
    defineField({ name: "symbol", title: "Symbol", description: "The shape that tells suits apart without color (circle, triangle, square, star…)", type: "string", validation: (r) => r.required() }),
    defineField({ name: "letter", title: "Letter", description: "One letter shown on the cards of the suit", type: "string", validation: (r) => r.required().length(1) }),
    defineField({ name: "pattern", title: "Pattern", type: "string", options: { list: PATTERNS, layout: "dropdown" }, initialValue: "none", validation: (r) => r.required() }),
    defineField({ name: "symbolImage", title: "Symbol (image)", type: "image" }),
  ],
  preview: {
    select: { key: "key", color: "color", media: "symbolImage" },
    prepare: ({ key, color, media }) => ({ title: titleOf(SUITS, key) ?? key, subtitle: color, media }),
  },
})
