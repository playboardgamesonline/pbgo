import { ThLargeIcon } from "@sanity/icons/ThLarge"
import { defineField, defineType } from "sanity"

export const game = defineType({
  name: "game",
  title: "Game",
  type: "document",
  icon: ThLargeIcon,
  groups: [
    { name: "board", title: "Board", default: true },
    { name: "backs", title: "Card backs" },
    { name: "arrows", title: "Arrows" },
  ],
  fields: [
    defineField({ name: "mat", title: "Game mat", type: "image", group: "board" }),
    defineField({ name: "matTexture", title: "Game mat texture", type: "image", group: "board" }),
    defineField({ name: "courtierBack", title: "Courtier card back", type: "image", group: "backs" }),
    defineField({ name: "whiteMissionBack", title: "White mission back", type: "image", group: "backs" }),
    defineField({ name: "blueMissionBack", title: "Blue mission back", type: "image", group: "backs" }),
    defineField({ name: "arrowUp", title: "Arrow up (family in the light)", type: "image", group: "arrows" }),
    defineField({ name: "arrowDown", title: "Arrow down (family in disgrace)", type: "image", group: "arrows" }),
  ],
  preview: { prepare: () => ({ title: "Game" }) },
})
