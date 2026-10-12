"use client"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@pbgo/ui/platform/table"
import { Code, Inline } from "./layout"
import { useCssVars } from "./live"

export type TokenRow = {
  /** The CSS variable, e.g. `--gutter`. Its value is read from the page, never typed here. */
  variable: string
  /** The Tailwind utility that exposes it, when there is one. */
  utility?: string
  use: string
}

/** Tokens as a table: name, value as computed by the browser on this page, utility, use. */
export function TokenTable({ rows }: { rows: readonly TokenRow[] }) {
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
