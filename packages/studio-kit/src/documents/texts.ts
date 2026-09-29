import { DocumentTextIcon } from "@sanity/icons/DocumentText"
import { defineField, defineType } from "sanity"
import { UI_TEXT_GROUPS, UI_TEXTS } from "../constants"

export const texts = defineType({
  name: "texts",
  title: "Texts",
  type: "document",
  icon: DocumentTextIcon,
  groups: [{ name: "content", title: "Content", default: true }, ...UI_TEXT_GROUPS.map((g) => ({ name: g.name, title: `UI · ${g.title}` }))],
  fields: [
    defineField({ name: "tagline", title: "Tagline", type: "localeString", group: "content" }),
    defineField({ name: "homeTitle", title: "Home title", description: "Above the intro text on the home screen", type: "localeString", group: "content" }),
    defineField({ name: "homeIntro", title: "Home intro", description: "Replaces the tagline on the home screen", type: "localeText", group: "content" }),
    defineField({ name: "victoryPhrases", title: "Victory phrases", description: "{pseudo} and {points} are replaced", type: "localeStringList", group: "content" }),
    ...UI_TEXT_GROUPS.map((g) =>
      defineField({
        name: `ui_${g.name}`,
        title: `Interface labels · ${g.title}`,
        description: "Leave a label empty to keep its default",
        type: "object",
        group: g.name,
        options: { collapsible: false },
        fields: UI_TEXTS.filter((t) => t.group === g.name).map((t) =>
          defineField({ name: t.key, title: t.title, description: `Default: ${t.fr}`, type: "localeString" }),
        ),
      }),
    ),
  ],
  preview: { prepare: () => ({ title: "Texts" }) },
})
