// Reads the watchlist page you are looking at and, when you click, sends the
// titles to your MediaShelf.
//
// Deliberately click-to-send rather than automatic. An import is a full-state
// sync for that service: MediaShelf drops rows the payload doesn't contain. A
// half-rendered page would therefore delete real titles, and no page-load
// heuristic can reliably tell "the list is 12 long" from "10 more are still
// loading". You looking at the finished page is the reliable signal.

(() => {
  const site = siteForLocation(window.location);
  if (!site) return;

  const BRASS = "#e3a84c";

  function extract() {
    for (const selector of site.selectors) {
      const titles = [];
      for (const el of document.querySelectorAll(selector)) {
        const text = (
          el.getAttribute("aria-label") ||
          el.getAttribute("alt") ||
          el.innerText ||
          ""
        ).trim();
        if (text && !NOISE.has(text.toLowerCase()) && !titles.includes(text)) {
          titles.push(text);
        }
      }
      if (titles.length) return titles;
    }
    return [];
  }

  // Rows render lazily as you scroll, so a clip has to walk the page first.
  async function revealAll() {
    const start = window.scrollY;
    let lastHeight = -1;
    for (let i = 0; i < 25 && document.body.scrollHeight !== lastHeight; i++) {
      lastHeight = document.body.scrollHeight;
      window.scrollBy(0, 1600);
      await new Promise((r) => setTimeout(r, 400));
    }
    window.scrollTo(0, start);
    await new Promise((r) => setTimeout(r, 300));
  }

  const panel = document.createElement("div");
  panel.style.cssText = `
    position:fixed; right:18px; bottom:18px; z-index:2147483647;
    background:#14161a; color:#e8e6e3; border:1px solid ${BRASS}55;
    border-radius:10px; padding:12px 14px; min-width:230px;
    font:13px/1.45 -apple-system,BlinkMacSystemFont,sans-serif;
    box-shadow:0 6px 24px rgba(0,0,0,.45);`;

  const heading = document.createElement("div");
  heading.textContent = `MediaShelf · ${site.name}`;
  heading.style.cssText = `color:${BRASS}; font-weight:600; margin-bottom:6px;`;

  const status = document.createElement("div");
  status.style.cssText = "color:#9aa0a6; margin-bottom:9px;";
  status.textContent = "Ready when your list has finished loading.";

  const button = document.createElement("button");
  button.textContent = "Send my list to MediaShelf";
  button.style.cssText = `
    width:100%; padding:7px 10px; border:0; border-radius:6px; cursor:pointer;
    background:${BRASS}; color:#14161a; font:inherit; font-weight:600;`;

  const close = document.createElement("button");
  close.textContent = "×";
  close.setAttribute("aria-label", "Hide");
  close.style.cssText = `
    position:absolute; top:6px; right:9px; background:none; border:0;
    color:#9aa0a6; font-size:16px; line-height:1; cursor:pointer;`;
  close.onclick = () => panel.remove();

  button.onclick = async () => {
    button.disabled = true;
    button.style.opacity = "0.6";
    status.textContent = "Scrolling the page so every row renders…";
    await revealAll();

    const titles = extract();
    if (!titles.length) {
      // Never post an empty list: with replace semantics that is a delete.
      status.textContent =
        "Found no titles. If the list is visible, this service's markup has changed — please open an issue.";
      button.disabled = false;
      button.style.opacity = "1";
      return;
    }

    status.textContent = `Sending ${titles.length} titles…`;
    chrome.runtime.sendMessage({ type: "import", key: site.key, titles }, (resp) => {
      button.disabled = false;
      button.style.opacity = "1";
      if (resp && resp.ok) {
        const r = resp.result || {};
        status.innerHTML =
          `<span style="color:#7bc47f">✓ ${r.added ?? 0} added, ${r.kept ?? 0} already there` +
          (r.removed ? `, ${r.removed} no longer on your list` : "") +
          `</span>` +
          (r.unmatched && r.unmatched.length
            ? `<br><span style="color:#c9a227">no match: ${r.unmatched.slice(0, 3).join(", ")}` +
              (r.unmatched.length > 3 ? ` +${r.unmatched.length - 3} more` : "") + `</span>`
            : "");
      } else {
        status.innerHTML =
          `<span style="color:#e08a5f">${(resp && resp.error) || "no response"}</span>`;
      }
    });
  };

  panel.append(close, heading, status, button);
  const mount = () => document.body && document.body.appendChild(panel);
  if (document.body) mount();
  else document.addEventListener("DOMContentLoaded", mount);
})();
