import { describe, expect, it } from "vitest"
import { cn } from "./utils"

/** `cn` merges classes the way Tailwind would resolve them, the platform's own spacing names (`gutter`, `section`, `navbar`) included. */
describe("cn", () => {
  it("lets a later class replace an earlier one of the same group", () => {
    expect(cn("px-4 py-2", "px-8")).toBe("py-2 px-8")
  })

  it("merges the platform's spacing names like any other spacing", () => {
    expect(cn("px-gutter", "px-0")).toBe("px-0")
    expect(cn("pb-section", "pb-0")).toBe("pb-0")
    expect(cn("pt-navbar", "pt-10")).toBe("pt-10")
    expect(cn("px-0", "px-gutter")).toBe("px-gutter")
    expect(cn("-mx-gutter", "mx-0")).toBe("mx-0")
    expect(cn("h-navbar", "h-10")).toBe("h-10")
  })

  it("keeps the classes of other groups", () => {
    expect(cn("px-gutter", "py-4")).toBe("px-gutter py-4")
    expect(cn("px-gutter pb-section", "pb-0")).toBe("px-gutter pb-0")
  })

  it("does not take a colour for a spacing", () => {
    expect(cn("text-gutter", "text-sm")).toBe("text-gutter text-sm")
  })
})
