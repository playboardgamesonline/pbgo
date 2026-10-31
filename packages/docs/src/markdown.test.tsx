import * as React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { Markdown } from "./markdown"

const render = (markdown: string, section = "design") => renderToStaticMarkup(React.createElement(Markdown, { markdown, section }))

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

  it("leads a link to another page of the docs to that page, and opens another site in a new tab", () => {
    const html = render("[engine](../engine/index.md) and [the web](https://example.com/x) and [here](#a)")
    expect(html).toContain('<a href="/docs/engine"')
    expect(html).toMatch(/<a href="https:\/\/example.com\/x" target="_blank" rel="noopener noreferrer"/)
    expect(html).toContain('<a href="#a"')
  })

  it("shows a link to a file that has no page as a name, and an unsafe link as its text", () => {
    const html = render("[the guide](../../packages/engine-kit/README.md) and [click](javascript:alert(1))")
    expect(html).not.toContain("<a href=\"../../packages")
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
