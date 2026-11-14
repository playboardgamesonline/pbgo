"use client"

import { Button } from "@pbgo/ui/platform/button"
import { cn } from "@pbgo/ui/utils"
import { Choice, Knob, Option } from "../../_specimens/scene/controls"
import { PLAY_GLOWS, PLAY_LIMITS, PLAY_NAMES, PLAY_PIECES, type PlayPiece } from "../../_specimens/scene/defaults"
import { PRESET_IDS, PRESETS } from "../../_specimens/scene/play/presets"
import { addPoints, endRound, leader, nextTurn, resetScores } from "../../_specimens/scene/play/state"
import { TRANSITION_IDS, TRANSITIONS, type TransitionId } from "../../_specimens/scene/play/transitions"
import { PlaygroundMotion } from "../../_specimens/scene/lazy"
import type { Controls } from "./context"

const Heading = ({ children, hint }: { children: string; hint?: string }) => (
  <div className="flex flex-col gap-0.5">
    <h2 className="text-sm font-strong text-foreground">{children}</h2>
    {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
  </div>
)
const Kbd = ({ children }: { children: string }) => <kbd className="rounded-md border bg-muted/40 px-1.5 py-0.5 font-mono text-[0.7rem] text-muted-foreground">{children}</kbd>

/** The Scene tab: the scenes to start from, each a whole table in one press, and the view of the camera */
export function ScenePanel({ controls, onScene }: { controls: Controls; onScene: (id: (typeof PRESET_IDS)[number]) => void }) {
  const { state, set } = controls
  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <Heading hint="Each is a table that looks played on. Start from one, then add and switch things.">Start from a scene</Heading>
        <ul className="grid gap-2 @lg:grid-cols-2">
          {PRESET_IDS.map((id, k) => {
            const preset = PRESETS[id]
            const current = state.scene === id
            return (
              <li key={id}>
                <button
                  type="button"
                  aria-pressed={current}
                  onClick={() => onScene(id)}
                  className={cn("flex h-full w-full flex-col gap-1 rounded-2xl border p-3 text-left transition-colors hover:bg-muted/40 motion-reduce:transition-none", current && "border-foreground/50 bg-muted/40")}
                >
                  <span className="flex items-center justify-between gap-2 text-sm text-foreground">
                    {preset.name}
                    <Kbd>{String(k + 1)}</Kbd>
                  </span>
                  <span className="text-xs leading-snug text-muted-foreground">{preset.summary}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </section>
      <section className="flex flex-col gap-4">
        <Heading hint="Where the camera looks at the table from. A table seen from straight above has what is dragged under the pointer.">View</Heading>
        <div className="flex flex-wrap items-end gap-x-8 gap-y-5">
          <Knob label="Distance" value={state.zoom} min={PLAY_LIMITS.zoom.min} max={PLAY_LIMITS.zoom.max + 8} step={0.5} onChange={(zoom) => set({ zoom })} />
          <Knob label="Tilt" value={state.tilt} min={PLAY_LIMITS.tilt.min} max={PLAY_LIMITS.tilt.max} step={1} format={(value) => `${value}°`} onChange={(tilt) => set({ tilt })} />
          <Option label="Seen from above" checked={state.above} onChange={(above) => set({ above })} />
        </div>
      </section>
    </div>
  )
}

/** The Add tab: cards and pieces to put on the table, and what to do with the one that is picked */
export function AddPanel({ controls, shape, onShape }: { controls: Controls; shape: PlayPiece; onShape: (shape: PlayPiece) => void; }) {
  const { state, set, update, actions, full } = controls
  const picked = state.things.find((one) => one.id === state.selected) ?? null
  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-3">
        <Heading hint="They land in a free place of the table. Drag them anywhere.">Add to the table</Heading>
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
          <Button variant="outline" size="sm" disabled={full} onClick={() => actions.addCard()}>
            Add a card <Kbd>C</Kbd>
          </Button>
          <Choice label="Piece" value={shape} options={PLAY_PIECES.map((value) => ({ value, label: value }))} onChange={onShape} />
          <Button variant="outline" size="sm" disabled={full} onClick={() => actions.addPiece(shape)}>
            Add a {shape} <Kbd>P</Kbd>
          </Button>
          <Button variant="ghost" size="sm" disabled={state.things.length === 0} onClick={() => update((now) => ({ ...now, things: [], selected: null }))}>
            Clear the table
          </Button>
        </div>
        <p className="text-sm text-muted-foreground" aria-live="polite">
          <span className="text-foreground tabular-nums">{state.things.length}</span> of {PLAY_LIMITS.things} things on the table. Let one go on a cell of the board and it takes the cell, on the bin and it is gone, on the hand or the discard pile and a card joins it.
        </p>
      </section>
      <section className="flex flex-col gap-3">
        <Heading>The one that is picked</Heading>
        {picked ? (
          <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
            <span className="basis-full text-sm text-muted-foreground">A {picked.kind === "card" ? "card" : picked.shape}, picked.</span>
            {picked.kind === "card" && (
              <>
                <Button variant="outline" size="sm" onClick={() => actions.flip()}>
                  Turn it over <Kbd>F</Kbd>
                </Button>
                <Choice label="Glow" value={state.glow} options={PLAY_GLOWS.map((value) => ({ value, label: value }))} onChange={(glow) => set({ glow })} />
              </>
            )}
            <Button variant="outline" size="sm" onClick={() => actions.remove(picked.id)}>
              Remove it <Kbd>Del</Kbd>
            </Button>
            <Button variant="ghost" size="sm" onClick={() => set({ selected: null })}>
              Put it down <Kbd>Esc</Kbd>
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Press a card or a piece on the table to pick it: it lifts, and a card can wear a glow.</p>
        )}
      </section>
    </div>
  )
}

/** The Play tab: transitions to trigger and replay at the speed and with the easing you pick, the score to change, and the log of what happened */
export function PlayPanel({ controls, onRun, last, onReplay, canReplay }: { controls: Controls; onRun: (id: TransitionId) => void; last: TransitionId | null; onReplay: () => void; canReplay: boolean }) {
  const { state, update } = controls
  const top = leader(state)
  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <Heading hint="Each changes the table and its own blocks do the moving. A part it needs is switched on for you.">Transitions</Heading>
        <ul className="grid grid-cols-2 gap-2">
          {TRANSITION_IDS.map((id) => {
            const transition = TRANSITIONS[id]
            return (
              <li key={id}>
                <Button variant="outline" size="sm" className={cn("h-auto w-full flex-col items-start gap-0.5 py-2 text-left whitespace-normal", last === id && "border-foreground/50")} title={transition.hint} onClick={() => onRun(id)}>
                  <span className="flex w-full items-center justify-between gap-2">
                    {transition.label}
                    {transition.key && <Kbd>{transition.key}</Kbd>}
                  </span>
                  <span className="text-xs font-normal text-muted-foreground">{transition.hint}</span>
                </Button>
              </li>
            )
          })}
        </ul>
        <div className="flex items-center gap-3">
          <Button variant="secondary" size="sm" disabled={!canReplay} onClick={onReplay} title="Takes the last change back, then does it again">
            Replay
          </Button>
          <span className="text-sm text-muted-foreground">{last ? `Last: ${TRANSITIONS[last].label.toLowerCase()}. ` : ""}Replay takes the last change back and does it again.</span>
        </div>
        <PlaygroundMotion />
      </section>

      <section className="flex flex-col gap-3">
        <Heading hint={`Round ${state.score.round}${top === null ? ", nobody has scored yet" : `, ${PLAY_NAMES[top]} leads`}. The list at the top right of the table, the plates and the middle of the table follow.`}>Score</Heading>
        <ul className="flex flex-col gap-1.5">
          {PLAY_NAMES.slice(0, state.players).map((name, seat) => {
            const points = state.score.points[seat] ?? 0
            return (
              <li key={name} className={cn("flex items-center gap-2 rounded-xl border px-3 py-1.5", state.turn === seat && "border-foreground/40 bg-muted/40")}>
                <span className="min-w-0 flex-1 truncate text-sm">
                  {name}
                  {state.turn === seat && <span className="ml-2 text-xs text-muted-foreground">turn</span>}
                </span>
                <span className="w-24 text-right text-sm tabular-nums">
                  <span className="text-foreground">{(state.score.total[seat] ?? 0) + points}</span>
                  {points > 0 && <span className="text-muted-foreground"> (+{points})</span>}
                </span>
                {[-1, 1, 5].map((step) => (
                  <Button key={step} variant="outline" size="xs" aria-label={`${step > 0 ? "Add" : "Take"} ${Math.abs(step)} ${Math.abs(step) === 1 ? "point" : "points"} ${step > 0 ? "to" : "from"} ${name}`} disabled={step < 0 && points === 0} onClick={() => update((now) => addPoints(now, seat, step))}>
                    {step > 0 ? `+${step}` : "−1"}
                  </Button>
                ))}
              </li>
            )
          })}
        </ul>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => update(nextTurn)}>
            Next turn <Kbd>N</Kbd>
          </Button>
          <Button variant="outline" size="sm" onClick={() => update(endRound)}>
            End the round <Kbd>E</Kbd>
          </Button>
          <Button variant="ghost" size="sm" onClick={() => update(resetScores)}>
            Reset the scores
          </Button>
        </div>
        {!state.parts.scoreboard && <p className="text-sm text-muted-foreground">The scoreboard part is off: switch it on in the Parts tab to see these points on the table.</p>}
      </section>

      <section className="flex flex-col gap-3">
        <Heading hint="What happened, the newest first: the ticker of a game.">Log</Heading>
        {state.log.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing yet. Deal a card, score a point.</p>
        ) : (
          <ol className="flex flex-col gap-1 text-sm" aria-label="Log">
            {state.log.slice(0, 8).map((line, i) => (
              <li key={`${i}-${line}`} className={i === 0 ? "text-foreground" : "text-muted-foreground"}>
                {line}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  )
}
