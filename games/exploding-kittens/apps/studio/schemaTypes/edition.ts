import { ThListIcon } from "@sanity/icons/ThList"
import { defineArrayMember, defineField, defineType } from "sanity"
import { CARD_TYPES, EDITIONS, titleOf } from "./constants"

// A deck: which card types it holds and how many copies of each. The Original Edition is the 56-card base game.
export const edition = defineType({
  name: "edition",
  title: "Edition",
  type: "document",
  icon: ThListIcon,
  fields: [
    defineField({ name: "key", title: "Game key", type: "string", options: { list: EDITIONS, layout: "dropdown" }, validation: (r) => r.required() }),
    defineField({ name: "name", title: "Name", type: "localeString" }),
    defineField({
      name: "cards",
      title: "Cards",
      description: "The card types of the deck, with the copies of each",
      type: "array",
      of: [
        defineArrayMember({
          type: "object",
          name: "deckCard",
          fields: [
            defineField({ name: "cardType", title: "Card type", type: "string", options: { list: CARD_TYPES, layout: "dropdown" }, validation: (r) => r.required() }),
            defineField({ name: "copies", title: "Copies", description: "Copies of this card type in the deck", type: "number", initialValue: 1, validation: (r) => r.required().integer().min(1) }),
          ],
          preview: { select: { cardType: "cardType", copies: "copies" }, prepare: ({ cardType, copies }) => ({ title: titleOf(CARD_TYPES, cardType) ?? "?", subtitle: `× ${copies ?? 1}` }) },
        }),
      ],
    }),
  ],
  preview: {
    select: { key: "key", name: "name.fr", cards: "cards" },
    prepare: ({ key, name, cards }) => ({
      title: titleOf(EDITIONS, key) ?? name ?? key,
      subtitle: `${(cards ?? []).reduce((total: number, card: { copies?: number }) => total + (card.copies ?? 0), 0)} cards`,
    }),
  },
})
