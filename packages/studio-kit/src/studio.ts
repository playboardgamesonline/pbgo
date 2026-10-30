import { visionTool } from "@sanity/vision"
import { CogIcon } from "@sanity/icons/Cog"
import { DocumentTextIcon } from "@sanity/icons/DocumentText"
import { ImagesIcon } from "@sanity/icons/Images"
import { PlayIcon } from "@sanity/icons/Play"
import { ThLargeIcon } from "@sanity/icons/ThLarge"
import { defineConfig, type SchemaTypeDefinition } from "sanity"
import { structureTool, type DefaultDocumentNodeResolver, type StructureResolver } from "sanity/structure"
import { audio } from "./documents/audio"
import { interfaceDoc } from "./documents/interface"
import { settings } from "./documents/settings"
import { texts } from "./documents/texts"
import { localeString, localeStringList, localeText } from "./objects/locale"

export const commonSchemaTypes: SchemaTypeDefinition[] = [settings, interfaceDoc, audio, texts, localeString, localeText, localeStringList]

// Same breakdown as the site admin: Identity · Mechanics (settings), Visual (interface), Audio, Copy (texts), then the game's content.
// No rules document: the rules are PDF links, set in `settings` (Mechanics)
const COMMON_SINGLETONS = [
  { id: "settings", title: "Identity & Mechanics", icon: CogIcon },
  { id: "interface", title: "Visual", icon: ImagesIcon },
  { id: "audio", title: "Audio", icon: PlayIcon },
  { id: "texts", title: "Copy", icon: DocumentTextIcon },
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
  // A game type with the same name as a shared type replaces it (e.g. a `texts` with the game's own labels, see createTexts)
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

type StandaloneStudioOptions = {
  title: string
  projectId: string
  dataset?: string
  /** The Studio's own types: none of the shared game types (`settings`, `interface`, `audio`, `texts`, the locale objects) is added */
  types: SchemaTypeDefinition[]
  /** The sidebar: the Studio's own, not the singletons-then-collections list of a game */
  structure: StructureResolver
  /** What a document's pane shows beside its form (a tab that lists the games a person is credited in…), by type */
  defaultDocumentNode?: DefaultDocumentNodeResolver
}

/**
 * A Studio that is not a game's: the platform's own (`platform/apps/studio`). A game's Studio is `createStudioConfig`, with the shared
 * singletons of a game; this one registers the types it is given and shows the sidebar it is given, and nothing else.
 */
export function createStandaloneStudioConfig({ title, projectId, dataset = "production", types, structure, defaultDocumentNode }: StandaloneStudioOptions) {
  return defineConfig({
    name: "default",
    title,
    projectId,
    dataset,
    plugins: [structureTool({ structure, defaultDocumentNode }), visionTool()],
    schema: { types },
  })
}
