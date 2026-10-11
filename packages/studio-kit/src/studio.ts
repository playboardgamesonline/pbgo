import { visionTool } from "@sanity/vision"
import { BookIcon } from "@sanity/icons/Book"
import { CogIcon } from "@sanity/icons/Cog"
import { DocumentTextIcon } from "@sanity/icons/DocumentText"
import { ImagesIcon } from "@sanity/icons/Images"
import { PlayIcon } from "@sanity/icons/Play"
import { ThLargeIcon } from "@sanity/icons/ThLarge"
import { defineConfig, type SchemaTypeDefinition } from "sanity"
import { structureTool, type StructureResolver } from "sanity/structure"
import { audio } from "./documents/audio"
import { interfaceDoc } from "./documents/interface"
import { rules } from "./documents/rules"
import { settings } from "./documents/settings"
import { texts } from "./documents/texts"
import { localeString, localeStringList, localeText } from "./objects/locale"

export const commonSchemaTypes: SchemaTypeDefinition[] = [settings, interfaceDoc, audio, rules, texts, localeString, localeText, localeStringList]

// Same breakdown as the site admin: Identity · Mechanics (settings), Visual (interface), Audio, Copy (texts), then the game's content
const COMMON_SINGLETONS = [
  { id: "settings", title: "Identity & Mechanics", icon: CogIcon },
  { id: "interface", title: "Visual", icon: ImagesIcon },
  { id: "audio", title: "Audio", icon: PlayIcon },
  { id: "texts", title: "Copy", icon: DocumentTextIcon },
  { id: "rules", title: "Rules", icon: BookIcon },
  { id: "game", title: "Game", icon: ThLargeIcon },
]

type StudioOptions = {
  title: string
  projectId: string
  dataset?: string
  /** Game-specific types (e.g. the `game` singleton, the cards…); same name as a shared type = replacement */
  gameTypes?: SchemaTypeDefinition[]
  /** Non-singleton documents listed under the singletons (e.g. ["card", "role"]) */
  collections?: { type: string; title: string }[]
}

export function createStudioConfig({ title, projectId, dataset = "production", gameTypes = [], collections = [] }: StudioOptions) {
  // A game type with the same name as a shared type replaces it (e.g. game-specific rules)
  const gameNames = new Set(gameTypes.map((t) => t.name))
  const types = [...commonSchemaTypes.filter((t) => !gameNames.has(t.name)), ...gameTypes]
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
