import { pageMetadata } from "../_components/pages"
import { PageHead } from "../_components/page-head"
import { GlassSection } from "../_sections/glass"
import { PlayfulMotion } from "../_sections/playful-motion"
import { Layers, Principles } from "../_sections/principles"
import { Colors, Depth, Layout, Motion, Radius, Typography, Utilities } from "../_sections/tokens"

export const metadata = pageMetadata("foundations")

/** The principles and the tokens, in the order of `_components/pages.ts`. */
export default function FoundationsPage() {
  return (
    <>
      <PageHead slug="foundations" />
      <div className="flex flex-col gap-16">
        <Principles />
        <Layers />
        <Colors />
        <Typography />
        <Radius />
        <Layout />
        <Depth />
        <GlassSection />
        <Motion />
        <PlayfulMotion />
        <Utilities />
      </div>
    </>
  )
}
