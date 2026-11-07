import { Banner } from "@pbgo/ui/platform/banner"
import { Section } from "@pbgo/ui/platform/section"

/** A banner as the home draws it: the picture, what it announces and where it leads. */
export type HomeBanner = { id: string; image: string; kind: string; title: string; href: string }

/**
 * The banners at the top of the signed-in home: a new game, a new feature, each leading to its game or to what's new. Up to three in a row from `lg` (two columns when there are one or two), one under the other
 * before, and nothing at all when there is none: a zone without data is not drawn. The first picture is the one the page opens on, so it loads at once.
 */
export function HomeBanners({ banners }: { banners: readonly HomeBanner[] }) {
  if (banners.length === 0) return null
  // Two columns from `md`, and a third from `lg` only when there are three banners: a row of two never leaves a hole
  const columns = banners.length >= 3 ? "md:grid-cols-2 lg:grid-cols-3" : "md:grid-cols-2"
  return (
    <Section aria-labelledby="home-banners">
      <h2 id="home-banners" className="sr-only">
        New on the platform
      </h2>
      <div className={`grid gap-4 ${columns}`}>
        {banners.map((banner, index) => (
          <Banner key={banner.id} href={banner.href} image={banner.image} kind={banner.kind} title={banner.title} loading={index === 0 ? "eager" : "lazy"} />
        ))}
      </div>
    </Section>
  )
}
