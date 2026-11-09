import type { LightsProps } from "../table/lights"
import type { SurfaceProps } from "../table/surface"

/**
 * What the Lights and Floor folders of the debug panel changed: the knobs the panel touched, and only those. The lights and the floor are props of the `Table`, not objects a
 * frame reads, so the pieces that draw them lay these over their props. Empty on a table nobody is tuning.
 */
export const LIGHTS_OVERRIDE: LightsProps = {}
export const FLOOR_OVERRIDE: Partial<Pick<SurfaceProps, "color" | "tile">> = {}

/** The camera's entrance plays again from the start: the number of times the panel asked for it. The camera rig counts */
export const ENTRANCE = { replays: 0 }
