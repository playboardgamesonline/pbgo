import { MAX_SLUG_LENGTH, slugFromName } from "@pbgo/games/slug"
import { ThLargeIcon } from "@sanity/icons/ThLarge"
import { defineArrayMember, defineField, defineType, type PreviewValue } from "sanity"
import { GAME_KINDS } from "./constants"
import { checkCreatorsOnce, checkName, checkNotItself, checkPlayersMax, checkSlug } from "./rules"
import { translatedField } from "./translations"

/**
 * A game of the catalog: what the hub lists and shows of it, live or to come. Its tabs run from what it is to what is shown of it.
 * What is said or shown of it in a language is translated field by field (PLT-104): its tagline, its description, its link to the rules,
 * its logo, its cover, the front of its box and its name (`TRANSLATED_FIELDS`), each an array of rows with a language, English first. The
 * English `name` stays a plain text, the reference of the slug, the order and the search; `names` holds it in the other languages.
 * The rest (the figures, the credits, the references, the icon and the background) is the same in every language.
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
    translatedField({ name: "names", title: "Name in other languages (English: the name above)", kind: "localizedName", group: "identity" }),
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
    // The link under the credits of the game's page that leads to a shop that sells it: the page is drawn with it only when it is filled in
    defineField({
      name: "buyUrl",
      title: "Where to buy (a shop's page for the game)",
      type: "url",
      group: "credits",
      validation: (rule) => rule.uri({ scheme: ["https"] }),
    }),

    // Texts: a row per language, English first
    translatedField({ name: "tagline", title: "Tagline", kind: "string", group: "texts" }),
    translatedField({ name: "description", title: "Description", kind: "description", group: "texts" }),

    // Rules: a link per language
    translatedField({ name: "rules", title: "Rules link", kind: "url", group: "rules" }),

    // Visuals: the cover, the logo and the front of the box can differ by language (a title written in it); the icon and the background do not
    translatedField({ name: "cover", title: "Cover", kind: "image", options: { hotspot: true }, group: "visuals" }),
    translatedField({ name: "logo", title: "Logo", kind: "image", group: "visuals" }),
    defineField({ name: "icon", title: "Icon", type: "image", group: "visuals" }),
    defineField({ name: "background", title: "Background", type: "image", options: { hotspot: true }, group: "visuals" }),
    translatedField({ name: "boxFront", title: "Box (front)", kind: "image", group: "visuals" }),

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
    select: { title: "name", slug: "slug.current", kind: "kind", media: "logo.0.value" },
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
