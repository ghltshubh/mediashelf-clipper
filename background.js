// Two jobs: badge the toolbar icon when you're on a list page we understand,
// and own the import request.
//
// The import runs here rather than in the popup so closing the popup can't
// abort it, and the outcome is persisted: a 30-title import takes minutes,
// and Chrome recycles this worker while it waits.

importScripts("sites.js");

const DEFAULT_URL = "http://127.0.0.1:8000";
const BRASS = "#e3a84c";

// ---------- badge nudge ----------

function siteForUrl(url) {
  try {
    return url ? siteForLocation(new URL(url)) : null;
  } catch {
    return null; // chrome://, about:blank and friends
  }
}

async function badgeFor(tabId, url) {
  const site = siteForUrl(url);
  // Don't stomp on the badge of a tab that is mid-import.
  const { job } = await chrome.storage.local.get("job");
  if (job?.running && job.tabId === tabId) return;
  try {
    await chrome.action.setBadgeText({ tabId, text: site ? "●" : "" });
    if (site) {
      await chrome.action.setBadgeBackgroundColor({ tabId, color: BRASS });
      await chrome.action.setTitle({ tabId, title: `MediaShelf clipper — send your ${site.name} list` });
    }
  } catch { /* tab closed mid-update */ }
}

// Streaming sites are SPAs, so the URL often changes with no page load.
chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (info.url || info.status === "complete") badgeFor(tabId, info.url || tab.url);
});
chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  try {
    badgeFor(tabId, (await chrome.tabs.get(tabId)).url);
  } catch { /* gone */ }
});

// Tabs already open when the worker (re)starts have no badge yet.
async function rescanAll() {
  for (const t of await chrome.tabs.query({})) badgeFor(t.id, t.url);
}
chrome.runtime.onInstalled.addListener(rescanAll);
chrome.runtime.onStartup.addListener(rescanAll);

// ---------- import ----------

async function importUrl() {
  const { mediashelfUrl } = await chrome.storage.sync.get("mediashelfUrl");
  return `${(mediashelfUrl || DEFAULT_URL).replace(/\/+$/, "")}/api/watchlist/import`;
}

async function setJob(job) {
  await chrome.storage.local.set({ job });
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type !== "import") return;
  (async () => {
    const tabId = msg.tabId;
    await setJob({ running: true, count: msg.titles.length, key: msg.key, tabId });
    if (tabId != null) {
      chrome.action.setBadgeText({ tabId, text: "…" }).catch(() => {});
    }
    let result;
    try {
      if (!msg.titles?.length) throw new Error("nothing to send");
      const resp = await fetch(await importUrl(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: msg.key,
          list_type: "watchlist",
          // Full-state sync: this IS your list on that service now. Titles saved
          // inside MediaShelf use a separate type and are never touched.
          replace: true,
          items: msg.titles.map((t) => ({ title: t })),
        }),
      });
      if (!resp.ok) {
        const detail = await resp.text().catch(() => "");
        throw new Error(`MediaShelf said HTTP ${resp.status}${detail ? `: ${detail.slice(0, 120)}` : ""}`);
      }
      result = { ok: true, result: await resp.json() };
    } catch (e) {
      const m = String(e?.message || e);
      result = {
        ok: false,
        error: m.includes("Failed to fetch")
          ? "Couldn't reach MediaShelf — check the URL in this extension's options."
          : m,
      };
    }
    await setJob({ running: false, key: msg.key, tabId, result });
    if (tabId != null) {
      try {
        await chrome.action.setBadgeText({ tabId, text: result.ok ? "✓" : "!" });
        await chrome.action.setBadgeBackgroundColor({
          tabId, color: result.ok ? "#3f8f4f" : "#a4442a",
        });
        // Let the outcome sit briefly, then fall back to the plain nudge.
        setTimeout(async () => {
          try {
            badgeFor(tabId, (await chrome.tabs.get(tabId)).url);
          } catch { /* gone */ }
        }, 20000);
      } catch { /* gone */ }
    }
    sendResponse(result); // only lands if the popup is still open; storage is the source of truth
  })();
  return true;
});
