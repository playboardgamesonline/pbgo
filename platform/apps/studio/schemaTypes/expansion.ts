import { MAX_SLUG_LENGTH, slugFromName } from "@pbgo/games/slug"
import { LANGUAGES } from "@pbgo/studio-kit/constants"
import { PackageIcon } from "@sanity/icons/Package"
import { defineArrayMember, defineField, defineType, type PreviewValue } from "sanity"
import { checkCreatorsOnce, checkName, checkPlayersMax, checkSlug } from "./rules"

const capitalized = (word: string) => word.charAt(0).toUpperCase() + word.slice(1)

/**
 * An expansion of a game of the catalog: what is played with its base game and not without it. A document type of its own, so that the
 * hub cannot list it as a game by missing a filter. It has the facts, the credits, the texts and the links to the rules of a game, two
 * pictures, and none of what places a game on the hub (categories, complexity, order, related). The figures (players, duration, minimum
 * age) are those of the game played with the expansion, filled only where it changes them: an empty one is the base game's. An
 * expansion that plays without its base game is a `reimplementation` of it, a game.
 */
export const expansion = defineType({
  name: "expansion",
  title: "Expansion",
  type: "document",
  icon: PackageIcon,
  groups: [
    { name: "identity", title: "Identity", default: true },
    { name: "facts", title: "Facts" },
    { name: "credits", title: "Credits" },
    { name: "texts", title: "Texts" },
    { name: "rules", title: "Rules" },
    { name: "visuals", title: "Visuals" },
  ],
  fields: [
    // Identity
    defineField({ name: "name", title: "Name", type: "string", group: "identity", validation: (rule) => rule.required().custom(checkName) }),
    defineField({
      name: "slug",
      title: "Slug",
      type: "slug",
      group: "identity",
      options: { source: "name", maxLength: MAX_SLUG_LENGTH, slugify: slugFromName },
      validation: (rule) => rule.required().custom(checkSlug),
    }),
    // A strong reference (the default): the base game cannot be deleted while an expansion points at it
    defineField({ name: "baseGame", title: "Base game", type: "reference", to: [{ type: "game" }], group: "identity", validation: (rule) => rule.required() }),
    defineField({ name: "bggId", title: "BGG ID", type: "number", group: "identity", validation: (rule) => rule.integer().min(1) }),

    // Facts: the figures of the game as it is played with the expansion; one that the expansion does not change is left empty, and is the base game's
    defineField({
      name: "playersMin",
      title: "Players (min, with the expansion; empty: the base game's)",
      type: "number",
      group: "facts",
      validation: (rule) => rule.integer().min(1),
    }),
    defineField({
      name: "playersMax",
      title: "Players (max, with the expansion; empty: the base game's)",
      type: "number",
      group: "facts",
      validation: (rule) => rule.integer().min(1).custom(checkPlayersMax),
    }),
    defineField({ name: "duration", title: "Duration (minutes; empty: the base game's)", type: "number", group: "facts", validation: (rule) => rule.integer().min(1) }),
    defineField({ name: "minAge", title: "Minimum age (empty: the base game's)", type: "number", group: "facts", validation: (rule) => rule.integer().min(0) }),
    // The expansion's own, like its credits and its texts
    defineField({ name: "releaseDate", title: "Release date", type: "date", group: "facts" }),

    // Credits
    defineField({
      name: "creators",
      title: "Creators",
      type: "array",
      of: [defineArrayMember({ type: "gameCreator" })],
      group: "credits",
      validation: (rule) => rule.custom(checkCreatorsOnce),
    }),
    defineField({
      name: "publishers",
      title: "Publishers",
      type: "array",
      of: [defineArrayMember({ type: "reference", to: [{ type: "publisher" }] })],
      group: "credits",
      validation: (rule) => rule.unique(),
    }),

    // Texts
    defineField({ name: "description", title: "Description", type: "text", rows: 8, group: "texts" }),

    // Rules: the one multilingual field, a link per language
    ...LANGUAGES.map(({ id }) => defineField({ name: `rules${capitalized(id)}`, title: `Rules link (${id.toUpperCase()})`, type: "url", group: "rules" })),

    // Visuals: the picture of the expansion and the front of its box
    defineField({ name: "cover", title: "Cover", type: "image", options: { hotspot: true }, group: "visuals" }),
    defineField({ name: "boxFront", title: "Box (front)", type: "image", group: "visuals" }),
  ],
  preview: {
    select: { title: "name", base: "baseGame.name", slug: "slug.current", media: "cover" },
    prepare: ({ title, base, slug, media }: { title?: string; base?: string; slug?: string; media?: PreviewValue["media"] }) => ({
      title: title ?? "Untitled expansion",
      subtitle: [base, slug].filter(Boolean).join(" · "),
      media,
    }),
  },
  orderings: [{ title: "Name", name: "name", by: [{ field: "name", direction: "asc" }] }],
})
