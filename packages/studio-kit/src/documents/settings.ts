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
    { name: "mechanics", title: "Mechanics" },
    { name: "visual", title: "Visual" },
  ],
  fields: [
    defineField({ name: "title", title: "Title", type: "string", group: "identity" }),
    defineField({ name: "description", title: "Description", description: "SEO and sharing", type: "text", rows: 3, group: "identity" }),
    defineField({ name: "logo", title: "Logo", type: "image", group: "identity" }),
    defineField({ name: "favicon", title: "Favicon", description: "Browser tab and home-screen icon (square PNG or SVG). Generated from the logo when empty.", type: "image", group: "identity" }),
    defineField({ name: "shareImage", title: "Share image", description: "1200×630 image shown when the link is shared. Generated from the visual identity when empty.", type: "image", group: "identity" }),
    defineField({ name: "minPlayers", title: "Min players", type: "number", group: "mechanics", validation: (r) => r.integer().min(1) }),
    defineField({ name: "maxPlayers", title: "Max players", type: "number", group: "mechanics", validation: (r) => r.integer().min(1) }),
    defineField({
      name: "theme",
      title: "Color theme",
      type: "object",
      group: "visual",
      fields: [
        color("background", "Background"),
        color("foreground", "Text"),
        color("accent", "Accent"),
        color("surface", "Surface"),
        color("surfaceDark", "Dark surface"),
      ],
    }),
    defineField({ name: "bodyFont", title: "Body font", type: "string", group: "visual", options: { list: [...FONT_CHOICES] } }),
    defineField({ name: "displayFont", title: "Display font", type: "string", group: "visual", options: { list: [...FONT_CHOICES] } }),
    defineField({ name: "bodyFontFile", title: "Body font file", description: "Overrides the body font (.woff2, .woff, .ttf, .otf)", type: "file", group: "visual", options: { accept: ".woff2,.woff,.ttf,.otf" } }),
    defineField({ name: "displayFontFile", title: "Display font file", description: "Overrides the display font", type: "file", group: "visual", options: { accept: ".woff2,.woff,.ttf,.otf" } }),
    defineField({
      name: "turnTimeout",
      title: "Absent player timeout (s)",
      description: "Seconds without a move before the other players can play for the absent one",
      type: "number",
      group: "mechanics",
      validation: (r) => r.integer().min(20).max(600),
    }),
    defineField({
      name: "gameOptions",
      title: "Game options",
      description: "Edited from the admin (Mechanics)",
      type: "object",
      group: "mechanics",
      readOnly: true,
      fields: [
        defineField({ name: "defaults", title: "Default values (JSON)", type: "string" }),
        defineField({ name: "hidden", title: "Hidden in the lobby", type: "array", of: [{ type: "string" }] }),
      ],
    }),
    defineField({ name: "rulesPdfFrFile", title: "Rules PDF (FR)", type: "file", group: "mechanics", options: { accept: "application/pdf" } }),
    defineField({ name: "rulesPdfEnFile", title: "Rules PDF (EN)", type: "file", group: "mechanics", options: { accept: "application/pdf" } }),
    defineField({ name: "rulesPdfEsFile", title: "Rules PDF (ES)", type: "file", group: "mechanics", options: { accept: "application/pdf" } }),
    defineField({ name: "rulesPdfDeFile", title: "Rules PDF (DE)", type: "file", group: "mechanics", options: { accept: "application/pdf" } }),
    defineField({ name: "rulesPdfFr", title: "Rules PDF link (FR)", description: "Used when no file is uploaded", type: "url", group: "mechanics" }),
    defineField({ name: "rulesPdfEn", title: "Rules PDF link (EN)", description: "Used when no file is uploaded", type: "url", group: "mechanics" }),
    defineField({ name: "rulesPdfEs", title: "Rules PDF link (ES)", description: "Used when no file is uploaded", type: "url", group: "mechanics" }),
    defineField({ name: "rulesPdfDe", title: "Rules PDF link (DE)", description: "Used when no file is uploaded", type: "url", group: "mechanics" }),
    defineField({ name: "descriptionI18n", title: "Description (all languages)", description: "Edited from the admin (Identity). French also lives in “Description”.", type: "localeText", group: "identity" }),
    defineField({ name: "creditsAuthorsI18n", title: "A game by (all languages)", description: "Edited from the admin (Identity)", type: "localeString", group: "identity" }),
    defineField({
      name: "creditsAuthors",
      title: "A game by",
      description: "Footer text after “un jeu de”, e.g. Romaric Galonnier et Anthony Perone, illustré par Noëmie Chevalier. Empty for an original game.",
      type: "string",
      group: "identity",
    }),
    defineField({ name: "publisher", title: "Publisher", description: "e.g. Catch Up Games", type: "string", group: "identity" }),
    defineField({ name: "publisherUrl", title: "Publisher website", description: "Link on the publisher name", type: "url", group: "identity" }),
  ],
  preview: { prepare: () => ({ title: "Settings" }) },
})
