import { pageMetadata } from "../../_components/pages"
import { PageHead } from "../../_components/page-head"
import { Logos, Navbars, SearchBars, StatsSection, TitlePieces, Wordmarks } from "../../_sections/navigation"

export const metadata = pageMetadata("navigation")

/** The bars and the marks of the brand, in the order of `_components/pages.ts`. */
export default function NavigationPage() {
  return (
    <>
      <PageHead slug="navigation" />
      <div className="flex flex-col gap-16">
        <Logos />
        <Wordmarks />
        <Navbars />
        <SearchBars />
        <TitlePieces />
        <StatsSection />
      </div>
    </>
  )
}
