import * as React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { Markdown, type Specimens } from "./markdown"

const render = (markdown: string, dir: readonly string[] = ["design"], specimens?: Specimens) => renderToStaticMarkup(React.createElement(Markdown, { markdown, dir, specimens }))

describe("Markdown", () => {
  it("gives every heading an id, the way GitHub makes it, and a link to it", () => {
    const html = render("# The title\n\n## Design system (`@pbgo/ui`)\n\n## Design system (`@pbgo/ui`)")
    expect(html).toContain('<h1 id="the-title"')
    expect(html).toContain('id="design-system-pbgoui"')
    expect(html).toContain('id="design-system-pbgoui-1"')
    expect(html).toContain('href="#the-title"')
    expect(html).toContain('aria-label="Link to this heading"')
  })

  it("draws a fenced block as text in a pre, and inline code as a chip", () => {
    const html = render("A `chip` here.\n\n```ts\nconst a = 1\n```")
    expect(html).toMatch(/<pre[^>]*><code[^>]*>const a = 1\n<\/code><\/pre>/)
    expect(html).toMatch(/<code class="[^"]*bg-muted[^"]*">chip<\/code>/)
  })

  it("keeps a short chip of code on one line and lets a long one wrap", () => {
    const html = render("A `rounded-4xl` chip and a `packages/ui/src/platform/something-very-long/index.tsx` one.")
    expect(html).toMatch(/<code class="[^"]*whitespace-nowrap[^"]*">rounded-4xl<\/code>/)
    expect(html).toMatch(/<code class="(?![^"]*whitespace-nowrap)[^"]*break-words[^"]*">packages\/ui\/src\/platform\/something-very-long\/index.tsx<\/code>/)
  })

  it("draws a table of GitHub's flavour with the platform's table", () => {
    const html = render("| Name | Use |\n| --- | --- |\n| `a` | the first |\n| `b` | the second |")
    expect(html).toContain("<table")
    expect(html).toContain('data-slot="table"')
    expect(html.match(/<th[\s>]/g)).toHaveLength(2)
    expect(html.match(/<td[\s>]/g)).toHaveLength(4)
    expect(html).toContain("the second")
  })

  it("keeps the alignment of the columns of a table", () => {
    const html = render("| Left | Middle | Right |\n| :--- | :---: | ---: |\n| a | b | c |")
    expect(html).toMatch(/<th[^>]*class="[^"]*text-left[^"]*"[^>]*>Left</)
    expect(html).toMatch(/<th[^>]*class="[^"]*text-center[^"]*"[^>]*>Middle</)
    expect(html).toMatch(/<td[^>]*class="[^"]*text-right[^"]*"[^>]*>c</)
  })

  it("links the headings of every level", () => {
    const html = render("##### Fifth\n\n###### Sixth")
    expect(html).toContain('<h5 id="fifth"')
    expect(html).toContain('<h6 id="sixth"')
    expect(html).toContain('href="#sixth"')
  })

  it("keeps the text to a readable measure and lets a table, a block of code and a section rule take the whole page", () => {
    const html = render("## Section\n\nA paragraph.\n\n| a |\n| --- |\n| b |\n\n```ts\ncode\n```")
    expect(html).toMatch(/<h2[^>]*class="(?![^"]*max-w-reading)[^"]*border-t[^"]*"/)
    expect(html).toMatch(/<p class="[^"]*max-w-reading/)
    expect(html).not.toMatch(/<table[^>]*max-w-reading/)
    expect(html).not.toMatch(/<pre[^>]*max-w-reading/)
  })

  it("leads a link to another page of the docs to that page, and opens another site in a new tab", () => {
    const html = render("[engine](../engine/index.md) and [the web](https://example.com/x) and [here](#a)")
    expect(html).toContain('<a href="/docs/engine"')
    expect(html).toMatch(/<a href="https:\/\/example.com\/x" target="_blank" rel="noopener noreferrer"/)
    expect(html).toContain('<a href="#a"')
  })

  it("reads a relative link from the folders of the page, the way the disk has them", () => {
    const html = render("[foundations](../02-foundations.md#radius) and [a sibling](01-controls.md)", ["design", "03-components"])
    expect(html).toContain('<a href="/docs/design/foundations#radius"')
    expect(html).toContain('<a href="/docs/design/components/controls"')
  })

  it("shows a link to a file that has no page as a name, and an unsafe link as its text", () => {
    const html = render("[the guide](../../packages/engine-kit/README.md) and [click](javascript:alert(1))")
    expect(html).not.toContain('<a href="../../packages')
    expect(html).toMatch(/<code[^>]*>the guide<\/code>/)
    expect(html).not.toContain("javascript:")
    expect(html).toContain("click")
  })

  it("does not make elements of raw HTML: it is shown as the text it is", () => {
    const html = render('Text <script>alert(1)</script> and <img src=x onerror="alert(1)"> and <b>bold</b>.')
    expect(html).not.toContain("<script")
    expect(html).not.toContain("<img")
    expect(html).not.toContain("<b>")
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;")
  })

  it("can be selected, unlike the rest of the platform", () => {
    const html = render("text")
    expect(html).toContain("data-selectable")
    expect(html).toContain("select-text")
  })
})

describe("Markdown specimens", () => {
  const specimens: Specimens = {
    "button-variants": () => React.createElement("button", { type: "button" }, "A live button"),
    "second-one": () => React.createElement("p", null, "Another piece"),
  }

  it("draws the specimen the text of a specimen block names, where the block stands, and not the block", () => {
    const html = render("Before.\n\n```specimen\nbutton-variants\n```\n\nAfter.", ["design"], specimens)
    expect(html).toMatch(/Before\.<\/p>\s*<div data-slot="docs-specimen"[^>]*><button type="button">A live button<\/button><\/div>\s*<p[^>]*>After\./)
    expect(html).not.toContain("<pre")
    expect(html).not.toContain("language-specimen")
  })

  it("gives the specimen the lines of its block after the name", () => {
    const withBody: Specimens = { table: ({ body }) => React.createElement("p", null, body.split("\n").length, " rows: ", body) }
    const html = render("```specimen\ntable\n--a | b\n--c | d\n```", ["design"], withBody)
    expect(html).toContain("2 rows: --a | b\n--c | d")
  })

  it("keeps the text of a specimen from being selected, and the code of a page selectable", () => {
    const html = render("```specimen\nsecond-one\n```", ["design"], specimens)
    expect(html).toMatch(/data-slot="docs-specimen" class="[^"]*select-none/)
  })

  it("draws a block of another language as code, even when it names a specimen", () => {
    const html = render("```ts\nbutton-variants\n```", ["design"], specimens)
    expect(html).toContain("<pre")
    expect(html).not.toContain("A live button")
  })

  it("stops on a name the site does not know, and on a page that has no specimens to draw from", () => {
    expect(() => render("```specimen\nnope\n```", ["design"], specimens)).toThrow('the specimen "nope"')
    expect(() => render("```specimen\nbutton-variants\n```")).toThrow('the specimen "button-variants"')
  })
})
