// Prints `pipeline` or `plumbing` for the arguments of `pnpm add-game`: scripts/add-game.sh runs this first and hands the name over to the pipeline.
import { routeArgs } from "../src/route.ts"

process.stdout.write(`${routeArgs(process.argv.slice(2))}\n`)
