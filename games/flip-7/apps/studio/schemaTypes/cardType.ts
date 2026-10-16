import { StackIcon } from "@sanity/icons/Stack"
import { defineField, defineType } from "sanity"
import { CARD_TYPES, KINDS, titleOf } from "./constants"

// One document per face of the game (a 7, a +4, the Freeze…): 22 faces for the 94 cards of the box. Every copy of a card shares its face,
// so a face holds one picture. Drop it on the "Card face" field, or let the seed place the art files (docs/content-pipeline.md).
export const cardType = defineType({
  name: "cardType",
  title: "Card face",
  type: "document",
  icon: StackIcon,
  fields: [
    defineField({ name: "key", title: "Game key", description: "The id the engine uses for this face", type: "string", options: { list: CARD_TYPES, layout: "dropdown" }, validation: (r) => r.required() }),
    defineField({ name: "kind", title: "Kind", type: "string", options: { list: KINDS, layout: "dropdown" }, validation: (r) => r.required() }),
    defineField({ name: "order", title: "Order", description: "Place of the face in the box, from 0: the list is sorted on it", type: "number", readOnly: true, validation: (r) => r.required().integer().min(0) }),
    defineField({ name: "copies", title: "Copies", description: "Copies of this face in the box (94 cards in all)", type: "number", validation: (r) => r.required().integer().min(1) }),
    defineField({ name: "name", title: "Name", type: "localeString" }),
    defineField({ name: "effect", title: "Effect", description: "A short summary of what the card does, in the words of the site", type: "localeText" }),
    defineField({ name: "image", title: "Card face", description: "The picture of the card, in the proportions of the printed cards (5:7)", type: "image" }),
  ],
  orderings: [{ name: "boxOrder", title: "Order in the box", by: [{ field: "order", direction: "asc" }] }],
  preview: {
    select: { key: "key", kind: "kind", copies: "copies", media: "image" },
    prepare: ({ key, kind, copies, media }) => ({
      title: titleOf(CARD_TYPES, key) ?? key,
      subtitle: `${titleOf(KINDS, kind)?.split(" (")[0] ?? "?"} · × ${copies ?? "?"}`,
      media,
    }),
  },
})
