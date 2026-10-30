import { MAX_SLUG_LENGTH, slugFromName } from "@pbgo/games/slug"
import { LANGUAGES } from "@pbgo/studio-kit/constants"
import { ThLargeIcon } from "@sanity/icons/ThLarge"
import { defineArrayMember, defineField, defineType, type PreviewValue } from "sanity"
import { GAME_KINDS } from "./constants"
import { checkCreatorsOnce, checkName, checkNotItself, checkPlayersMax, checkSlug } from "./rules"

const capitalized = (word: string) => word.charAt(0).toUpperCase() + word.slice(1)

/**
 * A game of the catalog: what the hub lists and shows of it, live or to come. Its tabs run from what it is to what is shown of it.
 * The texts are in English for now (the translation system of Sanity comes later); only the links to the rules are per language.
 */
export const game = defineType({
  name: "game",
  title: "Game",
  type: "document",
  icon: ThLargeIcon,
  groups: [
    { name: "identity", title: "Identity", default: true },
    { name: "facts", title: "Facts" },
    { name: "credits", title: "Credits" },
    { name: "texts", title: "Texts" },
    { name: "rules", title: "Rules" },
    { name: "visuals", title: "Visuals" },
    { name: "related", title: "Related" },
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
    defineField({ name: "bggId", title: "BGG ID", type: "number", group: "identity", validation: (rule) => rule.integer().min(1) }),
    defineField({
      name: "kind",
      title: "Kind",
      type: "string",
      group: "identity",
      options: { list: [...GAME_KINDS], layout: "radio" },
      initialValue: "game",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "baseGame",
      title: "Base game",
      type: "reference",
      to: [{ type: "game" }],
      group: "identity",
      hidden: ({ document }) => (document?.kind ?? "game") === "game",
      validation: (rule) => rule.custom(checkNotItself("A game is not its own base game")),
    }),
    defineField({ name: "order", title: "Order (lowest first)", type: "number", group: "identity", validation: (rule) => rule.integer().min(0) }),

    // Facts
    defineField({ name: "playersMin", title: "Players (min)", type: "number", group: "facts", validation: (rule) => rule.integer().min(1) }),
    defineField({
      name: "playersMax",
      title: "Players (max, empty: no limit)",
      type: "number",
      group: "facts",
      validation: (rule) => rule.integer().min(1).custom(checkPlayersMax),
    }),
    defineField({ name: "duration", title: "Duration (minutes)", type: "number", group: "facts", validation: (rule) => rule.integer().min(1) }),
    defineField({ name: "minAge", title: "Minimum age", type: "number", group: "facts", validation: (rule) => rule.integer().min(0) }),
    defineField({ name: "complexity", title: "Complexity (1 to 5, as BoardGameGeek weighs it)", type: "number", group: "facts", validation: (rule) => rule.min(1).max(5) }),
    defineField({ name: "releaseDate", title: "Release date", type: "date", group: "facts" }),
    defineField({
      name: "categories",
      title: "Categories",
      type: "array",
      of: [defineArrayMember({ type: "reference", to: [{ type: "category" }] })],
      group: "facts",
      validation: (rule) => rule.unique(),
    }),

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
    defineField({ name: "tagline", title: "Tagline", type: "string", group: "texts" }),
    defineField({ name: "description", title: "Description", type: "text", rows: 8, group: "texts" }),

    // Rules: the one multilingual field, a link per language
    ...LANGUAGES.map(({ id }) => defineField({ name: `rules${capitalized(id)}`, title: `Rules link (${id.toUpperCase()})`, type: "url", group: "rules" })),

    // Visuals
    defineField({ name: "cover", title: "Cover", type: "image", options: { hotspot: true }, group: "visuals" }),
    defineField({ name: "logo", title: "Logo", type: "image", group: "visuals" }),
    defineField({ name: "icon", title: "Icon", type: "image", group: "visuals" }),
    defineField({ name: "background", title: "Background", type: "image", options: { hotspot: true }, group: "visuals" }),
    defineField({ name: "boxFront", title: "Box (front)", type: "image", group: "visuals" }),

    // Related
    defineField({
      name: "related",
      title: "Related games",
      type: "array",
      // Weak: two games are related both ways, and each strong reference would wait for the other game to be published
      of: [defineArrayMember({ type: "reference", to: [{ type: "game" }], weak: true })],
      group: "related",
      validation: (rule) => rule.unique().custom(checkNotItself("A game is not related to itself")),
    }),
  ],
  preview: {
    select: { title: "name", slug: "slug.current", kind: "kind", media: "logo" },
    prepare: ({ title, slug, kind, media }: { title?: string; slug?: string; kind?: string; media?: PreviewValue["media"] }) => ({
      title: title ?? "Untitled game",
      subtitle: [slug, kind && kind !== "game" ? kind : undefined].filter(Boolean).join(" · "),
      media,
    }),
  },
  orderings: [
    { title: "Order on the hub", name: "order", by: [{ field: "order", direction: "asc" }, { field: "name", direction: "asc" }] },
    { title: "Name", name: "name", by: [{ field: "name", direction: "asc" }] },
  ],
})
