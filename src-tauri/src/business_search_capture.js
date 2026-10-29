(() => {
  const request = null; // FRIDAY_SELECTION_REQUEST: replaced with JSON by the native command.
  const output = { url: location.href, title: document.title, text: "", selectedName: null, phones: [], addresses: [], results: [], photos: [], website: null, hours: null, category: null, selectionState: null, error: null };
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
      const headings = [...document.querySelectorAll("h1")].filter(rendered).filter(heading => !heading.closest('[role="feed"]')).filter(heading => text(heading) && !/^(?:Google Maps|Results|Résultats|النتائج)$/i.test(text(heading)));
      const main = headings[0]?.closest('main, [role="main"]');
      // A primary and translated heading inside one main landmark describe one listing.
      if (headings.length === 1 || (main && headings.every(heading => heading.closest('main, [role="main"]') === main))) output.selectedName = text(headings[0]).slice(0, 180);
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
    const selectedHeading = output.selectedName && [...document.querySelectorAll("h1")].find(heading => rendered(heading) && text(heading) === output.selectedName);
    const scope = selectedHeading?.closest('main, [role="main"]') || document;
    if (selectedHeading && scope !== document) output.text = text(scope).slice(0, 20000);
    const regions = output.selectedName ? [...scope.querySelectorAll('[role="region"]')].filter(rendered) : [];
    const information = regions.find(region => {
      const label = region.getAttribute("aria-label") || "";
      return label.includes(output.selectedName) && /(?: - | – )(?:Informations|Information|Details|معلومات)/i.test(label);
    });
    const facts = information || scope;
    const ownField = element => rendered(element) && !element.closest?.('article, [role="article"], [role="feed"], [role="list"]');
    const phones = new Set();
    const addPhone = raw => {
      const value = raw.trim();
      const digits = value.replace(/\D/g, "");
      if (digits.length >= 6 && digits.length <= 15 && /^[+\d\s().\-/]+$/.test(value)) phones.add(value);
    };
    for (const anchor of [...facts.querySelectorAll('a[href^="tel:"]')].filter(ownField)) {
      try { addPhone(decodeURIComponent(anchor.getAttribute("href").slice(4))); } catch { /* Malformed telephone links are ignored. */ }
    }
    // Labels and text are candidates, never an automatic match to an OSM branch.
    for (const element of [...facts.querySelectorAll("button[aria-label]")].filter(ownField).slice(0, 300)) {
      const label = element.getAttribute("aria-label") || "";
      if (/^(?:address|adresse|العنوان)\s*:/i.test(label)) output.addresses.push(label.replace(/^[^:]+:\s*/, "").slice(0, 500));
      if (/^(?:phone|téléphone|telephone|numéro de téléphone|رقم الهاتف)\s*:/i.test(label)) addPhone(label.replace(/^[^:]+:\s*/, ""));
      if (/^(?:opening hours|hours|horaires|heures|ساعات العمل)\s*:/i.test(label)) output.hours = label.replace(/^[^:]+:\s*/, "").slice(0, 2000);
    }
    if (output.selectedName) {
      for (const button of [...scope.querySelectorAll('button[aria-label]')].filter(ownField)) {
        const label = button.getAttribute("aria-label") || "";
        if (!/^(?:Photo(?: de)?|Picture(?: of)?|صورة)\s/i.test(label) || !label.includes(output.selectedName)) continue;
        for (const img of [...button.querySelectorAll('img[src]')].filter(rendered)) {
          try {
            const url = new URL(img.currentSrc || img.src, location.href);
            if (url.protocol === "https:" && /^lh[3-6]\.googleusercontent\.com$/.test(url.hostname) && !url.username && !url.password && !output.photos.includes(url.href)) output.photos.push(url.href.slice(0, 4000));
          } catch { /* Ignore invalid photo sources. */ }
          if (output.photos.length >= 6) break;
        }
        if (output.photos.length >= 6) break;
      }
      for (const anchor of [...facts.querySelectorAll('a[href]')].filter(ownField)) {
        const label = anchor.getAttribute("aria-label") || "";
        const url = external(anchor.href);
        if (url && !/(^|\.)google\.com$/.test(new URL(url).hostname) && /^(?:website|site web|site internet|الموقع الإلكتروني)\s*:/i.test(label)) { output.website = url; break; }
      }
      // Text from the full main can contain tenants and suggested businesses.
      // Read opening status only from the explicitly named information region.
      const status = information && text(information).split("\n").map(line => line.trim()).find(line => /^(?:Open|Closed|Ouvert|Fermé|مفتوح|مغلق)(?:\s|$|·)/i.test(line));
      if (!output.hours && status) output.hours = status.slice(0, 2000);
      const category = [...facts.querySelectorAll("button")].filter(ownField).map(text).find(value => value.length < 100 && /^(?:restaurant|café|coffee|hotel|hôtel|salon|boutique|magasin|agence|bakery|boulangerie|pharmacie|مطعم|مقهى|فندق)(?:\s|$)/i.test(value));
      if (category) output.category = category;
    }
    if (!isMaps) for (const match of output.text.matchAll(/(?:\+\d[\d\s().-]{5,24}\d|(?:0\d{2,3})[ .-]\d{2,3}[ .-]\d{2,3}(?:[ .-]\d{2,3})?)/g)) addPhone(match[0]);
    output.phones = [...phones].slice(0, 12);
    output.addresses = [...new Set(output.addresses)].slice(0, 8);
    if (request && isMaps) {
      const normalize = value => value.normalize("NFKD").replace(/\p{M}/gu, "").toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
      const canonicalName = value => normalize(value).replace(/^hotel\s+/, "");
      const sameName = value => canonicalName(value) === canonicalName(request.name);
      const nearby = url => {
        // Explicit listing coordinates only. @lat,lng is the camera, not the business.
        const matches = [...url.matchAll(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/g)];
        return matches.some(match => {
          const lat = Number(match[1]), lng = Number(match[2]);
          if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return false;
          return Math.hypot((lat - request.lat) * 111.32, (lng - request.lng) * 111.32 * Math.cos(request.lat * Math.PI / 180)) < 1.5;
        });
      };
      const inCity = value => request.city && normalize(value).split(" ").includes(normalize(request.city));
      if (output.selectedName) {
        output.selectionState = sameName(output.selectedName) && (nearby(output.url) || output.addresses.some(inCity)) ? "matched" : "mismatch";
      } else {
        const matches = output.results.filter(result => new URL(result.url).pathname.startsWith("/maps/place/") && sameName(result.title) && (nearby(result.url) || inCity(result.snippet)));
        output.selectionState = matches.length > 1 ? "ambiguous" : "waiting";
        if (matches.length === 1) {
          const anchor = [...document.querySelectorAll('main a[href], [role="main"] a[href]')].find(anchor => anchor.href === matches[0].url && rendered(anchor));
          if (anchor) { anchor.click(); output.selectionState = "selecting"; }
        }
      }
    }
  } catch { output.error = "The displayed page could not be read. Wait for results and import again"; }
  return output;
})()
