/**
 * Reference OpenUI Lang 1.0 worked examples from thesysdev/open-intelligent-ui.
 * Used for instant demonstrations, unit tests, and quick prompts in the chat interface.
 */

export const SF_ITINERARY_OPENUI = `root = Col([header, photoStrip, map, itinerary])
header = Title("San Francisco Day Route", "Curated 1-day itinerary with scenic stops and iconic photo spots", "Full Day")
photoStrip = Carousel([p1, p2, p3])
p1 = SearchImage("Golden Gate Bridge", "Morning vistas at Fort Point", "Unsplash")
p2 = SearchImage("Fisherman's Wharf", "Historic pier & fresh seafood", "Unsplash")
p3 = SearchImage("Twin Peaks", "Panoramic sunset twilight", "Unsplash")
map = Map("San Francisco", [m1, m2, m3, m4], "Sightseeing Route", "4 stops connected across the city")
m1 = MapMarker("Golden Gate Bridge", 37.8199, -122.4783, "Walk the bridge span from Fort Point with morning light", "Sightseeing")
m2 = MapMarker("Fisherman's Wharf & Pier 39", 37.8080, -122.4177, "Clam chowder lunch & resident sea lion colonies", "Dining")
m3 = MapMarker("Lombard Street Crooked Path", 37.8021, -122.4187, "World famous eight hairpin curves & floral gardens", "Scenic")
m4 = MapMarker("Twin Peaks Overlook", 37.7544, -122.4477, "360-degree twilight view of the entire Bay Area", "Scenic")
itinerary = List([s1, s2, s3, s4], "Daily Schedule")
s1 = ListItem("09:00 AM", "Golden Gate Bridge & Fort Point", "Start with an invigorating walk along the bridge vista point.", "done", "Morning")
s2 = ListItem("12:30 PM", "Fisherman's Wharf & Pier 39", "Enjoy authentic sourdough bread bowl clam chowder.", "active", "Lunch")
s3 = ListItem("03:30 PM", "Lombard Street Hairpin Curves", "Stroll down the famous picturesque serpentine street.", "upcoming", "Afternoon")
s4 = ListItem("06:30 PM", "Twin Peaks Sunset Overlook", "Watch city lights turn on as golden hour fades into dusk.", "upcoming", "Sunset")`

export const LOAN_CALCULATOR_OPENUI = `root = Card("Mortgage & Loan Estimator", "Interactive monthly payment calculation with live amortization", [controls, metrics])
$loanAmount = 450000
$interestRate = 6.5
$loanYears = 30
controls = Col([s1, s2, s3])
s1 = Slider($loanAmount, 50000, 1000000, 10000, "Loan Principal", "$")
s2 = Slider($interestRate, 2.5, 12.0, 0.25, "Annual Interest Rate", "%")
s3 = Slider($loanYears, 10, 30, 5, "Loan Term", "Years")
metrics = Grid([m1, m2], 2)
m1 = Metric("Est. Monthly Payment", @Payment($loanAmount, $interestRate, $loanYears), "$/mo", "+2.4% vs median", "up")
m2 = Metric("Principal Amount", $loanAmount, "$", "30-yr fixed", "neutral")`

export const PERFORMANCE_DASHBOARD_OPENUI = `root = Col([header, kpiGrid, chartCard, tableCard])
header = Title("Q4 Enterprise AI Fleet Performance", "Real-time telemetry, token volumes, and execution latency", "Active Fleet")
kpiGrid = Grid([kpi1, kpi2, kpi3], 3)
kpi1 = Metric("Total Tokens Processed", "1.42M", "tokens", "+18.4% WoW", "up")
kpi2 = Metric("P95 Turn Latency", 480, "ms", "-42ms faster", "up")
kpi3 = Metric("Autonomous Tool Success", "99.2%", "rate", "+0.4%", "up")
chartCard = Chart("bar", ["Week 1", "Week 2", "Week 3", "Week 4"], [280, 420, 560, 680], "Token Volume Velocity (k)", "k")
tableCard = Table(["Agent Subsystem", "Calls", "P95 Latency", "Status"], [["Intent Router", 1240, "12ms", "Optimal"], ["Screen OCR", 420, "180ms", "Nominal"], ["Beast Searcher", 860, "85ms", "Optimal"], ["Kokoro TTS Voice", 2100, "220ms", "Active"]], "Fleet Component Breakdown")`

export const BIKE_SPEC_OPENUI = `root = Col([header, photo, specs, gearTable])
header = Title("7-Speed Commuter Bicycle", "Spec breakdown and gear transmission analysis", "Hardware Spec")
photo = SearchImage("commuter bike", "All-weather urban commuter with 7-speed Shimano internal hub", "Showcase")
specs = Grid([m1, m2], 2)
m1 = Metric("Total Kerb Weight", 11.8, "kg", "Aluminum 6061 frame", "neutral")
m2 = Metric("Top Commute Speed", 34, "km/h", "Gear 7 cruising", "up")
gearTable = Table(["Gear", "Teeth Ratio", "Development", "Best For"], [["Gear 1", "38T / 34T", "2.3m", "Steep Hill Climb"], ["Gear 2", "38T / 28T", "2.8m", "Moderate Incline"], ["Gear 3", "38T / 24T", "3.3m", "Rough Urban Terrain"], ["Gear 4", "38T / 20T", "4.0m", "Cruising Default"], ["Gear 5", "38T / 17T", "4.7m", "Fast Flats"], ["Gear 6", "38T / 14T", "5.7m", "Tailwind Sprint"], ["Gear 7", "38T / 11T", "7.2m", "Downhill Speed"]], "Shimano 7-Speed Gear Ratios")`

export const RUST_FLASHCARD_OPENUI = `root = Col([header, card1, card2])
header = Title("Rust Systems Engineering Review", "Click either card to flip and inspect the memory model answer", "Knowledge")
card1 = Flashcard("What is the difference between Box<T> and Rc<T> in Rust?", "Box<T> provides unique single ownership of heap-allocated data with zero runtime overhead. Rc<T> provides reference-counted shared ownership for single-threaded scenarios.", "Memory Management")
card2 = Flashcard("Why does FRIDAY ban .unwrap() outside #[cfg(test)]?", "Unwrapping a None or Err causes a thread panic and crashes the operator process. FRIDAY requires explicit error propagation via Result<T, AppError> and the ? operator.", "FRIDAY Constitution")`

export const THINKPAD_T590_OPENUI = `root = Col([header, specsGrid, tableCard])
header = Title("ThinkPad T590 Specifications", "15.6-inch Enterprise Ultrabook Technical Matrix", "Hardware Spec")
specsGrid = Grid([m1, m2, m3, m4], 2)
m1 = Metric("Processor Options", "Intel 8th Gen Core i5 / i7", "vPro", "Whiskey Lake-U", "neutral")
m2 = Metric("Maximum Memory", "Up to 48GB", "DDR4-2400", "1 soldered + 1 SO-DIMM", "up")
m3 = Metric("Display Panels", "15.6\\" FHD or 4K UHD", "Dolby Vision", "500 nits HDR", "neutral")
m4 = Metric("Battery Life", "Up to 14.9 hrs", "57Wh", "Rapid Charge (80% in 1h)", "up")
tableCard = Table(["Component", "Specification", "Supported Options"], [["CPU", "Intel Core i5-8265U / i7-8565U / i7-8665U vPro", "Up to 4 cores / 8 threads, 4.8GHz"], ["GPU", "Intel UHD Graphics 620 / NVIDIA GeForce MX250", "2GB GDDR5 dedicated"], ["Storage", "M.2 PCIe NVMe SSD", "Up to 2TB PCIe SSD"], ["Ports", "2x USB 3.1, 1x USB-C, 1x Thunderbolt 3, HDMI 1.4b", "RJ-45 Ethernet, microSD, Audio jack"], ["Weight", "Starting at 1.75 kg (3.87 lbs)", "Mil-SPEC 810G tested"]], "Hardware Subsystem Details")`
