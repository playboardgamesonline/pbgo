import { DocumentTextIcon } from "@sanity/icons/DocumentText"
import { defineField, defineType, type FieldDefinition, type FieldGroupDefinition } from "sanity"
import { UI_TEXT_GROUPS, UI_TEXTS } from "../constants"

/** Shared "Texts" document; `extraFields` adds game-specific texts ("content" group recommended, or a tab of `extraGroups`). */
export const createTexts = (extraFields: FieldDefinition[] = [], extraGroups: FieldGroupDefinition[] = []) =>
  defineType({
  name: "texts",
  title: "Copy",
  type: "document",
  icon: DocumentTextIcon,
  groups: [
    { name: "content", title: "Content", default: true },
    ...UI_TEXT_GROUPS.map((g) => ({ name: g.name, title: `UI · ${g.title}` })),
    { name: "errors", title: "Errors" },
    ...extraGroups,
  ],
  fields: [
    defineField({ name: "tagline", title: "Tagline", type: "localeString", group: "content" }),
    defineField({ name: "homeTitle", title: "Home title", type: "localeString", group: "content" }),
    defineField({ name: "homeIntro", title: "Home intro", type: "localeText", group: "content" }),
    defineField({ name: "victoryPhrases", title: "Victory phrases ({pseudo}, {points})", type: "localeStringList", group: "content" }),
    ...UI_TEXT_GROUPS.map((g) =>
      defineField({
        name: `ui_${g.name}`,
        title: `Interface labels · ${g.title}`,
        type: "object",
        group: g.name,
        options: { collapsible: false },
        fields: UI_TEXTS.filter((t) => t.group === g.name).map((t) => defineField({ name: t.key, title: t.title, type: "localeString" })),
      }),
    ),
    defineField({
      name: "errorMessages",
      title: "Error messages",
      type: "array",
      group: "errors",
      of: [
        {
          type: "object",
          name: "errorMessage",
          fields: [
            defineField({ name: "code", title: "Code", type: "string" }),
            defineField({ name: "message", title: "Message", type: "localeString" }),
          ],
          preview: { select: { title: "code", subtitle: "message.fr" } },
        },
      ],
    }),
    ...extraFields,
  ],
  preview: { prepare: () => ({ title: "Copy" }) },
})

export const texts = createTexts()
