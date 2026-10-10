import { renderIcon } from "@pbgo/core/metadata/images"

// Generated from the favicon uploaded in /admin (Identity), else from the logo.
// A route handler rather than the icon.tsx / apple-icon.tsx file conventions (and outside the /icon path Next reserves for them):
// Next drops the base path from their <link>,
// so the link is declared in the root layout metadata with withBase().
export const revalidate = 300

export function GET() {
  return renderIcon(64)
}
