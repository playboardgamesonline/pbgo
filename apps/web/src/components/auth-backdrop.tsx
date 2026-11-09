import { Wordmark } from "@pbgo/ui/platform/wordmark"

/**
 * What is behind the sign-in and the sign-up, on the page's black: the name of the brand as big letters across the width of the window, standing on the foot of the page and fading out before it (`Wordmark`, the lettering of the footer
 * of the other pages). It stands in for the art that the owner will hand over, and this component is the one place to swap it: the shell lays it behind the page without knowing what it draws. It is decorative and takes no pointer.
 */
export function AuthBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 -z-10">
      <Wordmark />
    </div>
  )
}
