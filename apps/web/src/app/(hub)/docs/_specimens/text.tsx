import type { ReactNode } from "react"
import { cn } from "@pbgo/ui/utils"

/**
 * Inline code. Monospace needs its own tracking: the platform's negative letter-spacing cramps it. A chip stays on one
 * line by default: a token name would otherwise split at its hyphens.
 */
export function Code({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <code
      className={cn(
        "rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs tracking-normal whitespace-nowrap text-foreground",
        className
      )}
    >
      {children}
    </code>
  )
}

/** The longest file path of the docs; a longer chip may wrap, or it would be wider than a phone's line. */
const UNBROKEN_CHIP_MAX = 36

/** A sentence with `code` spans: every backticked fragment becomes inline code. For the words a specimen prints itself: the text of a page is markdown. */
export function Inline({ children }: { children: string }) {
  return (
    <>
      {children.split("`").map((part, index) =>
        index % 2 === 1 ? (
          <Code key={index} className={part.length > UNBROKEN_CHIP_MAX ? "whitespace-normal" : undefined}>
            {part}
          </Code>
        ) : (
          part
        )
      )}
    </>
  )
}

/** A block of code, as text: no highlighter, nothing to load. */
export function Snippet({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-2xl border bg-card p-4 font-mono text-xs leading-relaxed tracking-normal text-muted-foreground">
      <code>{children.trim()}</code>
    </pre>
  )
}

/**
 * A live specimen in a frame, with the code that produces it under it when there is some. What a specimen is and what it is for is the text of the page that shows it (the heading above it and the lines under that): the frame draws
 * the piece itself, as the platform would.
 */
export function Frame({ className, code, children }: { className?: string; code?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <div className={cn("rounded-3xl border p-6", className)}>{children}</div>
      {code && <Snippet>{code}</Snippet>}
    </div>
  )
}
