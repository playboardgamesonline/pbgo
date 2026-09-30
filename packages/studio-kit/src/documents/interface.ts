import { ImagesIcon } from "@sanity/icons/Images"
import { defineField, defineType } from "sanity"

const HEX = /^#[0-9a-fA-F]{6}$/

/** Habillage commun à tous les jeux : décor des écrans hors partie, pictos, palette des joueurs. */
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
    defineField({ name: "background", title: "Background", description: "Full-screen background image (optional)", type: "image", group: "screens" }),
    defineField({ name: "pattern", title: "Pattern", description: "Tiled pattern over the background (≈512 px)", type: "image", group: "screens" }),
    defineField({ name: "decorTop", title: "Top decoration", description: "Full-width image at the top of home / lobby screens", type: "image", group: "screens" }),
    defineField({ name: "decorBottom", title: "Bottom decoration", description: "Full-width image at the bottom (the main button sits on it)", type: "image", group: "screens" }),
    defineField({ name: "hero", title: "Character", description: "Standing above the bottom decoration (e.g. the Queen)", type: "image", group: "screens" }),
    defineField({ name: "hostIcon", title: "Host pictogram", description: "Shown next to the host in the lobby (SVG or PNG, used as a mask)", type: "image", group: "players" }),
    defineField({
      name: "playerColors",
      title: "Player colors",
      description: "Hex colors given to seats in join order",
      type: "array",
      of: [{ type: "string", validation: (r) => r.regex(HEX, { name: "hex color" }) }],
      group: "players",
    }),
    defineField({ name: "desktopOnly", title: "Desktop only", description: "Hide the game under 900 px wide (edited in the admin, Mechanics)", type: "boolean", initialValue: true, group: "options" }),
  ],
  preview: { prepare: () => ({ title: "Visual" }) },
})
