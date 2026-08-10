// The whole UI. Nothing is injected into the streaming site: clicking the
// toolbar icon grants activeTab, the scrape runs once in that tab, and the
// import runs in the background worker so closing this popup can't kill it.

const $ = (id) => document.getElementById(id);

// Runs in the page (not here). Self-contained: executeScript can't close over
// popup scope, so selectors and noise words come in as arguments.
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

function render(result) {
  if (!result) return;
  const r = result.result || {};
  if (result.ok) {
    $("status").innerHTML =
      `<span class="ok">✓ ${r.added ?? 0} added, ${r.kept ?? 0} already there` +
      (r.removed ? `, ${r.removed} removed` : "") + `</span>` +
      (r.unmatched?.length
        ? `<br><span class="warn">no match: ${r.unmatched.slice(0, 3).join(", ")}` +
          (r.unmatched.length > 3 ? ` +${r.unmatched.length - 3} more` : "") + `</span>`
        : "");
  } else {
    $("status").innerHTML = `<span class="err">${result.error || "failed"}</span>`;
  }
}

(async () => {
  $("opts").onclick = (e) => { e.preventDefault(); chrome.runtime.openOptionsPage(); };

  const { mediashelfUrl } = await chrome.storage.sync.get("mediashelfUrl");
  $("target").textContent = (mediashelfUrl || "http://127.0.0.1:8000").replace(/^https?:\/\//, "");

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  let site = null;
  try {
    site = tab?.url ? siteForLocation(new URL(tab.url)) : null;
  } catch { /* chrome:// and friends aren't URLs we can read */ }

  // A run already in flight (popup was closed and reopened), or the last result.
  const { job } = await chrome.storage.local.get("job");
  if (job?.running) {
    $("send").disabled = true;
    $("status").textContent = `Importing ${job.count} titles… this can take a few minutes.`;
  } else if (job?.result) {
    render(job.result);
  }

  if (!site) {
    $("sub").textContent = "Open your My List page on a supported service.";
    $("status").innerHTML =
      `<span class="muted">Netflix, Prime Video, Disney+, Hulu, Max, Paramount+, Peacock, Tubi, Crunchyroll, Apple TV+</span>`;
    return;
  }

  $("title").textContent = `MediaShelf · ${site.name}`;
  $("sub").textContent = "Click when your list has finished loading.";
  if (!job?.running) $("send").disabled = false;

  $("send").onclick = async () => {
    $("send").disabled = true;
    $("status").textContent = "Reading the page…";
    let titles = [];
    try {
      const [res] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: scrapeInPage,
        args: [site.selectors, [...NOISE]],
      });
      titles = res?.result || [];
    } catch (e) {
      $("status").innerHTML = `<span class="err">Couldn't read the page: ${e.message}</span>`;
      $("send").disabled = false;
      return;
    }
    if (!titles.length) {
      // Never send an empty list: with replace semantics that is a delete.
      $("status").innerHTML =
        `<span class="err">Found no titles. If the list is visible, this service's markup has changed.</span>`;
      $("send").disabled = false;
      return;
    }
    $("status").textContent = `Importing ${titles.length} titles… this can take a few minutes.`;
    // Fire and forget: the worker owns the request and stores the outcome, so
    // closing this popup mid-import is safe.
    chrome.runtime.sendMessage({ type: "import", key: site.key, titles });
  };

  // Live updates while the popup happens to be open.
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes.job) return;
    const j = changes.job.newValue;
    if (j?.running) return;
    $("send").disabled = false;
    render(j?.result);
  });
})();
