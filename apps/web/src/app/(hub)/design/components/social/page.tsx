import { pageMetadata } from "../../_components/pages"
import { PageHead } from "../../_components/page-head"
import { FriendsBars, FriendsPanels, SocialPanels } from "../../_sections/surfaces"

export const metadata = pageMetadata("social")

/** The friends of a signed-in visitor, in the order of `_components/pages.ts`. */
export default function SocialPage() {
  return (
    <>
      <PageHead slug="social" />
      <div className="flex flex-col gap-16">
        <FriendsPanels />
        <FriendsBars />
        <SocialPanels />
      </div>
    </>
  )
}
