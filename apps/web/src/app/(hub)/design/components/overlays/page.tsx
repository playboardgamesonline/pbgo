import { pageMetadata } from "../../_components/pages"
import { PageHead } from "../../_components/page-head"
import { CookieBanners, Dialogs, Dropdowns, Popovers, Sheets, Toasts, Tooltips } from "../../_sections/overlays"

export const metadata = pageMetadata("overlays")

/** What appears over the page, in the order of `_components/pages.ts`. */
export default function OverlaysPage() {
  return (
    <>
      <PageHead slug="overlays" />
      <div className="flex flex-col gap-16">
        <Dialogs />
        <Sheets />
        <Dropdowns />
        <Popovers />
        <Tooltips />
        <Toasts />
        <CookieBanners />
      </div>
    </>
  )
}
