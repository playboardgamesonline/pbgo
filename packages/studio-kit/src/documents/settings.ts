import { CogIcon } from "@sanity/icons/Cog"
import { defineField, defineType } from "sanity"
import { FONT_CHOICES } from "../constants"

const HEX = /^#[0-9a-fA-F]{6}$/

const color = (name: string, title: string) =>
  defineField({ name, title, type: "string", validation: (r) => r.regex(HEX, { name: "hex color" }).warning() })

export const settings = defineType({
  name: "settings",
  title: "Settings",
  type: "document",
  icon: CogIcon,
  groups: [
    { name: "identity", title: "Identity", default: true },
    { name: "players", title: "Players" },
    { name: "theme", title: "Theme" },
    { name: "rules", title: "Rules" },
    { name: "credits", title: "Credits" },
  ],
  fields: [
    defineField({ name: "title", title: "Title", type: "string", group: "identity" }),
    defineField({ name: "description", title: "Description", description: "SEO and sharing", type: "text", rows: 3, group: "identity" }),
    defineField({ name: "logo", title: "Logo", type: "image", group: "identity" }),
    defineField({ name: "minPlayers", title: "Min players", type: "number", group: "players", validation: (r) => r.integer().min(1) }),
    defineField({ name: "maxPlayers", title: "Max players", type: "number", group: "players", validation: (r) => r.integer().min(1) }),
    defineField({
      name: "theme",
      title: "Color theme",
      type: "object",
      group: "theme",
      fields: [
        color("background", "Background"),
        color("foreground", "Text"),
        color("accent", "Accent"),
        color("surface", "Surface"),
        color("surfaceDark", "Dark surface"),
      ],
    }),
    defineField({ name: "bodyFont", title: "Body font", type: "string", group: "theme", options: { list: [...FONT_CHOICES] } }),
    defineField({ name: "displayFont", title: "Display font", type: "string", group: "theme", options: { list: [...FONT_CHOICES] } }),
    defineField({ name: "bodyFontFile", title: "Body font file", description: "Overrides the body font (.woff2, .woff, .ttf, .otf)", type: "file", group: "theme", options: { accept: ".woff2,.woff,.ttf,.otf" } }),
    defineField({ name: "displayFontFile", title: "Display font file", description: "Overrides the display font", type: "file", group: "theme", options: { accept: ".woff2,.woff,.ttf,.otf" } }),
    defineField({ name: "rulesPdfFrFile", title: "Rules PDF (FR)", type: "file", group: "rules", options: { accept: "application/pdf" } }),
    defineField({ name: "rulesPdfEnFile", title: "Rules PDF (EN)", type: "file", group: "rules", options: { accept: "application/pdf" } }),
    defineField({ name: "rulesPdfFr", title: "Rules PDF link (FR)", description: "Used when no file is uploaded", type: "url", group: "rules" }),
    defineField({ name: "rulesPdfEn", title: "Rules PDF link (EN)", description: "Used when no file is uploaded", type: "url", group: "rules" }),
    defineField({
      name: "creditsAuthors",
      title: "A game by",
      description: "Footer text after “un jeu de”, e.g. Romaric Galonnier et Anthony Perone, illustré par Noëmie Chevalier. Empty for an original game.",
      type: "string",
      group: "credits",
    }),
    defineField({ name: "publisher", title: "Publisher", description: "e.g. Catch Up Games", type: "string", group: "credits" }),
    defineField({ name: "publisherUrl", title: "Publisher website", description: "Link on the publisher name", type: "url", group: "credits" }),
  ],
  preview: { prepare: () => ({ title: "Settings" }) },
})
