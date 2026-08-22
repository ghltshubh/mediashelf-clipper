// The two functions that actually read a page. They are injected into the tab
// by `scripting.executeScript`, so they must be self-contained: no imports, no
// closure over anything here. Everything they need arrives as arguments.
//
// They live in their own file because both callers need them — the popup when
// you click, and the background worker when a scheduled run fires.

// One page, one service. Returns a flat list of titles.
async function scrapeInPage(selectors, noise) {
  const noiseSet = new Set(noise);
  const start = window.scrollY;
  let lastHeight = -1;
  // Rows render lazily, so walk the page before reading it.
  for (let i = 0; i < 25 && document.body.scrollHeight !== lastHeight; i++) {
    lastHeight = document.body.scrollHeight;
    window.scrollBy(0, 1600);
    await new Promise((r) => setTimeout(r, 400));
  }
  window.scrollTo(0, start);
  await new Promise((r) => setTimeout(r, 300));

  for (const selector of selectors) {
    const titles = [];
    for (const el of document.querySelectorAll(selector)) {
      const text = (
        el.getAttribute("aria-label") || el.getAttribute("alt") || el.innerText || ""
      ).trim();
      if (text && !noiseSet.has(text.toLowerCase()) && !titles.includes(text)) {
        titles.push(text);
      }
    }
    if (titles.length) return titles;
  }
  return [];
}

// One page, several services split by heading. Returns {serviceKey: [titles]}.
function readSectionsInPage(services, headerSource, noise) {
  const headerRe = new RegExp(headerSource, "i");
  const heads = [...document.querySelectorAll("h2,h3")].map((h) => (h.innerText || "").trim());
  const out = {};
  let current = null;
  for (const text of heads) {
    if (!text) continue;
    const m = text.match(headerRe);
    if (m) {
      current = services[m[1].trim().toLowerCase()] || null;
      if (current) out[current] = out[current] || [];
      continue;
    }
    const low = text.toLowerCase();
    if (current && !low.includes("top 10") && !noise.some((n) => low.includes(n))
        && !out[current].includes(text) && out[current].length < 10) {
      out[current].push(text);
    }
  }
  for (const k of Object.keys(out)) if (!out[k].length) delete out[k];
  return out;
}

// What to inject for a given site, and with what arguments.
function readerFor(site, noise) {
  return site.mode === "top10"
    ? { func: readSectionsInPage, args: [site.services, site.headerSource, noise] }
    : { func: scrapeInPage, args: [site.selectors, noise] };
}
