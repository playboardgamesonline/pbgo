import type { FieldDef, MemberDef, TypeDef, Types } from "./schema-check.ts"

// The rules every Studio form follows, in every game (skill `game-sanity-create`), read from the schema itself.

type Described = { description?: unknown; fields?: FieldDef[]; of?: MemberDef[] }

/** The path of every type, field and array member that carries a `description`, the grey sub-label under a field. */
function describedPaths(def: Described, path: string): string[] {
  const own = def.description === undefined ? [] : [path]
  const fields = (def.fields ?? []).flatMap((field) => describedPaths(field, `${path}.${field.name}`))
  const members = (def.of ?? []).flatMap((member) => describedPaths(member, `${path}[]`))
  return [...own, ...fields, ...members]
}

/** The `game` document holds the images of the board: they are filed in tabs, one of them open by default, and none is left out. */
function tabProblems(game: TypeDef): string[] {
  const groups = game.groups ?? []
  if (groups.length === 0) return ["game has no tabs (groups): file its fields in tabs, as in Courtisans (Board, Card backs…)"]
  const problems: string[] = []
  const defaults = groups.filter((group) => group.default === true).length
  if (defaults !== 1) problems.push(`game has ${defaults} default tabs, it needs exactly one`)
  const declared = new Set(groups.map((group) => group.name))
  for (const field of game.fields ?? []) {
    const tabs = [field.group ?? []].flat()
    if (tabs.length === 0) problems.push(`game.${field.name} is in no tab`)
    for (const tab of tabs) if (!declared.has(tab)) problems.push(`game.${field.name} is in the tab "${tab}", which game does not declare`)
  }
  return problems
}

/** The types a Studio registers, as it builds them: pass the default export of its `sanity.config.ts`. */
export function studioTypes(config: unknown): Types {
  const types = (config as { schema?: { types?: unknown } } | undefined)?.schema?.types
  if (!Array.isArray(types)) throw new Error("The Studio config has no list of schema types")
  return new Map((types as TypeDef[]).map((type) => [type.name, type]))
}

/**
 * What breaks the rules of the Studio forms in a schema (the shared singletons included):
 * a `description` anywhere, and a `game` document that is not split into tabs. Empty when the forms are right.
 */
export function formProblems(types: Types): string[] {
  const problems = [...types.values()].flatMap((type) =>
    describedPaths(type, type.name).map((path) => `${path} has a description: what matters goes in its title, or in the message of its validation`),
  )
  const game = types.get("game")
  if (game) problems.push(...tabProblems(game))
  return problems
}
