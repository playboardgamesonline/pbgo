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
  ],
  fields: [
    defineField({ name: "mat", title: "Game mat", type: "image", group: "board" }),
    defineField({ name: "cardBack", title: "Card back", type: "image", group: "backs" }),
  ],
  preview: { prepare: () => ({ title: "Game" }) },
})
