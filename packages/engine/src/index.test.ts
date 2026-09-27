import { describe, expect, it } from "vitest"
import { FAMILLES } from "./index"

describe("engine", () => {
  it("has 6 familles", () => {
    expect(FAMILLES).toHaveLength(6)
  })
})
