// A stand-in for the dry run of a game's seed on its art folder (PBGO_CHECK_ART_BIN, run with the slug and the folder): it prints the "Art" part of the seed's report that the file FAKE_ART_FILE holds
// ({ exit, lines }); without that file the art folder has twelve of its twelve slots. The rest of a real report comes before it, which the command leaves out.
import { existsSync, readFileSync } from "node:fs"

const dir = process.argv[3] ?? ""
const file = process.env.FAKE_ART_FILE
const said = file && existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : null
console.log("DRY RUN: nothing was written or uploaded\n\n12 documents in the seed, 0 to write\n")
console.log((said?.lines ?? [`Art (${dir})`, "  12 of 12 slots have a file", "  missing: none", "  files that match no slot: none"]).join("\n"))
console.log("\nRun with --apply to write the drafts.")
process.exit(said?.exit ?? 0)
