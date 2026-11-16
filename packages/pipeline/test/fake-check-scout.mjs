// A stand-in for `pnpm check:scout <file> --online` (PBGO_CHECK_SCOUT_BIN): the file is fine unless it says BROKEN.
import { readFileSync } from "node:fs"

const file = process.argv[2] ?? ""
const text = readFileSync(file, "utf8")
if (text.includes("BROKEN")) {
  console.log(`fail  ${file}: against the registry and the catalog\n  - slug: a problem the fake found`)
  process.exit(1)
}
console.log(`ok    ${file}: against the registry and the catalog`)
