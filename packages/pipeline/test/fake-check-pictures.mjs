// A stand-in for `pnpm catalog:pictures <slug>` (PBGO_CHECK_PICTURES_BIN): what it prints and the exit code are in the file FAKE_PICTURES_FILE, written by the scenario of a session
// ({ exit, lines }); without that file the game is published with three of its five pictures.
import { existsSync, readFileSync } from "node:fs"

const slug = process.argv[2] ?? ""
const file = process.env.FAKE_PICTURES_FILE
const said = file && existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : null
const lines = said?.lines ?? [`Test Game (game-${slug}), published: 3 of 5 pictures`, "  ✓ cover", "  ✓ logo", "  ✗ icon", "  ✓ background", "  ✗ boxFront"]
console.log(lines.join("\n"))
process.exit(said?.exit ?? 0)
