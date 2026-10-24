"use client"

import { createContext, useContext } from "react"
import type { PoseMemory } from "./memory"

/** Carries the table's memory of the cards that left it. It sits inside the canvas, because React context does not cross into it */
export const PoseMemoryContext = createContext<PoseMemory | null>(null)

/** The memory of the table the card is on, null for a card drawn outside a `Table` */
export const usePoseMemory = () => useContext(PoseMemoryContext)
