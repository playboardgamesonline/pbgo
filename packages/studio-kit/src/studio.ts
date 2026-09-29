import { visionTool } from "@sanity/vision"
import { BookIcon } from "@sanity/icons/Book"
import { CogIcon } from "@sanity/icons/Cog"
import { DocumentTextIcon } from "@sanity/icons/DocumentText"
import { ImagesIcon } from "@sanity/icons/Images"
import { ThLargeIcon } from "@sanity/icons/ThLarge"
import { defineConfig, type SchemaTypeDefinition } from "sanity"
import { structureTool, type StructureResolver } from "sanity/structure"
import { interfaceDoc } from "./documents/interface"
import { rules } from "./documents/rules"
import { settings } from "./documents/settings"
import { texts } from "./documents/texts"
import { localeString, localeStringList, localeText } from "./objects/locale"

export const commonSchemaTypes: SchemaTypeDefinition[] = [settings, interfaceDoc, rules, texts, localeString, localeText, localeStringList]

const COMMON_SINGLETONS = [
  { id: "settings", title: "Settings", icon: CogIcon },
  { id: "interface", title: "Interface", icon: ImagesIcon },
  { id: "game", title: "Game", icon: ThLargeIcon },
  { id: "rules", title: "Rules", icon: BookIcon },
  { id: "texts", title: "Texts", icon: DocumentTextIcon },
]

type StudioOptions = {
  title: string
  projectId: string
  dataset?: string
  /** Types propres au jeu (ex. le singleton `game`, les cartes…) */
  gameTypes?: SchemaTypeDefinition[]
  /** Documents non-singletons listés sous les singletons (ex. ["card", "role"]) */
  collections?: { type: string; title: string }[]
}

export function createStudioConfig({ title, projectId, dataset = "production", gameTypes = [], collections = [] }: StudioOptions) {
  const types = [...commonSchemaTypes, ...gameTypes]
  const names = new Set(types.map((t) => t.name))
  const singletons = COMMON_SINGLETONS.filter((s) => names.has(s.id))
  const singletonIds = singletons.map((s) => s.id)

  const structure: StructureResolver = (S) =>
    S.list()
      .title("Contenu")
      .items([
        ...singletons.map((s) => S.listItem().title(s.title).icon(s.icon).child(S.document().schemaType(s.id).documentId(s.id))),
        ...(collections.length ? [S.divider(), ...collections.map((c) => S.documentTypeListItem(c.type).title(c.title))] : []),
      ])

  return defineConfig({
    name: "default",
    title,
    projectId,
    dataset,
    plugins: [structureTool({ structure }), visionTool()],
    schema: {
      types,
      templates: (templates) => templates.filter(({ schemaType }) => !singletonIds.includes(schemaType)),
    },
    document: {
      actions: (actions, { schemaType }) =>
        singletonIds.includes(schemaType) ? actions.filter(({ action }) => action && ["publish", "discardChanges", "restore"].includes(action)) : actions,
    },
  })
}
