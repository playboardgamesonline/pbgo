import { Banner } from "@pbgo/ui/platform/banner"
import { Section } from "@pbgo/ui/platform/section"

/** A banner as the home draws it: the picture, what it announces and where it leads. */
export type HomeBanner = { id: string; image: string; kind: string; title: string; href: string }

/** A row that scrolls sideways from the left margin to the edge of the window, so that the next card shows at its edge. */
const ROW = "max-xl:snap-x max-xl:snap-mandatory max-xl:scroll-px-gutter max-xl:overflow-x-auto max-xl:px-gutter max-xl:[scrollbar-width:none] max-xl:-mx-gutter max-xl:flex"

/**
 * The banners at the foot of the signed-in home, over the news: a new game, a new feature, each leading to its game or to what's new. Slim cards. Three are a row of three from `xl` and a row that scrolls sideways before it, since two columns would leave the third
 * alone on a second line; two are two columns from `md` and a row that scrolls on a phone; a single one is as wide as a long line of text. Nothing is drawn when there is none: a zone without data is not drawn.
 */
export function HomeBanners({ banners, className }: { banners: readonly HomeBanner[]; className?: string }) {
  if (banners.length === 0) return null
  const three = banners.length >= 3
  const layout = three
    ? `gap-3 ${ROW} xl:grid xl:grid-cols-3`
    : banners.length === 2
      ? "gap-3 max-md:snap-x max-md:snap-mandatory max-md:scroll-px-gutter max-md:overflow-x-auto max-md:px-gutter max-md:[scrollbar-width:none] max-md:-mx-gutter max-md:flex md:grid md:grid-cols-2"
      : "md:max-w-2xl"
  const card = three ? "max-md:w-[88%] max-xl:shrink-0 max-xl:snap-start md:max-xl:w-96" : banners.length === 2 ? "max-md:w-[88%] max-md:shrink-0 max-md:snap-start" : undefined
  return (
    <Section aria-labelledby="home-banners" className={className}>
      <h2 id="home-banners" className="sr-only">
        New on the platform
      </h2>
      <div className={layout}>
        {banners.map((banner) => (
          <Banner key={banner.id} href={banner.href} image={banner.image} kind={banner.kind} title={banner.title} loading="lazy" className={card} />
        ))}
      </div>
    </Section>
  )
}
