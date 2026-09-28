import { ThLargeIcon } from "@sanity/icons/ThLarge"
import { defineArrayMember, defineField, defineType } from "sanity"

export const game = defineType({
  name: "game",
  title: "Game",
  type: "document",
  icon: ThLargeIcon,
  groups: [
    { name: "board", title: "Board", default: true },
    { name: "backs", title: "Card backs" },
  ],
  fields: [
    defineField({ name: "mat", title: "Game mat", type: "image", group: "board" }),
    defineField({ name: "matTexture", title: "Game mat texture", type: "image", group: "board" }),
    defineField({
      name: "decorations",
      title: "Decorations",
      type: "array",
      group: "board",
      of: [
        defineArrayMember({
          type: "object",
          name: "decoration",
          fields: [
            defineField({ name: "name", title: "Name", type: "string", validation: (r) => r.required() }),
            defineField({ name: "image", title: "Image", type: "image", validation: (r) => r.required() }),
          ],
          preview: { select: { title: "name", media: "image" } },
        }),
      ],
    }),
    defineField({ name: "courtierBack", title: "Courtier card back", type: "image", group: "backs" }),
    defineField({ name: "whiteMissionBack", title: "White mission back", type: "image", group: "backs" }),
    defineField({ name: "blueMissionBack", title: "Blue mission back", type: "image", group: "backs" }),
  ],
  preview: { prepare: () => ({ title: "Game" }) },
})
