import { AddIcon } from "@sanity/icons/Add"
import { BoltIcon } from "@sanity/icons/Bolt"
import { NumberIcon } from "@sanity/icons/Number"
import { defineField, defineType } from "sanity"
import { CATEGORIES, type CategoryKey, titleOf } from "./constants"

const ICONS = { number: NumberIcon, action: BoltIcon, modifier: AddIcon }

// One document per card of a category (a 7, a +4, the Freeze…): 22 cards for the 94 of the box. Every copy of a card shares its picture,
// so a card holds one picture. Drop it on the "Card face" field, or let the seed place the art files (docs/content-pipeline.md).
const cardCategory = (category: CategoryKey) => {
  const { type, title, choices } = CATEGORIES[category]
  return defineType({
    name: type,
    title,
    type: "document",
    icon: ICONS[category],
    fields: [
      defineField({ name: "key", title: "Game key", description: "The id of this card in its category, the one the art files are named after", type: "string", options: { list: choices, layout: "dropdown" }, validation: (r) => r.required() }),
      defineField({ name: "order", title: "Order", description: "Place of the card in its category, from 0: the list is sorted on it", type: "number", readOnly: true, validation: (r) => r.required().integer().min(0) }),
      defineField({ name: "copies", title: "Copies", description: "Copies of this card in the box (94 cards in all)", type: "number", validation: (r) => r.required().integer().min(1) }),
      defineField({ name: "name", title: "Name", type: "localeString" }),
      defineField({ name: "effect", title: "Effect", description: "A short summary of what the card does, in the words of the site", type: "localeText" }),
      defineField({ name: "image", title: "Card face", description: "The picture of the card, in the proportions of the printed cards (5:7)", type: "image" }),
    ],
    orderings: [{ name: "categoryOrder", title: "Order in the category", by: [{ field: "order", direction: "asc" }] }],
    preview: {
      select: { key: "key", copies: "copies", media: "image" },
      prepare: ({ key, copies, media }) => ({
        title: titleOf(choices, key) ?? key,
        subtitle: `× ${copies ?? "?"}`,
        media,
      }),
    },
  })
}

export const numberCard = cardCategory("number")
export const actionCard = cardCategory("action")
export const modifierCard = cardCategory("modifier")
