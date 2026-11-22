# Sounds

A board makes its sounds through the platform's sound engine (`playSound` of `@pbgo/core/lib/sound`), never with an audio element of its own, and no file is in the code. A game **declares** the effects it plays in the `SOUNDS` of its binding (a volume, a spread of pitch, a least gap between two plays), and the owner uploads a file for each in Gamemaster › Audio, the `audio` document of the game's Sanity project. An effect with no file stays silent, and a sound that a game did not declare is not played. The blocks of the table play the sounds that say what they do, so a board writes no sound for what a card shows; what no card shows is a line of the log, which says its sound with `useLogSounds`.

The files are the owner's, so the table never makes one. This page is about the names, the mix and the moments, and `packages/core/lib/sound-config.ts` (the names and the mix), `packages/core/lib/sound-cues.ts` (the cues of a line) and `packages/table/src/card/sounds.ts` (what a card plays, when) hold what is pure, tested without an audio context.

## The effects every board shares

The names are the platform's, the same in every game, so one vocabulary of sounds goes from table to table. `SHARED_EFFECTS` holds a mix for each to start from, and a game declares the ones it has files for, with its own beside them:

```ts
export const SOUNDS = { effects: { ...SHARED_EFFECTS, eliminate: { volume: 0.5, spread: 0.02, minGap: 0.1 } } } satisfies SoundConfig
```

| Effect | Played by | When |
| --- | --- | --- |
| `click` | The platform's buttons | A button of the platform is pressed |
| `turn` | The announcements (`announce(…, { sound: "turn" })`) | It is the viewer's turn |
| `victory` | The announcements | The game is won |
| `hover` | `Card` | A card that can be chosen comes under the pointer or the keyboard focus |
| `select` | `Card` | A card is pressed or picked |
| `slide` | `Card` | A card flies off |
| `place` | `Card` | A card lands |

A field of an effect is read by the sound engine: `volume` (its own level, before the buses), `spread` (how far the pitch moves about 1, so that no two plays are alike), `minGap` (seconds: the same effect is not played twice within it). The mix is the game's to tune in its `SOUNDS`; the files are Gamemaster's.

## A card's sounds

A `Card` plays its own sounds, so a board wires none of them:

- **State.** The visitor's doing makes a sound: a card that can be chosen and is now under the pointer or the keyboard focus plays `hover`, and a card that is pressed or picked plays `select`, once: the press makes it and the pick that follows does not (`soundOfTransition`). What the game does to a card, making it one that can be chosen, disabling it, putting it out, makes none, and the first time a card is drawn is no change.
- **Flight.** A card that flies plays `slide` as it leaves and `place` as it lands, on the audio clock and counted from the delay it waits for its turn (`flightCues`), so a deal that goes round the table is heard card by card, in time with the cards. A card that does not fly, one that is there when the table opens or when the visitor asks for less motion, makes no flight sound. The sound engine keeps the din down: two plays of one effect within its `minGap` are one, and one that follows another within 0.4 s is a little quieter.
- A game that has not declared an effect hears nothing and is told nothing: the card plays it as `optional`.

## The sounds of the log

What happens that no card shows, an elimination, a reveal, the end of a round, is a line of the log, and `useLogSounds` of `@pbgo/core/components/game/use-log-sounds` plays the sounds of each line as it comes. `cues` says which effects a line makes and when, in seconds from the moment it is played:

```ts
useLogSounds<Event>({
  cues: (line) => {
    if (line.event.type === "eliminated") return [{ name: "eliminate", delay: 1.2 }]
    return []
  },
})
```

A cue is `{ name, delay?, volume?, bus? }` (`SoundCue`): the effect, when (counted on the audio clock, to keep time with an animation), how loud (a share of its own level) and on which bus (`effects`, or `alerts` for an announcement's). It plays by the rules of the log player (`createLogPlayer`, as `usePlayLog` does):

- The first time it is given the log it plays nothing: a table that is opened or reloaded is silent.
- A backlog that comes at once, more than twelve lines after an absence, plays nothing, and a tab that is hidden plays nothing.
- Lines that come together are heard one after the other, `gap` seconds apart (`LINE_GAP`, 0.15), and a cue's own `delay` counts from there (`scheduleCues`).
- Reduced motion does not silence it: a sound is not a motion. The visitor's own sound setting does, in the platform's menu.

## Rules a board follows

- A board plays no sound for a card that moves or is touched: the card does. It plays what no card shows, with `useLogSounds`, and never calls `playSound` from a render.
- A board declares the effects it plays in `SOUNDS`, and a name it plays is one it declared (`playSound` says so once, in development, when it is not).
- A board never types a file, a URL or a number of seconds of a recording: the files are in Sanity and the owner's, and a delay is counted from the line.
