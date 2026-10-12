/**
 * Declarative game options.
 *
 * - `group: "parameter"` (default): a setting of the game (number of rounds, mode…).
 * - `group: "extension"`: an optional module of the game (expansion, variant, advanced rule). Always a boolean, off by default.
 *
 * Constraints (all optional, applied by `normalizeOptions`):
 * - `requires`     : option keys that must be active for this one to be.
 * - `conflictsWith`: incompatible keys; the one declared first in the game wins.
 * - `players`      : number of players for which the option is available.
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

/** Named combination of options, offered in one click in the lobby (e.g. "Quick game", "Expert"). */
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

/** Why an option is (un)available with these values and this number of players. Used by the lobby (greyed out + reason) and by normalization. */
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
  // Constraints propagate in declaration order: repeat while an option is reset to its default.
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

/** Preset applied over the defaults, then normalized (a preset cannot bypass the constraints). */
export function applyPreset(definitions: OptionDefinitions, preset: OptionPreset, ctx: OptionContext = {}): OptionValues {
  return normalizeOptions(definitions, { ...defaultOptions(definitions), ...preset.values }, ctx)
}

/** A preset is "active" when all its values are already the game's. */
export function presetMatches(preset: OptionPreset, values: OptionValues): boolean {
  return Object.entries(preset.values).every(([k, v]) => values[k] === v)
}
