import { ImagesIcon } from "@sanity/icons/Images"
import { defineField, defineType } from "sanity"

const HEX = /^#[0-9a-fA-F]{6}$/

/** Skin shared by every game: decor of the screens outside a game, pictograms, player palette. */
export const interfaceDoc = defineType({
  name: "interface",
  title: "Visual",
  type: "document",
  icon: ImagesIcon,
  groups: [
    { name: "screens", title: "Screens", default: true },
    { name: "players", title: "Players" },
    { name: "options", title: "Options" },
  ],
  fields: [
    defineField({ name: "background", title: "Background", type: "image", group: "screens" }),
    defineField({ name: "pattern", title: "Pattern", type: "image", group: "screens" }),
    defineField({ name: "decorTop", title: "Top decoration", type: "image", group: "screens" }),
    defineField({ name: "decorBottom", title: "Bottom decoration", type: "image", group: "screens" }),
    defineField({ name: "hero", title: "Character", type: "image", group: "screens" }),
    defineField({ name: "hostIcon", title: "Host pictogram", type: "image", group: "players" }),
    defineField({
      name: "playerColors",
      title: "Player colors",
      type: "array",
      of: [{ type: "string", validation: (r) => r.regex(HEX, { name: "hex color" }) }],
      group: "players",
    }),
    defineField({ name: "desktopOnly", title: "Desktop only", type: "boolean", initialValue: true, group: "options" }),
  ],
  preview: { prepare: () => ({ title: "Visual" }) },
})
