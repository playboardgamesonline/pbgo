import { BoltIcon } from "@sanity/icons/Bolt"
import { CloseCircleIcon } from "@sanity/icons/CloseCircle"
import { HeartIcon } from "@sanity/icons/Heart"
import { WarningOutlineIcon } from "@sanity/icons/WarningOutline"
import { WrenchIcon } from "@sanity/icons/Wrench"
import { defineArrayMember, defineField, defineType } from "sanity"
import { CATEGORIES, type CategoryKey, titleOf } from "./constants"

const ICONS = { kitten: WarningOutlineIcon, defuse: WrenchIcon, action: BoltIcon, nope: CloseCircleIcon, cat: HeartIcon }

// One document per card type of a category (the Attack, the Nope, the Tacocat…), shared by every edition: an edition says how many copies of each
// type its deck holds. A type has one illustration per printed copy (the Defuse has six), numbered from 1 like the art files (`defuse-1`, `defuse-2`…).
const cardCategory = (category: CategoryKey) => {
  const { type, title, choices } = CATEGORIES[category]
  return defineType({
    name: type,
    title,
    type: "document",
    icon: ICONS[category],
    fields: [
      defineField({ name: "key", title: "Game key", description: "The id of this card type in its category, the one the engine uses and the art files are named after", type: "string", options: { list: choices, layout: "dropdown" }, validation: (r) => r.required() }),
      defineField({ name: "order", title: "Order", description: "Place of the card type in its category, from 0: the list is sorted on it", type: "number", readOnly: true, validation: (r) => r.required().integer().min(0) }),
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
    orderings: [{ name: "categoryOrder", title: "Order in the category", by: [{ field: "order", direction: "asc" }] }],
    preview: {
      select: { key: "key", name: "name.fr", illustrations: "illustrations", media: "illustrations.0.image" },
      prepare: ({ key, name, illustrations, media }) => {
        const count = Array.isArray(illustrations) ? illustrations.length : 0
        return { title: titleOf(choices, key) ?? name ?? key, subtitle: `${count} illustration${count === 1 ? "" : "s"}`, media }
      },
    },
  })
}

export const kittenCard = cardCategory("kitten")
export const defuseCard = cardCategory("defuse")
export const actionCard = cardCategory("action")
export const nopeCard = cardCategory("nope")
export const catCard = cardCategory("cat")
