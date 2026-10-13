import { StackIcon } from "@sanity/icons/Stack"
import { defineArrayMember, defineField, defineType } from "sanity"
import { CARD_TYPES, KINDS, titleOf } from "./constants"

// One document per card type (Defuse, Nope, Tacocat…), shared by every edition: an edition says how many copies of each type its deck holds.
// A type has one illustration per printed copy (the Defuse has six), numbered from 1 like the art files (`defuse-1`, `defuse-2`…).
export const cardType = defineType({
  name: "cardType",
  title: "Card type",
  type: "document",
  icon: StackIcon,
  fields: [
    defineField({ name: "key", title: "Game key", description: "The id the engine uses for this type", type: "string", options: { list: CARD_TYPES, layout: "dropdown" }, validation: (r) => r.required() }),
    defineField({ name: "kind", title: "Kind", type: "string", options: { list: KINDS, layout: "dropdown" }, validation: (r) => r.required() }),
    defineField({ name: "name", title: "Name", type: "localeString" }),
    defineField({ name: "effect", title: "Effect", description: "A short summary of what the card does, in the words of the site", type: "localeText" }),
    defineField({
      name: "illustrations",
      title: "Illustrations",
      description: "One per printed copy of the card, in the order of the art files",
      type: "array",
      of: [
        defineArrayMember({
          type: "object",
          name: "illustration",
          fields: [
            defineField({ name: "number", title: "Number", description: "From 1, as in the file name (defuse-1, defuse-2…)", type: "number", validation: (r) => r.required().integer().min(1) }),
            defineField({ name: "image", title: "Card face", type: "image" }),
          ],
          preview: { select: { number: "number", media: "image" }, prepare: ({ number, media }) => ({ title: `Illustration ${number ?? "?"}`, media }) },
        }),
      ],
    }),
  ],
  orderings: [
    {
      name: "kindKey",
      title: "Kind, then key",
      by: [
        { field: "kind", direction: "asc" },
        { field: "key", direction: "asc" },
      ],
    },
  ],
  preview: {
    select: { key: "key", kind: "kind", name: "name.fr", media: "illustrations.0.image" },
    prepare: ({ key, kind, name, media }) => ({ title: titleOf(CARD_TYPES, key) ?? name ?? key, subtitle: titleOf(KINDS, kind), media }),
  },
})
