import type { Metadata } from "next"
import { PageCards } from "../_components/page-cards"
import { PAGES } from "../_components/pages"

export const metadata: Metadata = {
  title: "Components · Design system",
  description: "The pieces of the platform, in five pages by what they do.",
  alternates: { canonical: "/design/components" },
}

/** The way into the components: five pages, by what the pieces do. */
export default function ComponentsPage() {
  return (
    <>
      <header className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">Components</p>
        <h1 className="font-heading text-4xl md:text-5xl">Components</h1>
        <p className="max-w-reading text-lg text-muted-foreground">
          The pieces of the platform, live, in five pages by what they do. A screen of the hub, the account, the legal pages or the 404 is built from these and from nothing else, and a piece that is missing is added to `@pbgo/ui` and to its page
          here before it is used.
        </p>
      </header>
      <PageCards pages={PAGES.filter((page) => page.family === "Components")} />
    </>
  )
}
