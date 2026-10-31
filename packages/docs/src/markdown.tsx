import type { ComponentType } from "react"
import ReactMarkdown, { type Components, type ExtraProps } from "react-markdown"
import rehypeSlug from "rehype-slug"
import remarkGfm from "remark-gfm"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@pbgo/ui/platform/table"
import { cn } from "@pbgo/ui/utils"
import { SPECIMEN, resolveLink, splitSpecimen } from "./docs"

// One page of the docs: a markdown text drawn with the platform's own tokens and components. GitHub's flavour (tables, strikethrough, bare links), a title and an `id` on every heading (`rehype-slug`, the way GitHub makes them) with a link
// to it that shows when the heading is pointed at, a code block as text (no highlighter: nothing to load), a table in the platform's `Table`. Raw HTML in a markdown file is not drawn, so a file cannot put a script or a style
// on the page; a link is resolved by `resolveLink` (another page of the docs is that page, a file of the repo that has no page is a name, an unsafe link is its text).
// A fenced block of the language `specimen` is not code but a live piece of the site, drawn where it stands: its text is the name of the specimen, which the app registers (`specimens`), so that the page stays a markdown file that
// GitHub and the agents read as it is, and the demo is one line of it. A name the app does not know stops the build.

const CODE = "rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs tracking-normal break-words text-foreground"
// A chip of code stays on one line when it is short, or a token name would split at its hyphens (`rounded-` then `4xl`); a longer one may wrap, or it would be wider than a phone's line
const UNBROKEN_CODE_MAX = 36
const LINK = "text-foreground underline underline-offset-4"
// The measure of the text: its lines stop at a readable length while the tables, the code and the specimens take the whole width of the page
const PROSE = "max-w-reading"
// The alignment of a column, which GitHub's tables set with `:---:` and `---:` (the platform's cells are left-aligned by default)
const ALIGN: Record<string, string> = { left: "text-left", center: "text-center", right: "text-right" }

/** The live pieces of the site that the pages can show, by name: each a component that is given the lines of its block after the name (`body`, empty for most). */
export type Specimens = Readonly<Record<string, ComponentType<{ body: string }>>>

function heading(Tag: "h1" | "h2" | "h3" | "h4" | "h5" | "h6", className: string, measure = true): Components["h1"] {
  return function Heading({ id, children }) {
    return (
      <Tag id={id} className={cn("group scroll-mt-24 font-heading", measure && PROSE, className)}>
        {children}
        {id && (
          <a
            href={`#${id}`}
            aria-label="Link to this heading"
            className="ml-2 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
          >
            #
          </a>
        )}
      </Tag>
    )
  }
}

/** The specimen a fenced block shows (its name, and the lines after it), or null for any other block. */
function specimenOf(node: ExtraProps["node"]): { name: string; body: string } | null {
  const code = node?.children[0]
  if (code?.type !== "element" || code.tagName !== "code") return null
  const classes = code.properties.className
  if (!Array.isArray(classes) || !classes.includes(`language-${SPECIMEN}`)) return null
  const text = code.children[0]
  return text?.type === "text" ? splitSpecimen(text.value) : null
}

/** A specimen of the site where the page asks for it. Its text cannot be selected, as nothing of the platform's own can, but the code in it still can. */
function Specimen({ name, body, specimens }: { name: string; body: string; specimens: Specimens | undefined }) {
  const Entry = specimens?.[name]
  if (!Entry) throw new Error(`The docs show the specimen "${name}" and the site has none of that name: register it, or correct the name`)
  return (
    <div data-slot="docs-specimen" className="min-w-0 select-none">
      <Entry body={body} />
    </div>
  )
}

function componentsOf(from: { dir: readonly string[] }, specimens: Specimens | undefined): Components {
  return {
    h1: heading("h1", "text-4xl md:text-5xl"),
    // A section of a page is told from the one before it by a rule across the whole page
    h2: heading("h2", "mt-10 border-t pt-10 text-3xl", false),
    h3: heading("h3", "mt-6 text-xl"),
    h4: heading("h4", "mt-4 text-lg"),
    h5: heading("h5", "mt-4 text-base"),
    h6: heading("h6", "mt-4 text-sm"),
    p: ({ children }) => <p className={cn(PROSE, "text-muted-foreground")}>{children}</p>,
    ul: ({ children }) => <ul className={cn(PROSE, "flex list-disc flex-col gap-2 pl-5 text-muted-foreground")}>{children}</ul>,
    ol: ({ children }) => <ol className={cn(PROSE, "flex list-decimal flex-col gap-2 pl-5 text-muted-foreground")}>{children}</ol>,
    li: ({ children }) => <li className="pl-1 [&>ul]:mt-2 [&>ol]:mt-2">{children}</li>,
    blockquote: ({ children }) => <blockquote className={cn(PROSE, "border-l-2 pl-4 text-muted-foreground")}>{children}</blockquote>,
    hr: () => <hr className="my-4 border-t" />,
    strong: ({ children }) => <strong className="text-foreground">{children}</strong>,
    a: ({ href, children }) => {
      const link = resolveLink(href, from)
      switch (link.kind) {
        case "anchor":
        case "page":
          return (
            <a href={link.href} className={LINK}>
              {children}
            </a>
          )
        case "external":
          return (
            <a href={link.href} target="_blank" rel="noopener noreferrer" className={LINK}>
              {children}
            </a>
          )
        case "file":
          return <code className={CODE}>{children}</code>
        default:
          return <>{children}</>
      }
    },
    code: ({ children }) => <code className={cn(CODE, typeof children === "string" && children.length <= UNBROKEN_CODE_MAX && "whitespace-nowrap")}>{children}</code>,
    pre: ({ node, children }) => {
      const specimen = specimenOf(node)
      if (specimen !== null) return <Specimen name={specimen.name} body={specimen.body} specimens={specimens} />
      return (
        <pre className="overflow-x-auto rounded-2xl border bg-card p-4 font-mono text-xs leading-relaxed tracking-normal text-muted-foreground [&>code]:rounded-none [&>code]:bg-transparent [&>code]:p-0 [&>code]:whitespace-pre [&>code]:text-inherit">
          {children}
        </pre>
      )
    },
    table: ({ children }) => (
      <div className="overflow-x-auto rounded-3xl border">
        <Table>{children}</Table>
      </div>
    ),
    thead: ({ children }) => <TableHeader>{children}</TableHeader>,
    tbody: ({ children }) => <TableBody>{children}</TableBody>,
    tr: ({ children }) => <TableRow>{children}</TableRow>,
    th: ({ children, style }) => <TableHead className={cn("whitespace-normal", style?.textAlign && ALIGN[style.textAlign])}>{children}</TableHead>,
    td: ({ children, style }) => (
      <TableCell className={cn("align-top whitespace-normal text-muted-foreground", style?.textAlign && ALIGN[style.textAlign])}>{children}</TableCell>
    ),
  }
}

/**
 * A markdown page. `dir` is the folders its file is in below `docs/`, which the relative links of the text are read from, and `specimens` the live pieces of the site it can show. The text can be selected and copied, unlike the rest of the
 * platform's pages.
 */
export function Markdown({ markdown, dir, specimens }: { markdown: string; dir: readonly string[]; specimens?: Specimens }) {
  return (
    <div data-slot="docs-markdown" data-selectable className="flex min-w-0 flex-col gap-4 select-text">
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSlug]} components={componentsOf({ dir }, specimens)}>
        {markdown}
      </ReactMarkdown>
    </div>
  )
}
