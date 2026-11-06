# Adding a component

1. Add it with `pnpm dlx shadcn@latest add <comp>` (preset `beEgoY8u`).
2. Move it to `packages/ui/src/platform` and import `cn` from `../utils`.
3. Make it dark-only and token-only.
4. Document it, if it is a building block that other screens will use: a page in the group of [Components](../03-components/index.md) that fits (a new file in its folder, numbered to set its place), with its live pieces as specimens (see [Design](../index.md)). A piece made for one page is not documented.
5. Then use it.

## Guards

Tests keep these rules from coming undone:

- `platform.test.ts` rejects `dark:`, palette and hard-coded colours, arbitrary sizes, and a hard-coded weight, shadow, duration or radius in `packages/ui/src/platform/*`.
- `theme.test.ts` keeps `PLATFORM_THEME_COLOR` (`@pbgo/ui/theme`), the browser colour of platform pages, equal to `--background`.
