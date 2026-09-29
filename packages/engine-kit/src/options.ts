export type OptionDefinition =
  | { type: "number"; label: string; help?: string; defaultValue: number; min: number; max: number; step?: number }
  | { type: "choice"; label: string; help?: string; defaultValue: string; choices: { value: string; label: string }[] }
  | { type: "boolean"; label: string; help?: string; defaultValue: boolean }

export type OptionDefinitions = Record<string, OptionDefinition>

export type OptionValue = number | string | boolean
export type OptionValues = Record<string, OptionValue>

export function defaultOptions(definitions: OptionDefinitions): OptionValues {
  return Object.fromEntries(Object.entries(definitions).map(([key, def]) => [key, def.defaultValue]))
}

export function normalizeOptions(definitions: OptionDefinitions, entry: unknown): OptionValues {
  const raw = entry && typeof entry === "object" ? (entry as Record<string, unknown>) : {}
  return Object.fromEntries(
    Object.entries(definitions).map(([key, def]) => {
      const v = raw[key]
      switch (def.type) {
        case "number": {
          const n = typeof v === "number" && Number.isFinite(v) ? v : def.defaultValue
          const step = def.step ?? 1
          const rounded = Math.round((n - def.min) / step) * step + def.min
          return [key, Math.min(def.max, Math.max(def.min, rounded))]
        }
        case "choice":
          return [key, typeof v === "string" && def.choices.some((c) => c.value === v) ? v : def.defaultValue]
        case "boolean":
          return [key, typeof v === "boolean" ? v : def.defaultValue]
      }
    }),
  )
}
