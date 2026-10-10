import * as leva from "leva"
import { registerDebugTools, type DebugTab } from "./debug-controls"

type Store = typeof leva.levaStore
const Store = leva.levaStore.constructor as new () => Store

export const DEBUG_STORES: Record<DebugTab, Store> = {
  GAME: leva.levaStore,
  SCENE: new Store(),
  TRANSITION: new Store(),
}

// Anything importing this module has leva: the leva-free controls of ./debug-controls switch to it.
registerDebugTools(leva, DEBUG_STORES)

export {
  COPY_ORDER,
  DEBUG_TABS,
  copyButton,
  copyFolder,
  copyValuesButton,
  debugTab,
  roundValue,
  type DebugTab,
} from "./debug-controls"
