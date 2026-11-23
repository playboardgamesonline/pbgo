/** One sound to play for a line of the log: the effect, when (seconds from now, on the audio clock: default at once), how loud (a share of its own volume: default 1) and on which bus (default the effects') */
export type SoundCue = { name: string; delay?: number; volume?: number; bus?: "effects" | "alerts" }

/** The seconds between the sounds of two lines that came together, so that a few lines made at once are heard one after the other and not on top of each other */
export const LINE_GAP = 0.15

/** The cues of the `index`th line of a batch of lines that came together, each put back by `gap` seconds for every line before it */
export function scheduleCues(cues: readonly SoundCue[], index: number, gap: number = LINE_GAP): SoundCue[] {
  return cues.map((cue) => ({ ...cue, delay: (cue.delay ?? 0) + index * gap }))
}
