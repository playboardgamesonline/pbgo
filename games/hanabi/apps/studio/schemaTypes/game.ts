import { ThLargeIcon } from "@sanity/icons/ThLarge"
import { defineArrayMember, defineField, defineType } from "sanity"
import { RANKS, RATING_KEYS } from "./constants"

export const game = defineType({
  name: "game",
  title: "Game",
  type: "document",
  icon: ThLargeIcon,
  groups: [
    { name: "board", title: "Board", default: true },
    { name: "backs", title: "Card backs" },
    { name: "tokens", title: "Tokens" },
    { name: "glyphs", title: "Value glyphs" },
    { name: "score", title: "Score ratings" },
  ],
  fields: [
    defineField({ name: "mat", title: "Game mat", type: "image", group: "board" }),
    defineField({ name: "cardBack", title: "Card back", type: "image", group: "backs" }),
    defineField({ name: "clueToken", title: "Clue token", type: "image", group: "tokens" }),
    defineField({ name: "clueTokenSpent", title: "Clue token (spent)", type: "image", group: "tokens" }),
    defineField({ name: "fuseToken", title: "Fuse token", type: "image", group: "tokens" }),
    defineField({ name: "fuseTokenExploded", title: "Fuse token (exploded)", type: "image", group: "tokens" }),
    defineField({
      name: "valueGlyphs",
      title: "Value glyphs",
      type: "array",
      group: "glyphs",
      of: [
        defineArrayMember({
          type: "object",
          name: "valueGlyph",
          fields: [
            defineField({ name: "rank", title: "Value", type: "number", options: { list: RANKS.map((rank) => ({ title: String(rank), value: rank })) }, validation: (r) => r.required() }),
            defineField({ name: "glyph", title: "Glyph", type: "image" }),
          ],
          preview: { select: { rank: "rank", media: "glyph" }, prepare: ({ rank, media }) => ({ title: `Value ${rank ?? "?"}`, media }) },
        }),
      ],
    }),
    defineField({
      name: "scoreScale",
      title: "Score ratings",
      type: "array",
      group: "score",
      of: [
        defineArrayMember({
          type: "object",
          name: "rating",
          fields: [
            defineField({ name: "key", title: "Game key", type: "string", options: { list: RATING_KEYS.map((key) => ({ title: key.charAt(0).toUpperCase() + key.slice(1), value: key })), layout: "dropdown" }, validation: (r) => r.required() }),
            defineField({ name: "minScore", title: "From score", type: "number", validation: (r) => r.required().integer().min(0) }),
            defineField({ name: "label", title: "Rating", type: "localeString" }),
            defineField({ name: "line", title: "Sentence", type: "localeString" }),
            defineField({ name: "badge", title: "Badge", type: "image" }),
          ],
          preview: {
            select: { label: "label.fr", key: "key", minScore: "minScore", media: "badge" },
            prepare: ({ label, key, minScore, media }) => ({ title: label ?? key, subtitle: `From ${minScore ?? "?"} points`, media }),
          },
        }),
      ],
    }),
  ],
  preview: { prepare: () => ({ title: "Game" }) },
})
