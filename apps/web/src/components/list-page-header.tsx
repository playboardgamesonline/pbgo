import type { ReactNode } from "react"

/**
 * The head of a page of the navbar that lists something (Games, Tables, Tournaments): its title, big and centred at the top of the page (`page-title`: 8rem on a desktop), and under it the search bar of
 * what the page lists, which is `children` (`PageSearch`, with the filters of the page: they differ from one page to the next), on a backdrop that is lighter at the top and fades into the black of the
 * page. `pt-navbar` keeps the title clear of the fixed bar, whose backdrop runs under it. The results are the next section of the page, with the id `results` that the search scrolls to.
 */
export function ListPageHeader({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="bg-linear-to-b from-card to-background pt-navbar">
      <div className="mx-auto flex w-full max-w-page flex-col items-center gap-8 px-gutter pt-section pb-12 text-center">
        <h1 className="page-title">{title}</h1>
        <div className="w-full max-w-3xl">{children}</div>
      </div>
    </section>
  )
}
