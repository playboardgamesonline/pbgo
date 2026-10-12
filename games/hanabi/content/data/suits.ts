import { SUIT_KEYS } from "../../apps/studio/schemaTypes/constants.ts"
import type { DirectionKey, ExtensionKey, PatternKey, SuitKey } from "../../apps/studio/schemaTypes/constants.ts"
import { localeString } from "../lib/locale.ts"
import type { Localized } from "../lib/locale.ts"
import type { SeedDoc } from "../lib/types.ts"

type SuitSpec = {
  name: Localized
  /** Main color; the multicolor suit gets a flat fallback */
  color: string
  extension: ExtensionKey
  direction: DirectionKey
  /** Shape and letter tell the suits apart without color, the pattern is a third channel */
  symbol: string
  letter: string
  pattern: PatternKey
}

// The rulebook defines no hex values, symbols, letters or patterns: this is the first proposal of PBGO, editable in the Studio.
// Letters are English initials on purpose: the French ones clash (Blanc and Bleu).
const SPECS: Record<SuitKey, SuitSpec> = {
  white: { name: { fr: "Blanc", en: "White", es: "Blanco", de: "Weiß" }, color: "#F2F2EE", extension: "base", direction: "ascending", symbol: "circle", letter: "W", pattern: "none" },
  red: { name: { fr: "Rouge", en: "Red", es: "Rojo", de: "Rot" }, color: "#D8412F", extension: "base", direction: "ascending", symbol: "triangle", letter: "R", pattern: "dots" },
  blue: { name: { fr: "Bleu", en: "Blue", es: "Azul", de: "Blau" }, color: "#2F6FD8", extension: "base", direction: "ascending", symbol: "square", letter: "B", pattern: "diagonal-hatch" },
  yellow: { name: { fr: "Jaune", en: "Yellow", es: "Amarillo", de: "Gelb" }, color: "#F2C230", extension: "base", direction: "ascending", symbol: "star", letter: "Y", pattern: "stripes" },
  green: { name: { fr: "Vert", en: "Green", es: "Verde", de: "Grün" }, color: "#3FA34D", extension: "base", direction: "ascending", symbol: "diamond", letter: "G", pattern: "crosshatch" },
  multi: { name: { fr: "Multicolore", en: "Multicolor", es: "Multicolor", de: "Mehrfarbig" }, color: "#8E5BD9", extension: "avalanche", direction: "ascending", symbol: "hexagon", letter: "M", pattern: "rainbow-stripes" },
  black: { name: { fr: "Noir", en: "Black", es: "Negro", de: "Schwarz" }, color: "#26262B", extension: "blackPowder", direction: "descending", symbol: "cross", letter: "K", pattern: "solid" },
}

export const suitId = (key: SuitKey) => `suit-${key}`

/** The firework of a suit is built upwards (1 to 5) except the black one. */
export const directionOf = (key: SuitKey): DirectionKey => SPECS[key].direction

export const extensionOf = (key: SuitKey): ExtensionKey => SPECS[key].extension

export function buildSuits(): SeedDoc[] {
  return SUIT_KEYS.map((key) => {
    const spec = SPECS[key]
    return {
      _id: suitId(key),
      _type: "suit",
      key,
      name: localeString(spec.name),
      color: spec.color,
      extension: spec.extension,
      direction: spec.direction,
      symbol: spec.symbol,
      letter: spec.letter,
      pattern: spec.pattern,
    }
  })
}
