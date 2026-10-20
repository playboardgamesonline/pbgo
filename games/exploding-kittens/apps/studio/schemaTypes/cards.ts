import { BoltIcon } from "@sanity/icons/Bolt"
import { CloseCircleIcon } from "@sanity/icons/CloseCircle"
import { HeartIcon } from "@sanity/icons/Heart"
import { WarningOutlineIcon } from "@sanity/icons/WarningOutline"
import { WrenchIcon } from "@sanity/icons/Wrench"
import { defineArrayMember, defineField, defineType } from "sanity"
import { CATEGORIES, type CategoryKey, titleOf } from "./constants"

const ICONS = { kitten: WarningOutlineIcon, defuse: WrenchIcon, action: BoltIcon, nope: CloseCircleIcon, cat: HeartIcon }

// One document per card type of a category (the Attack, the Nope, the Tacocat…), shared by every edition: an edition says how many copies of each
// type its deck holds. A type has one illustration per printed copy (the Defuse has six), numbered from 1 like the art files (`defuse-1`, `defuse-2`…),
// and the illustrations are the last field. The form follows the rules every game's cards follow (the skill `game-sanity-create`): no Effect or Rule
// field, no description under a field, an English game key next to the localized name, and the visual last.
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
      defineField({
        name: "illustrations",
        title: "Illustrations",
        type: "array",
        of: [
          defineArrayMember({
            type: "object",
            name: "illustration",
            fields: [
              defineField({ name: "number", title: "Number", type: "number", validation: (r) => r.required().integer().min(1).error("From 1, as in the file name (defuse-1, defuse-2…)") }),
              defineField({ name: "image", title: "Visual", type: "image" }),
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
