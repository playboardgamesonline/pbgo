import type { OptionDefinitions, OptionPreset } from "./options"

// An engine declares no text: the words of its options, its presets and the lines of its score are texts of the game, written in its Sanity (`texts.engineTexts`), in every language
// of the game. The engine and the platform meet on these keys.

export const optionLabelKey = (option: string) => `option.${option}.label`
export const optionHelpKey = (option: string) => `option.${option}.help`
export const choiceLabelKey = (option: string, value: string) => `option.${option}.choice.${value}`
export const presetLabelKey = (preset: string) => `preset.${preset}.label`
export const presetHelpKey = (preset: string) => `preset.${preset}.help`
export const scoreLabelKey = (line: string) => `score.${line}`

/** A key in words, for the gamemaster's Copy page: `option.mode.choice.fast` → `Option "mode": choice "fast"`. A key it does not know is returned as it is. */
export function describeTextKey(key: string): string {
  const option = /^option\.([^.]+)\.(label|help|choice\.(.+))$/.exec(key)
  if (option) return option[2] === "label" ? `Option "${option[1]}"` : option[2] === "help" ? `Option "${option[1]}": help` : `Option "${option[1]}": choice "${option[3]}"`
  const preset = /^preset\.([^.]+)\.(label|help)$/.exec(key)
  if (preset) return preset[2] === "label" ? `Preset "${preset[1]}"` : `Preset "${preset[1]}": help`
  const score = /^score\.(.+)$/.exec(key)
  return score ? `Score line "${score[1]}"` : key
}

/**
 * The texts a definition needs. `required` ones are read on the table and read `[missing: <key>]` until Sanity holds them: the label of each option, of each choice and of each preset,
 * and of each line of score the definition lists in `scoreLines`. `optional` ones are drawn when there is one and left out when there is not: the help of an option or of a preset.
 */
export function engineTextKeys(game: { options: OptionDefinitions; presets?: readonly OptionPreset[]; scoreLines?: readonly string[] }): { required: string[]; optional: string[] } {
  const required: string[] = []
  const optional: string[] = []
  for (const [key, def] of Object.entries(game.options)) {
    required.push(optionLabelKey(key))
    optional.push(optionHelpKey(key))
    if (def.type === "choice") for (const choice of def.choices) required.push(choiceLabelKey(key, choice.value))
  }
  for (const preset of game.presets ?? []) {
    required.push(presetLabelKey(preset.id))
    optional.push(presetHelpKey(preset.id))
  }
  for (const line of game.scoreLines ?? []) required.push(scoreLabelKey(line))
  return { required, optional }
}
