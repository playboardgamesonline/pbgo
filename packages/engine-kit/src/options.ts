/**
 * Options de partie déclaratives.
 *
 * - `group: "parameter"` (défaut) : réglage de la partie (nombre de manches, mode…).
 * - `group: "extension"` : module optionnel du jeu (extension, variante, règle avancée). Toujours un booléen, désactivé par défaut.
 *
 * Contraintes (toutes facultatives, appliquées par `normalizeOptions`) :
 * - `requires`     : clés d'options qui doivent être actives pour que celle-ci le soit.
 * - `conflictsWith`: clés incompatibles ; la première déclarée dans le jeu gagne.
 * - `players`      : nombre de joueurs pour lequel l'option est disponible.
 */
type OptionBase = {
  label: string
  help?: string
  group?: "parameter" | "extension"
  icon?: string
  requires?: string[]
  conflictsWith?: string[]
  players?: { min?: number; max?: number }
}

export type OptionDefinition =
  | (OptionBase & { type: "number"; defaultValue: number; min: number; max: number; step?: number })
  | (OptionBase & { type: "choice"; defaultValue: string; choices: { value: string; label: string }[] })
  | (OptionBase & { type: "boolean"; defaultValue: boolean })

export type OptionDefinitions = Record<string, OptionDefinition>

export type OptionValue = number | string | boolean
export type OptionValues = Record<string, OptionValue>

/** Combinaison d'options nommée, proposée en un clic dans le lobby (ex. « Partie rapide », « Expert »). */
export type OptionPreset = { id: string; label: string; help?: string; values: OptionValues }

export type OptionContext = { playerCount?: number }

export type OptionStatus = { available: boolean; reason?: "players" | "requires" | "conflicts"; with?: string[] }

export function optionGroup(def: OptionDefinition): "parameter" | "extension" {
  return def.group ?? "parameter"
}

export function defaultOptions(definitions: OptionDefinitions): OptionValues {
  return Object.fromEntries(Object.entries(definitions).map(([key, def]) => [key, def.defaultValue]))
}

function isActive(def: OptionDefinition, value: OptionValue | undefined): boolean {
  return def.type === "boolean" ? value === true : value !== undefined && value !== def.defaultValue
}

function coerce(def: OptionDefinition, v: unknown): OptionValue {
  switch (def.type) {
    case "number": {
      const n = typeof v === "number" && Number.isFinite(v) ? v : def.defaultValue
      const step = def.step ?? 1
      const rounded = Math.round((n - def.min) / step) * step + def.min
      return Math.min(def.max, Math.max(def.min, rounded))
    }
    case "choice":
      return typeof v === "string" && def.choices.some((c) => c.value === v) ? v : def.defaultValue
    case "boolean":
      return typeof v === "boolean" ? v : def.defaultValue
  }
}

/** Pourquoi une option est (in)disponible avec ces valeurs et ce nombre de joueurs. Sert au lobby (grisé + raison) et à la normalisation. */
export function optionStatus(definitions: OptionDefinitions, values: OptionValues, key: string, ctx: OptionContext = {}): OptionStatus {
  const def = definitions[key]
  if (!def) return { available: false }
  const { playerCount } = ctx
  if (playerCount !== undefined && def.players) {
    if ((def.players.min !== undefined && playerCount < def.players.min) || (def.players.max !== undefined && playerCount > def.players.max)) return { available: false, reason: "players" }
  }
  const missing = (def.requires ?? []).filter((k) => definitions[k] && !isActive(definitions[k]!, values[k]))
  if (missing.length) return { available: false, reason: "requires", with: missing }
  const keys = Object.keys(definitions)
  const clash = (def.conflictsWith ?? [])
    .concat(keys.filter((k) => definitions[k]!.conflictsWith?.includes(key)))
    .filter((k, i, a) => a.indexOf(k) === i && definitions[k] && isActive(definitions[k]!, values[k]))
    .filter((k) => keys.indexOf(k) < keys.indexOf(key))
  if (clash.length) return { available: false, reason: "conflicts", with: clash }
  return { available: true }
}

export function normalizeOptions(definitions: OptionDefinitions, entry: unknown, ctx: OptionContext = {}): OptionValues {
  const raw = entry && typeof entry === "object" ? (entry as Record<string, unknown>) : {}
  const values: OptionValues = Object.fromEntries(Object.entries(definitions).map(([key, def]) => [key, coerce(def, raw[key])]))
  // Les contraintes se propagent dans l'ordre de déclaration : à répéter tant qu'une option est ramenée à son défaut.
  for (let pass = 0; pass < Object.keys(definitions).length + 1; pass++) {
    let changed = false
    for (const [key, def] of Object.entries(definitions)) {
      if (isActive(def, values[key]) && !optionStatus(definitions, values, key, ctx).available) {
        values[key] = def.defaultValue
        changed = true
      }
    }
    if (!changed) break
  }
  return values
}

/** Preset appliqué sur les valeurs courantes puis normalisé (un preset ne peut pas contourner les contraintes). */
export function applyPreset(definitions: OptionDefinitions, preset: OptionPreset, ctx: OptionContext = {}): OptionValues {
  return normalizeOptions(definitions, { ...defaultOptions(definitions), ...preset.values }, ctx)
}

/** Un preset est « actif » quand toutes ses valeurs sont déjà celles de la partie. */
export function presetMatches(preset: OptionPreset, values: OptionValues): boolean {
  return Object.entries(preset.values).every(([k, v]) => values[k] === v)
}
