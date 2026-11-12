// The checks, in the order they run for a game, and what each one is for.
import { absent } from "./absent.mjs"
import { opening } from "./opening.mjs"
import { presses } from "./presses.mjs"
import { reload } from "./reload.mjs"
import { scenarios } from "./scenarios.mjs"
import { sizes } from "./sizes.mjs"

export const CHECKS = {
  presses: { run: presses, what: "the viewer's side played with the mouse: every control is reachable and a press moves the table", seats: "every" },
  sizes: { run: sizes, what: "the board in every window the platform lets in, as a sheet", seats: "every" },
  scenarios: { run: scenarios, what: "the cases that GAME.debug can rig, recorded as frames", seats: "every" },
  reload: { run: reload, what: "a reload in the middle of a game: nothing flies in again", seats: "every" },
  opening: { run: opening, what: "the normal start with the ready check, recorded", seats: "every" },
  absent: { run: absent, what: "players who are away: the board keeps working", seats: "fewest" },
}
