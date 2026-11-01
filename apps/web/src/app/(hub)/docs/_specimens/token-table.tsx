"use client"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@pbgo/ui/platform/table"
import { Code, Inline } from "./text"
import { useCssVars } from "./live"

type TokenRow = {
  /** The CSS variable, e.g. `--gutter`. Its value is read from the page, never typed here. */
  variable: string
  /** The Tailwind utility that exposes it, empty when there is none. */
  utility: string
  use: string
}

/** The rows of a table of tokens, from the lines of the block that asks for it: `--variable | utility | use`, the utility left empty when the token has none. */
function rowsOf(body: string): TokenRow[] {
  return body
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => {
      const [variable = "", utility = "", ...use] = line.split("|").map((part) => part.trim())
      if (!variable.startsWith("--")) throw new Error(`A line of a token table is "--variable | utility | use", and this one is not: ${line}`)
      return { variable, utility, use: use.join(" | ") }
    })
}

/** Tokens as a table: name, value as computed by the browser on this page, utility, use. The words of the rows are the lines of the block, so they live in the markdown. */
export function TokenTable({ body }: { body: string }) {
  const rows = rowsOf(body)
  const values = useCssVars(rows.map((row) => row.variable))
  return (
    <div className="rounded-3xl border p-2">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Token</TableHead>
            <TableHead>Value</TableHead>
            <TableHead>Utility</TableHead>
            <TableHead>Use</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, index) => (
            <TableRow key={row.variable}>
              <TableCell>
                <Code>{row.variable}</Code>
              </TableCell>
              <TableCell className="whitespace-normal break-words font-mono text-xs tracking-normal">
                {values[index] || "…"}
              </TableCell>
              <TableCell>{row.utility && <Code>{row.utility}</Code>}</TableCell>
              <TableCell className="min-w-56 whitespace-normal text-muted-foreground">
                <Inline>{row.use}</Inline>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
