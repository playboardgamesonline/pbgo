import { NumberIcon } from "@sanity/icons/Number"
import { defineField, defineType } from "sanity"
import { BANDS, CARD_CHOICES, titleOf } from "./constants"

// One document per face of the deck (a -2, a 0, a 7…): 15 faces for the 150 cards of the box. Every copy of a face shares its picture, so a card holds one picture. Drop it on the "Visual" field, or let the seed place the art files
// (docs/content-pipeline.md). The form follows the rules every game's cards follow (the skill `game-sanity-create`): no Effect or Rule field, no description under a field, an English game key, the quantity second to last and the visual last.
// A card is named by the figure printed on it, so it has no name to translate: the key is the figure.
export const card = defineType({
  name: "card",
  title: "Card",
  type: "document",
  icon: NumberIcon,
  fields: [
    defineField({ name: "key", title: "Game key", type: "string", options: { list: CARD_CHOICES, layout: "dropdown" }, validation: (r) => r.required() }),
    defineField({ name: "band", title: "Colour", type: "string", options: { list: BANDS, layout: "dropdown" }, validation: (r) => r.required() }),
    defineField({ name: "order", title: "Order", type: "number", readOnly: true, validation: (r) => r.required().integer().min(0) }),
    defineField({ name: "quantity", title: "Quantity", type: "number", validation: (r) => r.required().integer().min(1) }),
    defineField({ name: "image", title: "Visual", type: "image" }),
  ],
  orderings: [{ name: "valueOrder", title: "Order of the values", by: [{ field: "order", direction: "asc" }] }],
  preview: {
    select: { key: "key", band: "band", quantity: "quantity", media: "image" },
    prepare: ({ key, band, quantity, media }) => ({
      title: titleOf(CARD_CHOICES, key) ?? key,
      subtitle: `${titleOf(BANDS, band)?.replace(/ \(.*\)$/, "") ?? "?"} × ${quantity ?? "?"}`,
      media,
    }),
  },
})
