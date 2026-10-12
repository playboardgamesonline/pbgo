import { StackIcon } from "@sanity/icons/Stack"
import { defineField, defineType } from "sanity"
import { RANKS, SUITS, titleOf } from "./constants"

// One document per card face; `quantity` says how many copies of the face are in the deck (the 70-card deck has 35 faces)
export const card = defineType({
  name: "card",
  title: "Card",
  type: "document",
  icon: StackIcon,
  fields: [
    defineField({ name: "suit", title: "Suit", type: "string", options: { list: SUITS, layout: "dropdown" }, validation: (r) => r.required() }),
    defineField({ name: "rank", title: "Value", type: "number", options: { list: RANKS.map((rank) => ({ title: String(rank), value: rank })) }, validation: (r) => r.required() }),
    defineField({ name: "quantity", title: "Quantity", description: "Copies of this card in the deck", type: "number", initialValue: 1, validation: (r) => r.required().integer().min(1) }),
    defineField({ name: "card", title: "Card face", type: "image" }),
  ],
  orderings: [
    {
      name: "suitRank",
      title: "Suit, then value",
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
