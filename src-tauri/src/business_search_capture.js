(() => {
  const output = { url: location.href, title: document.title, text: "", selectedName: null, phones: [], addresses: [], results: [], error: null };
  try {
    const rendered = element => element && element.getClientRects().length > 0 && getComputedStyle(element).visibility !== "hidden";
    const text = element => (element?.innerText || "").trim();
    output.text = text(document.body).slice(0, 20000);
    if (document.querySelector('form[action*="/sorry/"]') || document.querySelector('iframe[src*="recaptcha"]')) {
      output.error = "Finish Google's verification in the search window, then import again";
      return output;
    }
    const isMaps = location.pathname.startsWith("/maps");
    if (isMaps) {
      const names = [...document.querySelectorAll("h1")].filter(rendered).filter(heading => !heading.closest('[role="feed"]')).map(text).filter(name => name && !/^(?:Google Maps|Results|Résultats|النتائج)$/i.test(name));
      if (names.length === 1) output.selectedName = names[0].slice(0, 180);
    }
    const external = raw => {
      try {
        let url = new URL(raw, location.href);
        if (url.hostname === "www.google.com" && url.pathname === "/url") url = new URL(url.searchParams.get("q") || url.searchParams.get("url") || "");
        if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return null;
        if (/(^|\.)google\.com$/.test(url.hostname)) return isMaps && url.pathname.startsWith("/maps/place/") ? url.href : null;
        return url.href;
      } catch { return null; }
    };
    const seen = new Set();
    for (const heading of [...document.querySelectorAll("h3")].filter(rendered).slice(0, 80)) {
      const anchor = heading.closest("a") || heading.querySelector("a");
      const url = anchor && external(anchor.href);
      if (!url || seen.has(url)) continue;
      let container = anchor;
      for (let depth = 0; depth < 4 && container.parentElement; depth++) {
        const parent = container.parentElement;
        if (parent.querySelectorAll("h3").length > 1 || text(parent).length > 1800) break;
        container = parent;
      }
      output.results.push({ title: text(heading).slice(0, 200), url, snippet: text(container).slice(0, 900) });
      seen.add(url);
      if (output.results.length >= 20) break;
    }
    if (isMaps) {
      for (const anchor of [...document.querySelectorAll('main a[href], [role="main"] a[href]')].filter(rendered).slice(0, 600)) {
        const url = external(anchor.href);
        const title = (anchor.getAttribute("aria-label") || text(anchor)).trim();
        if (!url || !title || seen.has(url)) continue;
        output.results.push({ title: title.slice(0, 200), url, snippet: text(anchor.parentElement).slice(0, 900) });
        seen.add(url);
        if (output.results.length >= 20) break;
      }
    }
    const phones = new Set();
    const addPhone = raw => {
      const value = raw.trim();
      const digits = value.replace(/\D/g, "");
      if (digits.length >= 6 && digits.length <= 15 && /^[+\d\s().\-/]+$/.test(value)) phones.add(value);
    };
    for (const anchor of [...document.querySelectorAll('a[href^="tel:"]')].filter(rendered)) {
      try { addPhone(decodeURIComponent(anchor.getAttribute("href").slice(4))); } catch { /* Malformed telephone links are ignored. */ }
    }
    // Labels and text are candidates, never an automatic match to an OSM branch.
    for (const element of [...document.querySelectorAll("button[aria-label]")].filter(rendered).slice(0, 300)) {
      const label = element.getAttribute("aria-label") || "";
      if (/^(?:address|adresse|العنوان)\s*:/i.test(label)) output.addresses.push(label.replace(/^[^:]+:\s*/, "").slice(0, 500));
      if (/^(?:phone|téléphone|telephone|numéro de téléphone|رقم الهاتف)\s*:/i.test(label)) addPhone(label.replace(/^[^:]+:\s*/, ""));
    }
    for (const match of output.text.matchAll(/(?:\+\d[\d\s().-]{5,24}\d|(?:0\d{2,3})[ .-]\d{2,3}[ .-]\d{2,3}(?:[ .-]\d{2,3})?)/g)) addPhone(match[0]);
    output.phones = [...phones].slice(0, 12);
    output.addresses = [...new Set(output.addresses)].slice(0, 8);
  } catch { output.error = "The displayed page could not be read. Wait for results and import again"; }
  return output;
})()
