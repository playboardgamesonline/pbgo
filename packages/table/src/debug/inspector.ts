/** Three numbers: a position on the table, in world units */
export type Triple = readonly [x: number, y: number, z: number]

/** What a card is doing, read at the moment it is asked for */
export type CardReading = {
  /** The game's own id for the card, if it gave one */
  id: string
  /** Where the card is, and where its `target` says it should lie */
  position: Triple
  target: Triple
  /** The size it has, and the size of its target */
  scale: number
  targetScale: number
  /** The flight it is on: seconds in (negative while it waits its turn) of how many it lasts. None when it glides or rests */
  flight: { time: number; duration: number } | null
  /** The name of its glow, as the game gave it to `defineGlows` */
  glow: string | null
}

let current: { key: symbol; read: () => CardReading } | null = null

/**
 * The card under the pointer, for the Inspector folder of the debug panel. A card puts itself forward when the pointer comes onto it and takes itself back when the pointer
 * leaves; only the debug panel asks for the reading, and only when its Inspector is on.
 */
export const inspector = {
  enter(key: symbol, read: () => CardReading) {
    current = { key, read }
  },
  /** A card only takes itself back: another one may have been pointed at since */
  leave(key: symbol) {
    if (current?.key === key) current = null
  },
  reading(): CardReading | null {
    return current ? current.read() : null
  },
}

const places = (t: Triple) => t.map((n) => n.toFixed(2)).join(" · ")

/** The lines the Inspector folder shows, one for each thing a card is doing */
export function describeCard(reading: CardReading | null) {
  if (!reading) return { card: "none", at: "—", target: "—", scale: "—", flight: "—", glow: "—" }
  const { flight } = reading
  return {
    card: reading.id,
    at: places(reading.position),
    target: places(reading.target),
    scale: `${reading.scale.toFixed(2)} → ${reading.targetScale.toFixed(2)}`,
    flight: !flight ? "at rest" : flight.time < 0 ? `waits ${(-flight.time).toFixed(2)} s` : `${Math.round(Math.min(1, flight.time / flight.duration) * 100)} % of ${flight.duration.toFixed(2)} s`,
    glow: reading.glow ?? "none",
  }
}
