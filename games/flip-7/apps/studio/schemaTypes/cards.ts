import { AddIcon } from "@sanity/icons/Add"
import { BoltIcon } from "@sanity/icons/Bolt"
import { NumberIcon } from "@sanity/icons/Number"
import { defineField, defineType } from "sanity"
import { CATEGORIES, type CategoryKey, titleOf } from "./constants"

const ICONS = { number: NumberIcon, action: BoltIcon, modifier: AddIcon }

// One document per card of a category (a 7, a +4, the Freeze…): 22 cards for the 94 of the box. Every copy of a card shares its picture,
// so a card holds one picture. Drop it on the "Visual" field, or let the seed place the art files (docs/content-pipeline.md).
// The form follows the rules every game's cards follow (the skill `game-sanity-create`): no Effect or Rule field, no description under a field,
// an English game key next to the localized name, the copies second to last and the visual last.
const cardCategory = (category: CategoryKey) => {
  const { type, title, choices } = CATEGORIES[category]
  return defineType({
    name: type,
    title,
    type: "document",
    icon: ICONS[category],
    fields: [
      defineField({ name: "key", title: "Game key", type: "string", options: { list: choices, layout: "dropdown" }, validation: (r) => r.required() }),
      defineField({ name: "order", title: "Order", type: "number", readOnly: true, validation: (r) => r.required().integer().min(0) }),
      defineField({ name: "name", title: "Name", type: "localeString" }),
      defineField({ name: "copies", title: "Copies", type: "number", validation: (r) => r.required().integer().min(1) }),
      defineField({ name: "image", title: "Visual", type: "image" }),
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
