import { describe, expect, it } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { BlockReveal } from "../src/components/ui/block-reveal"

describe("workspace block loading", () => {
  it("keeps existing content available while a refresh is pending", () => {
    const html = renderToStaticMarkup(<BlockReveal loading label="Reading contacts"><button type="button">Existing business details</button></BlockReveal>)
    expect(html).toContain("Existing business details")
    expect(html).toContain("Reading contacts")
    expect(html).toContain('aria-busy="true"')
    expect(html).not.toContain("ascii-skeleton")
  })
})
