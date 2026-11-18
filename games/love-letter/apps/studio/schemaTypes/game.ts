import { ThLargeIcon } from "@sanity/icons/ThLarge"
import { defineField, defineType } from "sanity"

// The pictures that are not on a piece, one tab per family. The favor token has the three files of the owner's art: its symbol and its mask (images) and its 3D model (a file, which the seed's art step does not place: it is dropped on its field in the Studio).
export const game = defineType({
  name: "game",
  title: "Game",
  type: "document",
  icon: ThLargeIcon,
  groups: [
    { name: "board", title: "Board", default: true },
    { name: "backs", title: "Card backs" },
    { name: "token", title: "Favor token" },
  ],
  fields: [
    defineField({ name: "mat", title: "Game mat", type: "image", group: "board" }),
    defineField({ name: "cardBack", title: "Card back", type: "image", group: "backs" }),
    defineField({ name: "favorTokenSymbol", title: "Favor token symbol", type: "image", group: "token" }),
    defineField({ name: "favorTokenMask", title: "Favor token mask", type: "image", group: "token" }),
    defineField({ name: "favorTokenModel", title: "Favor token 3D model", type: "file", group: "token", options: { accept: ".glb,model/gltf-binary" } }),
  ],
  preview: { prepare: () => ({ title: "Game" }) },
})
