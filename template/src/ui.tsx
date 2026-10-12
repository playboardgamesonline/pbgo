"use client"

import dynamic from "next/dynamic"

/** The game's client components for @pbgo/core. The board is loaded with the first game: the home page does not pull it in. */
export { Logo } from "./components/logo"

export const Game = dynamic(() => import("./components/game/game").then((m) => m.Game), { ssr: false })
