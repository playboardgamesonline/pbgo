import { pageMetadata } from "../../_components/pages"
import { PageHead } from "../../_components/page-head"
import { Badges, Buttons, Checks, Comboboxes, Inputs, Meters, ProviderButtons, Selects, Sliders, TabsSection, ToggleGroups } from "../../_sections/controls"

export const metadata = pageMetadata("controls")

/** What a visitor presses, types in or picks, in the order of `_components/pages.ts`. */
export default function ControlsPage() {
  return (
    <>
      <PageHead slug="controls" />
      <div className="flex flex-col gap-16">
        <Buttons />
        <ProviderButtons />
        <Badges />
        <Inputs />
        <Checks />
        <Selects />
        <Comboboxes />
        <Sliders />
        <Meters />
        <TabsSection />
        <ToggleGroups />
      </div>
    </>
  )
}
