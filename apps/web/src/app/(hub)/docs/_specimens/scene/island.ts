// The island of the road map specimen, as the engine knows it: a board of nineteen hexagons and the graph of its corners and sides. Both halves of the specimen read it, the controls to decide what can be built and the scene to draw it, and it imports
// nothing but the kit, so the controls do not pull in three.js.
import { cornerGraph, hexBoard } from "@pbgo/engine-kit"
import { ISLAND } from "./defaults"

export const ISLAND_BOARD = hexBoard({ radius: ISLAND.radius })
export const ISLAND_CORNERS = cornerGraph(ISLAND_BOARD)
