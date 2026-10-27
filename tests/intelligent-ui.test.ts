import React from "react"
import { describe, it, expect } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import {
  parseOpenUILang,
  extractOpenUIFromMarkdown,
  isOpenUICode,
} from "../src/components/intelligent-ui/parser"
import { IntelligentUIRenderer } from "../src/components/intelligent-ui"
import {
  SF_ITINERARY_OPENUI,
  LOAN_CALCULATOR_OPENUI,
  PERFORMANCE_DASHBOARD_OPENUI,
  BIKE_SPEC_OPENUI,
  RUST_FLASHCARD_OPENUI,
  THINKPAD_T590_OPENUI,
} from "../src/components/intelligent-ui/examples"

describe("Open Intelligent UI (OpenUI Lang 1.0) Engine", () => {
  describe("Lexer & AST Parser", () => {
    it("parses simple root component assignment", () => {
      const code = `root = Title("Welcome to FRIDAY", "Voice-First Desktop Operator", "Active")`
      const program = parseOpenUILang(code)

      expect(program.rootNode).not.toBeNull()
      expect(program.rootNode?.component).toBe("Title")
      expect(program.rootNode?.args[0]).toBe("Welcome to FRIDAY")
      expect(program.rootNode?.args[1]).toBe("Voice-First Desktop Operator")
      expect(program.rootNode?.args[2]).toBe("Active")
      expect(program.errors.length).toBe(0)
    })

    it("parses state variables ($var = value)", () => {
      const code = `
        $amount = 50000
        $rate = 6.5
        $isActive = true
        $label = "Principal"
        root = Card("Calculator", [s1])
        s1 = Slider($amount, 10000, 100000, 5000, $label)
      `
      const program = parseOpenUILang(code)

      expect(program.stateVariables.get("$amount")).toBe(50000)
      expect(program.stateVariables.get("$rate")).toBe(6.5)
      expect(program.stateVariables.get("$isActive")).toBe(true)
      expect(program.stateVariables.get("$label")).toBe("Principal")
      expect(program.declarations.has("s1")).toBe(true)
      expect(program.rootNode?.component).toBe("Card")
    })

    it("resolves nested children references in Col and Row", () => {
      const code = `
        root = Col([header, metrics])
        header = Title("Q4 Results")
        metrics = Row([m1, m2])
        m1 = Metric("Revenue", 120000, "$")
        m2 = Metric("Growth", "+15%", "")
      `
      const program = parseOpenUILang(code)

      expect(program.rootNode?.component).toBe("Col")
      expect(program.declarations.size).toBe(5) // root, header, metrics, m1, m2
      expect(program.declarations.has("root")).toBe(true)
      expect(program.declarations.has("header")).toBe(true)
      expect(program.declarations.has("metrics")).toBe(true)
      expect(program.declarations.has("m1")).toBe(true)
      expect(program.declarations.has("m2")).toBe(true)
    })

    it("parses function calls with @ prefix", () => {
      const code = `
        root = Metric("Payment", @Payment(500000, 6.5, 30), "$")
      `
      const program = parseOpenUILang(code)

      expect(program.rootNode?.component).toBe("Metric")
      const arg1 = program.rootNode?.args[1]
      expect(typeof arg1).toBe("object")
      expect((arg1 as { type: string }).type).toBe("fn")
      expect((arg1 as { name: string }).name).toBe("@Payment")
    })

    it("gracefully tolerates comments and empty lines", () => {
      const code = `
        // Initial setup comment
        # Alternative comment style
        root = Box([Title("Hello")])

        // Trailing comment
      `
      const program = parseOpenUILang(code)
      expect(program.rootNode?.component).toBe("Box")
      expect(program.errors.length).toBe(0)
    })

    it("recovers from partial or syntax-invalid lines without throwing", () => {
      const brokenCode = `
        root = Col([header])
        header = Title("Valid")
        broken = UnclosedString("abc
        another = [1, 2,
      `
      expect(() => parseOpenUILang(brokenCode)).not.toThrow()
      const program = parseOpenUILang(brokenCode)
      expect(program.rootNode?.component).toBe("Col")
      expect(program.declarations.has("header")).toBe(true)
    })

    it("parses JSON-formatted generative UI", () => {
      const json = JSON.stringify({
        root: "Card",
        title: "JSON Generative Card",
        children: [{ type: "component", component: "Text", args: ["Rendered from JSON"] }],
      })
      const program = parseOpenUILang(json)
      expect(program.rootNode).not.toBeNull()
      expect(program.rootNode?.component).toBe("Card")
    })

    it("parses multiline statements formatted across multiple lines", () => {
      const multiline = `
        root = Col([
          header,
          metrics
        ])
        header = Title("San Francisco", "Scenic Day Route")
        metrics = Row([
          m1,
          m2
        ])
        m1 = Metric("Stops", 4)
        m2 = Metric("Duration", "8h")
      `
      const program = parseOpenUILang(multiline)
      expect(program.rootNode).not.toBeNull()
      expect(program.rootNode?.component).toBe("Col")
      expect(program.declarations.has("header")).toBe(true)
      expect(program.declarations.has("metrics")).toBe(true)
      expect(program.declarations.has("m1")).toBe(true)
    })

    it("correctly resolves root when root is assigned to an identifier reference", () => {
      const code = `
        header = Title("Trip Overview")
        details = Text("Exploring the city")
        layout = Col([header, details])
        root = layout
      `
      const program = parseOpenUILang(code)
      expect(program.rootNode).not.toBeNull()
      expect(program.rootNode?.component).toBe("Col")
    })

    it("infers top-level root component when root is omitted and multiple components exist", () => {
      const code = `
        header = Title("Unmarked Root Header")
        page = Col([header])
      `
      const program = parseOpenUILang(code)
      expect(program.rootNode).not.toBeNull()
      expect(program.rootNode?.component).toBe("Col")
    })
  })

  describe("Markdown Code Fence Extraction", () => {
    it("extracts ```openui code block from assistant markdown", () => {
      const markdown = `
Here is your requested sightseeing route:

\`\`\`openui
root = Col([header, map])
header = Title("Route")
map = Map("City", [])
\`\`\`

Hope you enjoy your trip!
      `
      const extracted = extractOpenUIFromMarkdown(markdown)
      expect(extracted.isMatch).toBe(true)
      expect(extracted.code).toContain("root = Col([header, map])")
      expect(extracted.proseBefore).toContain("Here is your requested sightseeing route:")
      expect(extracted.proseAfter).toContain("Hope you enjoy your trip!")
    })

    it("extracts ```intelligent-ui code block", () => {
      const markdown = `
\`\`\`intelligent-ui
root = Title("Smart UI")
\`\`\`
      `
      const extracted = extractOpenUIFromMarkdown(markdown)
      expect(extracted.isMatch).toBe(true)
      expect(extracted.code).toContain('root = Title("Smart UI")')
    })

    it("identifies un-fenced raw OpenUI statements starting with root =", () => {
      const raw = `root = Card([Title("Unfenced")])`
      const extracted = extractOpenUIFromMarkdown(raw)
      expect(extracted.isMatch).toBe(true)
      expect(extracted.code).toBe(raw)
    })

    it("extracts openui block when preceded by non-openui code blocks", () => {
      const markdown = `
Here is a python utility:
\`\`\`python
def calculate(a, b):
    return a + b
\`\`\`

And here is the interactive OpenUI card:
\`\`\`openui
root = Col([Title("Result"), Metric("Score", 98)])
\`\`\`
      `
      const extracted = extractOpenUIFromMarkdown(markdown)
      expect(extracted.isMatch).toBe(true)
      expect(extracted.code).toContain('root = Col([Title("Result"), Metric("Score", 98)])')
      expect(extracted.proseBefore).toContain("Here is a python utility:")
    })

    it("partitions unfenced OpenUI into proseBefore, code, and proseAfter cleanly", () => {
      const text = `Here are the ThinkPad T590 specs:

root = Col([header, specsGrid])
header = Title("ThinkPad T590", "Ultrabook Technical Matrix")
specsGrid = Grid([m1, m2], 2)
m1 = Metric("CPU", "Core i7")
m2 = Metric("RAM", "Up to 48GB")

Let me know if you would like to compare with other models.`

      const extracted = extractOpenUIFromMarkdown(text)
      expect(extracted.isMatch).toBe(true)
      expect(extracted.proseBefore).toBe("Here are the ThinkPad T590 specs:")
      expect(extracted.code).toContain('root = Col([header, specsGrid])')
      expect(extracted.code).toContain('m2 = Metric("RAM", "Up to 48GB")')
      expect(extracted.proseAfter).toBe("Let me know if you would like to compare with other models.")
    })

    it("reliably detects OpenUI code with isOpenUICode helper", () => {
      expect(isOpenUICode("root = Col([header])")).toBe(true)
      expect(isOpenUICode("  root = layout")).toBe(true)
      expect(isOpenUICode("$loanAmount = 500000\nroot = Card([s1])")).toBe(true)
      expect(isOpenUICode("header = Title('Welcome')")).toBe(true)
      expect(isOpenUICode("root = Carousel([card1, card2])")).toBe(true)
      expect(isOpenUICode("s1 = Slider($val, 0, 100, 1, 'Volume')")).toBe(true)
      expect(isOpenUICode("btn = Button('Submit', $action)")).toBe(true)
      expect(isOpenUICode("badge = Badge('Verified', 'success')")).toBe(true)
      expect(isOpenUICode("tabs = SegmentedControl($tab, ['A', 'B'])")).toBe(true)
      expect(isOpenUICode("Just regular assistant conversational text")).toBe(false)
      expect(isOpenUICode("const x = 10; function test() {}")).toBe(false)
    })
  })

  describe("Flagship Showcase Programs Validation", () => {
    it("successfully parses the San Francisco Day Route Itinerary", () => {
      const program = parseOpenUILang(SF_ITINERARY_OPENUI)
      expect(program.rootNode).not.toBeNull()
      expect(program.rootNode?.component).toBe("Col")
      expect(program.declarations.has("header")).toBe(true)
      expect(program.declarations.has("photoStrip")).toBe(true)
      expect(program.declarations.has("map")).toBe(true)
      expect(program.declarations.has("m1")).toBe(true)
      expect(program.declarations.has("m2")).toBe(true)
      expect(program.declarations.has("m3")).toBe(true)
      expect(program.declarations.has("m4")).toBe(true)
      expect(program.declarations.has("itinerary")).toBe(true)
      expect(program.declarations.has("s1")).toBe(true)
    })

    it("successfully parses the Mortgage & Loan Calculator with reactive state", () => {
      const program = parseOpenUILang(LOAN_CALCULATOR_OPENUI)
      expect(program.rootNode).not.toBeNull()
      expect(program.rootNode?.component).toBe("Card")
      expect(program.stateVariables.get("$loanAmount")).toBe(450000)
      expect(program.stateVariables.get("$interestRate")).toBe(6.5)
      expect(program.stateVariables.get("$loanYears")).toBe(30)
      expect(program.declarations.has("controls")).toBe(true)
      expect(program.declarations.has("metrics")).toBe(true)
    })

    it("successfully parses the Q4 Performance & Fleet Telemetry Dashboard", () => {
      const program = parseOpenUILang(PERFORMANCE_DASHBOARD_OPENUI)
      expect(program.rootNode).not.toBeNull()
      expect(program.rootNode?.component).toBe("Col")
      expect(program.declarations.has("kpiGrid")).toBe(true)
      expect(program.declarations.has("chartCard")).toBe(true)
      expect(program.declarations.has("tableCard")).toBe(true)
    })

    it("successfully parses the 7-Speed Commuter Bicycle Spec", () => {
      const program = parseOpenUILang(BIKE_SPEC_OPENUI)
      expect(program.rootNode).not.toBeNull()
      expect(program.rootNode?.component).toBe("Col")
      expect(program.declarations.has("gearTable")).toBe(true)
    })

    it("successfully parses the Rust Systems 3D Flashcards", () => {
      const program = parseOpenUILang(RUST_FLASHCARD_OPENUI)
      expect(program.rootNode).not.toBeNull()
      expect(program.rootNode?.component).toBe("Col")
      expect(program.declarations.has("card1")).toBe(true)
      expect(program.declarations.has("card2")).toBe(true)
    })

    it("successfully parses the ThinkPad T590 Hardware Specifications matrix", () => {
      const program = parseOpenUILang(THINKPAD_T590_OPENUI)
      expect(program.rootNode).not.toBeNull()
      expect(program.rootNode?.component).toBe("Col")
      expect(program.declarations.has("header")).toBe(true)
      expect(program.declarations.has("specsGrid")).toBe(true)
      expect(program.declarations.has("tableCard")).toBe(true)
      expect(program.declarations.has("m1")).toBe(true)
      expect(program.declarations.has("m2")).toBe(true)
      expect(program.declarations.has("m3")).toBe(true)
      expect(program.declarations.has("m4")).toBe(true)

      const html = renderToStaticMarkup(
        React.createElement(IntelligentUIRenderer, { code: THINKPAD_T590_OPENUI })
      )
      expect(html).toContain("ThinkPad T590 Specifications")
      expect(html).toContain("15.6-inch Enterprise Ultrabook Technical Matrix")
      expect(html).toContain("Intel 8th Gen Core i5 / i7")
      expect(html).toContain("Up to 48GB")
      expect(html).toContain("Hardware Subsystem Details")
    })
  })

  describe("IntelligentUIRenderer Component", () => {
    it("renders OpenUI Title and elements correctly", () => {
      const html = renderToStaticMarkup(
        React.createElement(IntelligentUIRenderer, {
          code: 'root = Title("Operator Interface", "Tactile control", "Active")',
        })
      )
      expect(html).toContain("Operator Interface")
      expect(html).toContain("Tactile control")
      expect(html).toContain("Active")
      expect(html).toContain("INTELLIGENT UI")
    })

    it("renders the interactive San Francisco Itinerary", () => {
      const html = renderToStaticMarkup(
        React.createElement(IntelligentUIRenderer, { code: SF_ITINERARY_OPENUI })
      )
      expect(html).toContain("San Francisco Day Route")
      expect(html).toContain("Golden Gate Bridge")
      expect(html).toContain("Fisherman&#x27;s Wharf")
      expect(html).toContain("Twin Peaks")
    })

    it("renders the Mortgage & Loan Calculator with computed payment", () => {
      const html = renderToStaticMarkup(
        React.createElement(IntelligentUIRenderer, { code: LOAN_CALCULATOR_OPENUI })
      )
      expect(html).toContain("Mortgage &amp; Loan Estimator")
      expect(html).toContain("Loan Principal")
      expect(html).toContain("Annual Interest Rate")
      expect(html).toContain("Est. Monthly Payment")
    })

    it("renders the 3D Flashcard and supports toggle", () => {
      const html = renderToStaticMarkup(
        React.createElement(IntelligentUIRenderer, { code: RUST_FLASHCARD_OPENUI })
      )
      expect(html).toContain("Rust Systems Engineering Review")
      expect(html).toContain("What is the difference between Box&lt;T&gt; and Rc&lt;T&gt; in Rust?")
      expect(html).toContain("Click to reveal answer")
    })

    it("renders components with named props correctly", () => {
      const code = `
        root = Card(title="Fleet Controls", subtitle="Live parameters", children=[s1, m1])
        s1 = Slider(label="Throughput Target", value=850, min=100, max=2000, unit="tps")
        m1 = Metric(label="Target Efficiency", value="94.5%", unit="")
      `
      const html = renderToStaticMarkup(
        React.createElement(IntelligentUIRenderer, { code })
      )
      expect(html).toContain("Fleet Controls")
      expect(html).toContain("Live parameters")
      expect(html).toContain("Throughput Target")
      expect(html).toContain("850")
      expect(html).toContain("Target Efficiency")
      expect(html).toContain("94.5%")
    })

    it("renders JSON Generative UI with named properties and nested children", () => {
      const json = JSON.stringify({
        component: "Card",
        title: "JSON Analytics Report",
        subtitle: "Production Telemetry",
        children: [
          {
            component: "Metric",
            label: "Model Accuracy",
            value: 99.8,
            unit: "%",
          },
        ],
      })
      const html = renderToStaticMarkup(
        React.createElement(IntelligentUIRenderer, { code: json })
      )
      expect(html).toContain("JSON Analytics Report")
      expect(html).toContain("Production Telemetry")
      expect(html).toContain("Model Accuracy")
      expect(html).toContain("99.8")
    })

    it("survives circular references gracefully without crashing with stack overflow", () => {
      const cyclicalCode = `
        a = Col([b])
        b = Col([a])
        root = a
      `
      expect(() => {
        renderToStaticMarkup(React.createElement(IntelligentUIRenderer, { code: cyclicalCode }))
      }).not.toThrow()
    })

    it("evaluates extended math and utility functions", () => {
      const code = `
        root = Col([m1, m2, m3])
        m1 = Metric("Multiplied", @Multiply(12, 5), "units")
        m2 = Metric("Rounded", @Round(123.456, 1), "")
        m3 = Metric("Added", @Add(100, 250), "$")
      `
      const html = renderToStaticMarkup(
        React.createElement(IntelligentUIRenderer, { code })
      )
      expect(html).toContain("60 units")
      expect(html).toContain("123.5")
      expect(html).toContain("350 $")
    })

    it("parses and renders curly-brace block syntax with nested children", () => {
      const blockCode = `
        root = Col(gap=16) {
          hero = Card(variant="elevated", padding=16) {
            top = Row(justify="between", align="center") {
              title = Title(text="Lenovo ThinkPad T590", size="h3")
              badge = Badge(label="Verified Market Deals", variant="success")
            }
            price_metric = Metric(label="Lowest Verified Price", value="$357.34", change="Traced across 140+ retailers", trend="down")
          }
          deals_card = Card(variant="surface", padding=14) {
            tbl_title = Title(text="Retailer Price Comparison", size="h4")
            deals_table = Table(headers=["Platform / Store", "Listing Details", "Price"]) {
              row1 = Row() {
                c1 = Text(text="Kimovil", weight="medium")
                c2 = Text(text="Global Unlocked (256GB)")
                c3 = Badge(label="$357.34", variant="success")
              }
              row2 = Row() {
                c1 = Text(text="eBay", weight="medium")
                c2 = Text(text="Lenovo ThinkPad T590 - Mint")
                c3 = Badge(label="$399.00", variant="success")
              }
            }
          }
        }
      `
      const program = parseOpenUILang(blockCode)
      expect(program.rootNode).not.toBeNull()
      expect(program.rootNode?.component).toBe("Col")
      expect(program.declarations.has("hero")).toBe(true)
      expect(program.declarations.has("deals_card")).toBe(true)
      expect(program.declarations.has("deals_table")).toBe(true)
      expect(program.declarations.has("row1")).toBe(true)

      const html = renderToStaticMarkup(
        React.createElement(IntelligentUIRenderer, { code: blockCode })
      )
      expect(html).toContain("Lenovo ThinkPad T590")
      expect(html).toContain("Verified Market Deals")
      expect(html).toContain("Lowest Verified Price")
      expect(html).toContain("Retailer Price Comparison")
      expect(html).toContain("Kimovil")
      expect(html).toContain("eBay")
    })

    it("renders MetricPrimitive with trend='neutral' using neutral styling and icon without TrendingDown", () => {
      const code = `
        root = Card("Metrics", [m1])
        m1 = Metric("Latency", "42ms", "0% change", "neutral")
      `
      const html = renderToStaticMarkup(
        React.createElement(IntelligentUIRenderer, { code })
      )
      expect(html).toContain("Latency")
      expect(html).toContain("42ms")
      expect(html).toContain("0% change")
      expect(html).not.toContain("text-rose-400")
      expect(html).not.toContain("bg-rose-500/10")
      expect(html).toContain("bg-white/10")
    })

    it("renders BadgePrimitive with variant='success' using the neutral completion token", () => {
      const code = `
        root = Card("Status", [b1])
        b1 = Badge("Operational", "success")
      `
      const html = renderToStaticMarkup(
        React.createElement(IntelligentUIRenderer, { code })
      )
      expect(html).toContain("Operational")
      expect(html).toContain("bg-[hsl(var(--success))]/10")
      expect(html).toContain("text-[hsl(var(--success))]")
      expect(html).not.toContain("border-[hsl(var(--signal))]/25")
    })

    it("renders generative UI with multiple positional arguments in Col without dropping child cards or tables", () => {
      const surfaceCode = `
Col(
  Title("Surface Laptop Ultra — Gallery & Where to Buy"),
  Row(
    Badge("Microsoft Store — official"),
    Badge("Best Buy"),
    Badge("Amazon")
  ),
  Title("The Look"),
  Grid(columns=2,
    Card(
      SearchImage("Surface Laptop Ultra Platinum"),
      Text("Platinum — the launch hero colour.")
    ),
    Card(
      SearchImage("Surface Laptop Ultra Nightfall"),
      Text("Nightfall — darker finish.")
    )
  ),
  Card(
    Title("More angles"),
    Row(
      SearchImage("Surface Laptop Ultra side profile"),
      SearchImage("Surface Laptop Ultra display")
    ),
    Text("Official press images live on press kit.")
  ),
  Title("Where to Buy"),
  Table(
    columns = ["Retailer", "What they carry"],
    rows = [
      ["Microsoft Store", "Full ladder $2,599 - $5,899"],
      ["Best Buy", "18-core and 20-core 2026 models"]
    ]
  )
)
      `
      const program = parseOpenUILang(surfaceCode)
      expect(program.rootNode).not.toBeNull()
      expect(program.rootNode?.component).toBe("Col")

      const html = renderToStaticMarkup(
        React.createElement(IntelligentUIRenderer, { code: surfaceCode })
      )
      // Verify Title
      expect(html).toContain("Surface Laptop Ultra — Gallery &amp; Where to Buy")
      // Verify Row badges
      expect(html).toContain("Microsoft Store — official")
      expect(html).toContain("Best Buy")
      expect(html).toContain("Amazon")
      // Verify Sub-headings
      expect(html).toContain("The Look")
      // Verify nested Card with SearchImage & Text
      expect(html).toContain("Platinum — the launch hero colour.")
      expect(html).toContain("Nightfall — darker finish.")
      // Verify Card with Title component and Row
      expect(html).toContain("More angles")
      expect(html).toContain("Official press images live on press kit.")
      // Verify Table
      expect(html).toContain("Where to Buy")
      expect(html).toContain("Full ladder $2,599 - $5,899")
    })
  })
})
