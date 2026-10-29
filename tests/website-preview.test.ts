import { describe, expect, it } from "vitest"
import { localPreviewUrl } from "../src/lib/website-preview"

describe("local website preview URL boundaries", () => {
  const operator = "http://localhost:1420"
  it("accepts separate loopback servers for generated project previews", () => {
    expect(localPreviewUrl("http://localhost:5173/", operator)).toBe("http://localhost:5173/")
    expect(localPreviewUrl("http://127.0.0.1:3000/contact", operator)).toContain("/contact")
    expect(localPreviewUrl("http://[::1]:3000", operator)).toBe("http://[::1]:3000/")
  })
  it("rejects the operator origin, external servers, credentials, and script schemes", () => {
    for (const raw of ["http://localhost:1420/", "https://public.example", "https://localhost.attacker.example", "http://user:secret@localhost:5173", "javascript:alert(1)", "file:///C:/index.html"]) expect(() => localPreviewUrl(raw, operator)).toThrow()
  })
})
