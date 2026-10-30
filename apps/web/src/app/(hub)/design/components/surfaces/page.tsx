import { pageMetadata } from "../../_components/pages"
import { PageHead } from "../../_components/page-head"
import { CreditLinks } from "../../_sections/credits"
import { Alerts, Avatars, Cards, Empties, GameCards, Items, Loading, PlanCards, Sections, Separators, Tables } from "../../_sections/surfaces"

export const metadata = pageMetadata("surfaces")

/** The containers and what they hold, in the order of `_components/pages.ts`. */
export default function SurfacesPage() {
  return (
    <>
      <PageHead slug="surfaces" />
      <div className="flex flex-col gap-16">
        <Cards />
        <PlanCards />
        <GameCards />
        <CreditLinks />
        <Sections />
        <Avatars />
        <Alerts />
        <Loading />
        <Separators />
        <Empties />
        <Items />
        <Tables />
      </div>
    </>
  )
}
