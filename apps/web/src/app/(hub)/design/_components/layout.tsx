import type { ReactNode } from "react"
import { cn } from "@pbgo/ui/utils"
import { GROUPS, sectionOf, type SectionId } from "./nav"

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

/** The longest file path of this page; a longer chip may wrap, or it would be wider than a phone's line. */
const UNBROKEN_CHIP_MAX = 36

/** A sentence with `code` spans: every backticked fragment becomes inline code. */
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

/** Plain text goes through `Inline`; anything else is already markup. */
function Rich({ children }: { children: ReactNode }) {
  return typeof children === "string" ? <Inline>{children}</Inline> : children
}

/** A block of code, as text: no highlighter, nothing to load. */
export function Snippet({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-2xl border bg-card p-4 font-mono text-xs leading-relaxed tracking-normal text-muted-foreground">
      <code>{children.trim()}</code>
    </pre>
  )
}

/** One block of the page: group, title, import path and intro, then its demos. */
export function Section({
  id,
  module,
  intro,
  children,
}: {
  id: SectionId
  /** File of `@pbgo/ui/platform/<module>` the section documents. */
  module?: string
  intro?: ReactNode
  children: ReactNode
}) {
  const { group, title } = sectionOf(id)
  return (
    <section id={id} className="flex scroll-mt-24 flex-col gap-8 border-t pt-16 first:border-t-0 first:pt-0">
      <header className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">{group}</p>
        <h2 className="font-heading text-3xl">{title}</h2>
        {module && <Code className="w-fit">{`@pbgo/ui/platform/${module}`}</Code>}
        {intro && (
          <div className="flex max-w-reading flex-col gap-3 text-muted-foreground">
            {typeof intro === "string" ? (
              <p>
                <Inline>{intro}</Inline>
              </p>
            ) : (
              intro
            )}
          </div>
        )}
      </header>
      {children}
    </section>
  )
}

/** A titled part of a section, without a frame (token grids bring their own). */
export function Block({
  title,
  description,
  children,
}: {
  title?: string
  description?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-3">
      {(title || description) && (
        <div className="flex max-w-reading flex-col gap-1">
          {title && <h3 className="font-heading text-lg">{title}</h3>}
          {description && (
            <p className="text-sm text-muted-foreground">
              <Rich>{description}</Rich>
            </p>
          )}
        </div>
      )}
      {children}
    </div>
  )
}

/** A live specimen in a frame, with an optional title, a line of explanation and the code that produces it. */
export function Demo({
  title,
  description,
  code,
  className,
  children,
}: {
  title?: string
  description?: ReactNode
  code?: string
  className?: string
  children: ReactNode
}) {
  return (
    <Block title={title} description={description}>
      <div className={cn("rounded-3xl border p-6", className)}>{children}</div>
      {code && <Snippet>{code}</Snippet>}
    </Block>
  )
}

/** A short list; each item is a sentence with `code` spans. */
export function Bullets({ items }: { items: readonly string[] }) {
  return (
    <ul className="flex max-w-reading list-disc flex-col gap-2 pl-5 text-muted-foreground">
      {items.map((item) => (
        <li key={item}>
          <Inline>{item}</Inline>
        </li>
      ))}
    </ul>
  )
}

/** Side navigation: every section, by group. Plain anchors, no script. */
export function PageNav() {
  return (
    <nav aria-label="Sections" className="flex flex-col gap-6 text-sm">
      {GROUPS.map(({ group, items }) => (
        <div key={group} className="flex flex-col gap-2">
          <p className="px-3 text-muted-foreground">{group}</p>
          <ul className="flex flex-col">
            {items.map((item) => (
              <li key={item.id}>
                <a href={`#${item.id}`} className="block rounded-xl px-3 py-1.5 transition-colors hover:bg-muted">
                  {item.title}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  )
}
