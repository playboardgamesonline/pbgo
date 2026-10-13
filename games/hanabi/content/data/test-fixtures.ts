import type { Doc } from "@pbgo/content-kit/testing"
import { buildSeedDocs } from "./index.ts"

/** A fresh build of every seed document, read loosely by the tests. */
export const seedDocs = () => buildSeedDocs() as Doc[]
