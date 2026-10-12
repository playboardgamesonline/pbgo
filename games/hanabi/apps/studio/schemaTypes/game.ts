import { ThLargeIcon } from "@sanity/icons/ThLarge"
import { defineArrayMember, defineField, defineType } from "sanity"
import { RANKS, RATING_KEYS } from "./constants"

export const game = defineType({
  name: "game",
  title: "Game",
  type: "document",
  icon: ThLargeIcon,
  fields: [
    defineField({ name: "mat", title: "Game mat", type: "image" }),
    defineField({ name: "cardBack", title: "Card back", description: "Must not give the suit away", type: "image" }),
    defineField({ name: "clueToken", title: "Clue token", type: "image" }),
    defineField({ name: "clueTokenSpent", title: "Clue token (spent)", type: "image" }),
    defineField({ name: "fuseToken", title: "Fuse token", type: "image" }),
    defineField({ name: "fuseTokenExploded", title: "Fuse token (exploded)", type: "image" }),
    defineField({
      name: "valueGlyphs",
      title: "Value glyphs",
      description: "One glyph per card value, used on the cards and in the clue buttons",
      type: "array",
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
      description: "The final score is turned into a rating: it applies from its minimum score up to the next rating",
      type: "array",
      of: [
        defineArrayMember({
          type: "object",
          name: "rating",
          fields: [
            defineField({ name: "key", title: "Game key", type: "string", options: { list: RATING_KEYS.map((key) => ({ title: key.charAt(0).toUpperCase() + key.slice(1), value: key })), layout: "dropdown" }, validation: (r) => r.required() }),
            defineField({ name: "minScore", title: "From score", type: "number", validation: (r) => r.required().integer().min(0) }),
            defineField({ name: "label", title: "Rating", type: "localeString" }),
            defineField({ name: "line", title: "Line", description: "One short sentence shown with the rating", type: "localeString" }),
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
