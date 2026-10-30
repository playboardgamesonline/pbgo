import { pageOf, type PageSlug } from "./pages"

/** The head of a page of `/design`: its family, its title and what it holds. The title is the page's `h1`; the sections under it are `h2`. */
export function PageHead({ slug }: { slug: PageSlug }) {
  const page = pageOf(slug)
  return (
    <header className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">{page.family}</p>
      <h1 className="font-heading text-4xl md:text-5xl">{page.title}</h1>
      <p className="max-w-reading text-lg text-muted-foreground">{page.description}</p>
    </header>
  )
}
