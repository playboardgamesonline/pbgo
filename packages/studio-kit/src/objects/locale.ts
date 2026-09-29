import { defineField, defineType } from "sanity"
import { LANGUAGES } from "../constants"

export const localeString = defineType({
  name: "localeString",
  title: "Localized string",
  type: "object",
  fields: LANGUAGES.map(({ id, title }) => defineField({ name: id, title, type: "string" })),
})

export const localeText = defineType({
  name: "localeText",
  title: "Localized text",
  type: "object",
  fields: LANGUAGES.map(({ id, title }) => defineField({ name: id, title, type: "text", rows: 3 })),
})

export const localeStringList = defineType({
  name: "localeStringList",
  title: "Localized list",
  type: "object",
  fields: LANGUAGES.map(({ id, title }) => defineField({ name: id, title, type: "array", of: [{ type: "string" }] })),
})
