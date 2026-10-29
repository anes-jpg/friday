# ADR 020: Import public Google research from a rendered window

Date: 2026-10-29

Google's free HTTP search response returned a JavaScript handoff rather than result links. Paid Places APIs and subscription component services are outside FRIDAY's budget.

Use the installed Tauri/WebView2 runtime to open a visible Google Search or Maps window. The user browses the page and explicitly imports its rendered text, result links, and contact candidates. Capture uses one fixed script and a bounded callback; there is no polling, background crawl, private Google endpoint, or new dependency. Consent and verification remain in the browser window. Navigation is restricted to Google research and consent paths, new windows are denied, and all FRIDAY application commands are rejected from research windows. Existing capabilities remain unchanged.

Captured facts remain candidates until the user confirms the business identity. Each saved contact keeps its source URL, provider, and verification time. A reviewed result may become a website lead even without an OSM listing. Such leads store search-area context separately from business coordinates, have no map pin or directions, and include quoted source text in their website brief. A result URL is never automatically treated as the official business website.

Google markup and available fields vary. The capture reads standard rendered headings, links, text, and accessible labels, and exposes the quoted page for manual review when structured candidates are incomplete. No claim of complete business data or guaranteed capture is made.
