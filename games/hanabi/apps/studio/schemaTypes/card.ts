import { StackIcon } from "@sanity/icons/Stack"
import { defineField, defineType } from "sanity"
import { RANKS, SUITS, titleOf } from "./constants"

// All the cards in one list: the value, the color, how many copies are in the deck, then the visual (the 70-card deck has 35 faces).
// Studio form rules (skill `game-sanity-create`): no Effect or Rule field, no `description`, the visual is the last field and the quantity the one before it
export const card = defineType({
  name: "card",
  title: "Card",
  type: "document",
  icon: StackIcon,
  fields: [
    defineField({ name: "rank", title: "Value", type: "number", options: { list: RANKS.map((rank) => ({ title: String(rank), value: rank })) }, validation: (r) => r.required() }),
    defineField({ name: "suit", title: "Color", type: "string", options: { list: SUITS, layout: "dropdown" }, validation: (r) => r.required() }),
    defineField({ name: "quantity", title: "Quantity", type: "number", initialValue: 1, validation: (r) => r.required().integer().min(1) }),
    defineField({ name: "card", title: "Visual", type: "image" }),
  ],
  orderings: [
    {
      name: "suitRank",
      title: "Color, then value",
      by: [
        { field: "suit", direction: "asc" },
        { field: "rank", direction: "asc" },
      ],
    },
  ],
  preview: {
    select: { suit: "suit", rank: "rank", quantity: "quantity", media: "card" },
    prepare: ({ suit, rank, quantity, media }) => ({
      title: `${titleOf(SUITS, suit) ?? "?"} ${rank ?? "?"}`,
      subtitle: `× ${quantity ?? 1}`,
      media,
    }),
  },
})
