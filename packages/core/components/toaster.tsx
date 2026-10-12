import { Toaster } from "@pbgo/ui/game/sonner"

/** Toasts of a game, in the game's style. The gamemaster has no game runtime: its layout mounts the platform's `Toaster` itself. */
export function AppToaster() {
  return <Toaster position="top-center" />
}
