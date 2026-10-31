import ReactMarkdown, { type Components } from "react-markdown"
import rehypeSlug from "rehype-slug"
import remarkGfm from "remark-gfm"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@pbgo/ui/platform/table"
import { cn } from "@pbgo/ui/utils"
import { resolveLink } from "./docs"

// One page of the docs: a markdown text drawn with the platform's own tokens and components. GitHub's flavour (tables, strikethrough, bare links), a title and an `id` on every heading (`rehype-slug`, the way GitHub makes them) with a link
// to it that shows when the heading is pointed at, a code block as text (no highlighter: nothing to load, like the design page's), a table in the platform's `Table`. Raw HTML in a markdown file is not drawn, so a file cannot put
// a script or a style on the page; a link is resolved by `resolveLink` (another page of the docs is that page, a file of the repo that has no page is a name, an unsafe link is its text).

const CODE = "rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs tracking-normal break-words text-foreground"
const LINK = "text-foreground underline underline-offset-4"
const PROSE = "max-w-reading"
// The alignment of a column, which GitHub's tables set with `:---:` and `---:` (the platform's cells are left-aligned by default)
const ALIGN: Record<string, string> = { left: "text-left", center: "text-center", right: "text-right" }

function heading(Tag: "h1" | "h2" | "h3" | "h4" | "h5" | "h6", className: string): Components["h1"] {
  return function Heading({ id, children }) {
    return (
      <Tag id={id} className={cn("group scroll-mt-24 font-heading", PROSE, className)}>
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

function componentsOf(from: { section: string }): Components {
  return {
    h1: heading("h1", "text-4xl md:text-5xl"),
    h2: heading("h2", "mt-8 text-2xl"),
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
    code: ({ children }) => <code className={CODE}>{children}</code>,
    pre: ({ children }) => (
      <pre className="overflow-x-auto rounded-2xl border bg-card p-4 font-mono text-xs leading-relaxed tracking-normal text-muted-foreground [&>code]:rounded-none [&>code]:bg-transparent [&>code]:p-0 [&>code]:whitespace-pre [&>code]:text-inherit">
        {children}
      </pre>
    ),
    table: ({ children }) => (
      <div className="overflow-hidden rounded-3xl border">
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

/** A markdown page. `section` is the folder it is in, which the relative links of the text are read from. The text can be selected and copied, unlike the rest of the platform's pages. */
export function Markdown({ markdown, section }: { markdown: string; section: string }) {
  return (
    <div data-slot="docs-markdown" data-selectable className="flex min-w-0 flex-col gap-4 select-text">
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSlug]} components={componentsOf({ section })}>
        {markdown}
      </ReactMarkdown>
    </div>
  )
}
