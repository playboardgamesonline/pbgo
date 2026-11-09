import { useEffect, useSyncExternalStore } from "react"
import type * as Leva from "leva"
import type { DebugTab } from "./debug-controls"
import { debugAllowed } from "./debug-rule"

/**
 * The folders of the debug panel, asked for by the board and drawn by the panel.
 *
 * `useControls` of `./debug-controls` picks leva when its component mounts, so a board that calls it must remount once leva is in. A folder asked for here has no such rule:
 * the board only writes down what it wants (a name, a tab and how to build the inputs), and the panel, which is the one to hold leva, draws it whenever it is there. Nothing here
 * imports leva, and nothing is written down on the production deployment.
 */

export type DebugFolderSpec = {
  /** The name of the folder in the panel. Folders of one name on one tab are one folder: each registration adds its inputs to it */
  folder: string
  /** The tab it stands on: GAME for the game's commands, SCENE for the board's knobs, TRANSITION for the announcements */
  tab: DebugTab
  /** Where it stands among the others, the lowest first (default 0) */
  order?: number
  /** Starts collapsed (default true) */
  closed?: boolean
  /** The inputs. Called when the panel is there, with leva in hand: a button or a monitor can only be made then */
  schema: (leva: typeof Leva) => Record<string, unknown>
}

/** A folder as the panel reads it: the defaults filled in, a number to key it by, and the `deps` the schema was made for */
export type DebugFolder = Required<DebugFolderSpec> & { id: number; deps: readonly unknown[] }

let counter = 0
let folders: readonly DebugFolder[] = []
const listeners = new Set<() => void>()
const NONE: readonly DebugFolder[] = []

const emit = () => listeners.forEach((f) => f())

export const subscribeDebugFolders = (f: () => void) => {
  listeners.add(f)
  return () => {
    listeners.delete(f)
  }
}

/** The folders asked for, in the order they were asked: a new array each time the list changes, as `useSyncExternalStore` wants */
export const getDebugFolders = () => folders

/** Writes a folder down. Returns what takes it back out. On the production deployment nothing is written down */
export function registerDebugFolder(spec: DebugFolderSpec, deps: readonly unknown[] = []) {
  if (!debugAllowed()) return () => {}
  const entry: DebugFolder = { ...spec, order: spec.order ?? 0, closed: spec.closed ?? true, id: counter++, deps }
  folders = [...folders, entry]
  emit()
  return () => {
    folders = folders.filter((f) => f !== entry)
    emit()
  }
}

/**
 * A folder of the panel, for as long as the component is mounted. The inputs are made once, the way leva makes its own: a closure in `schema` that reads something
 * other than `deps` stays as it was when the folder was made. Pass what it reads in `deps` and the folder is made again when one changes.
 */
export function useDebugFolder(spec: DebugFolderSpec, deps: readonly unknown[] = []) {
  useEffect(
    () => registerDebugFolder(spec, deps),
    // The spec is a new object on every render: what makes a folder another one is its name, its tab, its place and `deps`
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [spec.folder, spec.tab, spec.order, spec.closed, ...deps],
  )
}

/** The folders asked for, re-read when they change: the panel draws them */
export function useDebugFolders() {
  return useSyncExternalStore(subscribeDebugFolders, getDebugFolders, () => NONE)
}
