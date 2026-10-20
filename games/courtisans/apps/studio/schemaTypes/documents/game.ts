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
    { name: "assets", title: "Pictograms & paper" },
  ],
  fields: [
    defineField({ name: "mat", title: "Game mat", type: "image", group: "board" }),
    defineField({ name: "matTexture", title: "Game mat texture", type: "image", group: "board" }),
    defineField({ name: "courtierBack", title: "Courtier card back", type: "image", group: "backs" }),
    defineField({ name: "whiteMissionBack", title: "White mission back", type: "image", group: "backs" }),
    defineField({ name: "blueMissionBack", title: "Blue mission back", type: "image", group: "backs" }),
    defineField({ name: "pictogramFrame", title: "Pictogram frame", type: "image", group: "assets" }),
    defineField({ name: "arrowUp", title: "Arrow up (family in the light)", type: "image", group: "assets" }),
    defineField({ name: "arrowDown", title: "Arrow down (family in disgrace)", type: "image", group: "assets" }),
    defineField({ name: "paper", title: "Paper texture", type: "image", group: "assets" }),
  ],
  preview: { prepare: () => ({ title: "Game" }) },
})
