import { PlayIcon } from "@sanity/icons/Play"
import { defineField, defineType } from "sanity"

const volume = (name: string, title: string) => defineField({ name, title, type: "number", validation: (r) => r.min(0).max(1) })
const mp3 = { accept: "audio/mpeg,.mp3" }

/** Sons du jeu : musiques, ambiance et fichiers des effets (les effets eux-mêmes sont déclarés par le code du jeu). */
export const audio = defineType({
  name: "audio",
  title: "Audio",
  type: "document",
  icon: PlayIcon,
  fields: [
    defineField({
      name: "volumes",
      title: "Default volumes",
      description: "0 to 1 — players can change them in the game",
      type: "object",
      fields: [volume("master", "Master"), volume("music", "Music"), volume("effects", "Effects"), volume("ambience", "Ambience")],
    }),
    defineField({ name: "defaultMusic", title: "Default track (key)", type: "string" }),
    defineField({
      name: "music",
      title: "Music",
      type: "array",
      of: [
        {
          type: "object",
          name: "audioTrack",
          fields: [
            defineField({ name: "key", title: "Key", type: "string", validation: (r) => r.required() }),
            defineField({ name: "title", title: "Title", type: "string" }),
            defineField({ name: "file", title: "File (MP3)", type: "file", options: mp3 }),
            defineField({ name: "loopEnd", title: "Loop end (s)", description: "Musical end of the loop, before the reverb tail", type: "number" }),
          ],
          preview: { select: { title: "title", subtitle: "key" } },
        },
      ],
    }),
    defineField({
      name: "ambience",
      title: "Ambience",
      type: "object",
      fields: [
        defineField({ name: "file", title: "File (MP3)", type: "file", options: mp3 }),
        defineField({ name: "loopEnd", title: "Loop end (s)", type: "number" }),
      ],
    }),
    defineField({
      name: "effects",
      title: "Effects",
      description: "Keys are declared by the game code",
      type: "array",
      of: [
        {
          type: "object",
          name: "audioEffect",
          fields: [
            defineField({ name: "key", title: "Key", type: "string", validation: (r) => r.required() }),
            defineField({ name: "file", title: "File (MP3)", type: "file", options: mp3 }),
            volume("volume", "Volume"),
          ],
          preview: { select: { title: "key" } },
        },
      ],
    }),
  ],
  preview: { prepare: () => ({ title: "Audio" }) },
})
