import { ThLargeIcon } from "@sanity/icons/ThLarge"
import { defineArrayMember, defineField, defineType } from "sanity"

export const game = defineType({
  name: "game",
  title: "Game",
  type: "document",
  icon: ThLargeIcon,
  groups: [
    { name: "plateau", title: "Board", default: true },
    { name: "cartes", title: "Card backs" },
  ],
  fields: [
    defineField({
      name: "tapis",
      title: "Game mat",
      description: "The Queen's table mat, in the middle of the board.",
      type: "image",
      group: "plateau",
    }),
    defineField({
      name: "decorations",
      title: "Decorations",
      description: "Board decorations, to be placed later (candles, goblets, petals…). Transparent PNG or WebP.",
      type: "array",
      group: "plateau",
      of: [
        defineArrayMember({
          type: "object",
          name: "decoration",
          fields: [
            defineField({ name: "nom", title: "Name", type: "string", validation: (r) => r.required() }),
            defineField({ name: "image", title: "Image", type: "image", validation: (r) => r.required() }),
          ],
          preview: { select: { title: "nom", media: "image" } },
        }),
      ],
    }),
    defineField({
      name: "dosCourtisan",
      title: "Courtier card back",
      description: "Also used for face-down spies",
      type: "image",
      group: "cartes",
    }),
    defineField({ name: "dosMissionBlanche", title: "White mission back", type: "image", group: "cartes" }),
    defineField({ name: "dosMissionBleue", title: "Blue mission back", type: "image", group: "cartes" }),
  ],
  preview: { prepare: () => ({ title: "Game" }) },
})
