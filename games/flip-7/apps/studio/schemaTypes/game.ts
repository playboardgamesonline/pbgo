import { ThLargeIcon } from "@sanity/icons/ThLarge"
import { defineField, defineType } from "sanity"

export const game = defineType({
  name: "game",
  title: "Game",
  type: "document",
  icon: ThLargeIcon,
  fields: [
    defineField({ name: "mat", title: "Game mat", type: "image" }),
    defineField({ name: "cardBack", title: "Card back", type: "image" }),
    defineField({ name: "boxFront", title: "Box (front)", type: "image" }),
    defineField({ name: "boxBack", title: "Box (back)", type: "image" }),
  ],
  preview: { prepare: () => ({ title: "Game" }) },
})
