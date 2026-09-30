import { DocumentTextIcon } from "@sanity/icons/DocumentText"
import { defineField, defineType, type FieldDefinition } from "sanity"
import { UI_TEXT_GROUPS, UI_TEXTS } from "../constants"

/** Document « Texts » commun ; `extraFields` ajoute des textes propres au jeu (groupe « content » conseillé). */
export const createTexts = (extraFields: FieldDefinition[] = []) =>
  defineType({
  name: "texts",
  title: "Copy",
  type: "document",
  icon: DocumentTextIcon,
  groups: [
    { name: "content", title: "Content", default: true },
    ...UI_TEXT_GROUPS.map((g) => ({ name: g.name, title: `UI · ${g.title}` })),
    { name: "errors", title: "Errors" },
  ],
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
    defineField({
      name: "errorMessages",
      title: "Error messages",
      description: "Replaces the default message of an error code (edited from the admin, Copy)",
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
