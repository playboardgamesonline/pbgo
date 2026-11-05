import type { ReactNode } from "react"

/**
 * The head of a page of the navbar that lists something (Games, Tables, Tournaments): its title, big and centred at the top of the page (`page-title`: 8rem on a desktop), a few words under it when the page has something to say first
 * (`description`), and then the search bar of what the page lists, which is `children` (`PageSearch`, with the filters of the page: they differ from one page to the next; Pricing and About, which list nothing to search, have none), on the page's black, flat. `pt-navbar` keeps the title clear of the fixed bar, whose backdrop runs under it. The results are the next section of the page, with the id `results` that the search scrolls to.
 */
export function ListPageHeader({ title, description, children }: { title: string; description?: string; children?: ReactNode }) {
  return (
    <section className="pt-navbar">
      <div className="mx-auto flex w-full max-w-page flex-col items-center gap-8 px-gutter pt-section pb-12 text-center">
        <div className="flex flex-col items-center gap-4">
          <h1 className="page-title">{title}</h1>
          {description && <p className="max-w-2xl text-lg text-muted-foreground">{description}</p>}
        </div>
        {children && <div className="w-full max-w-3xl">{children}</div>}
      </div>
    </section>
  )
}
