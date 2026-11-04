import { PlayIcon } from "@sanity/icons/Play"
import { defineField, defineType, type PreviewValue } from "sanity"

/**
 * A short clip of a game being played, an item of the gallery of a game (PLT-56): a video file that the page plays in a loop and without sound, where the game's pictures are, and a
 * picture that stands for it until it plays (its poster). The page plays it as it is, so it is short, a few seconds to half a minute, and light: MP4 or WebM, a few megabytes.
 */
export const galleryClip = defineType({
  name: "galleryClip",
  title: "Clip",
  type: "object",
  icon: PlayIcon,
  fields: [
    defineField({
      name: "video",
      title: "Video (MP4 or WebM, a few seconds to half a minute, no sound needed)",
      type: "file",
      options: { accept: "video/mp4,video/webm" },
      validation: (rule) => rule.required(),
    }),
    defineField({ name: "poster", title: "Poster (shown until it plays; empty: its first frame)", type: "image" }),
    defineField({ name: "caption", title: "What it shows, in a few words", type: "string", validation: (rule) => rule.max(140) }),
  ],
  preview: {
    select: { caption: "caption", media: "poster", file: "video.asset.originalFilename" },
    prepare: ({ caption, media, file }: { caption?: string; media?: PreviewValue["media"]; file?: string }) => ({
      title: caption ?? file ?? "Clip",
      subtitle: "Clip",
      media,
    }),
  },
})
