// Two jobs: badge the toolbar icon when you're on a list page we understand,
// and own the import request.
//
// The import runs here rather than in the popup so closing the popup can't
// abort it, and the outcome is persisted: a 30-title import takes minutes,
// and Chrome recycles this worker while it waits.

// Chrome runs this as a service worker and needs sites.js pulled in; Firefox
// runs it as an event page that already loaded sites.js via manifest scripts.

// Firefox exposes the promise-based API as `browser`; its `chrome` alias is
// callback-style, so awaiting it there returns undefined. Chrome has no
// `browser`, and its `chrome` is promise-based in MV3. One name for both.
const ext = globalThis.browser?.runtime ? globalThis.browser : globalThis.chrome;
if (typeof importScripts === "function") importScripts("sites.js");

const DEFAULT_URL = "http://127.0.0.1:8000";
const RELEASES_API = "https://api.github.com/repos/ghltshubh/mediashelf-clipper/releases/latest";
const UPDATE_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
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
  const { job } = await ext.storage.local.get("job");
  if (job?.running && job.tabId === tabId) return;
  try {
    await ext.action.setBadgeText({ tabId, text: site ? "●" : "" });
    if (site) {
      await ext.action.setBadgeBackgroundColor({ tabId, color: BRASS });
      await ext.action.setTitle({ tabId, title: `MediaShelf clipper — send your ${site.name} list` });
    }
  } catch { /* tab closed mid-update */ }
}

// Streaming sites are SPAs, so the URL often changes with no page load.
ext.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (info.url || info.status === "complete") badgeFor(tabId, info.url || tab.url);
});
ext.tabs.onActivated.addListener(async ({ tabId }) => {
  try {
    badgeFor(tabId, (await ext.tabs.get(tabId)).url);
  } catch { /* gone */ }
});

// Tabs already open when the worker (re)starts have no badge yet.
async function rescanAll() {
  for (const t of await ext.tabs.query({})) badgeFor(t.id, t.url);
}
ext.runtime.onInstalled.addListener(rescanAll);
ext.runtime.onStartup.addListener(rescanAll);

// ---------- import ----------

async function importUrl() {
  const { mediashelfUrl } = await ext.storage.sync.get("mediashelfUrl");
  return `${(mediashelfUrl || DEFAULT_URL).replace(/\/+$/, "")}/api/watchlist/import`;
}

async function setJob(job) {
  await ext.storage.local.set({ job });
}

ext.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type !== "import") return;
  (async () => {
    const tabId = msg.tabId;
    const count = msg.mode === "top10"
      ? Object.keys(msg.sections || {}).length
      : (msg.titles || []).length;
    await setJob({ running: true, count, key: msg.key, mode: msg.mode, tabId });
    if (tabId != null) {
      ext.action.setBadgeText({ tabId, text: "…" }).catch(() => {});
    }
    let result;
    try {
      const url = await importUrl();
      // Two payload shapes: one service's watchlist, or several services'
      // Top 10s from one page. Both are full-state syncs of that list.
      const posts = msg.mode === "top10"
        ? Object.entries(msg.sections || {}).map(([key, titles]) => ({
            source: key,
            list_type: "top10",
            replace: true,
            items: titles.map((t, i) => ({ title: t, rank: i + 1 })),
          }))
        : [{
            source: msg.key,
            list_type: "watchlist",
            // This IS your list on that service now. Titles saved inside
            // MediaShelf use a separate type and are never touched.
            replace: true,
            items: (msg.titles || []).map((t) => ({ title: t })),
          }];
      if (!posts.length || !posts.every((b) => b.items.length)) {
        throw new Error("nothing to send");
      }
      let services = 0, added = 0, kept = 0, removed = 0, unmatched = [];
      for (const body of posts) {
        const resp = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!resp.ok) {
          const detail = await resp.text().catch(() => "");
          throw new Error(
            `MediaShelf said HTTP ${resp.status}${detail ? `: ${detail.slice(0, 120)}` : ""}`);
        }
        const data = await resp.json();
        services += 1;
        added += data.added || 0;
        kept += data.kept || 0;
        removed += data.removed || 0;
        unmatched = unmatched.concat(data.unmatched || []);
      }
      result = msg.mode === "top10"
        ? { ok: true, result: { services, added, kept, unmatchedCount: unmatched.length } }
        : { ok: true, result: { added, kept, removed, unmatched } };
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
        await ext.action.setBadgeText({ tabId, text: result.ok ? "✓" : "!" });
        await ext.action.setBadgeBackgroundColor({
          tabId, color: result.ok ? "#3f8f4f" : "#a4442a",
        });
        // Let the outcome sit briefly, then fall back to the plain nudge.
        setTimeout(async () => {
          try {
            badgeFor(tabId, (await ext.tabs.get(tabId)).url);
          } catch { /* gone */ }
        }, 20000);
      } catch { /* gone */ }
    }
    sendResponse(result); // only lands if the popup is still open; storage is the source of truth
  })();
  return true;
});

// ---------- update check ----------
//
// Loaded unpacked, so nothing updates this extension on its own. Streaming
// sites redesign and selectors go stale, which looks like the tool breaking —
// so it asks GitHub once a day whether a newer release exists and the popup
// says so. Version only: no identifiers, nothing about you or your list.

function newer(a, b) {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d > 0;
  }
  return false;
}

async function checkForUpdate() {
  const { updateCheck } = await ext.storage.local.get("updateCheck");
  const now = Date.now();
  if (updateCheck && now - updateCheck.at < UPDATE_CHECK_INTERVAL_MS) return updateCheck;
  try {
    const resp = await fetch(RELEASES_API, { headers: { Accept: "application/vnd.github+json" } });
    if (!resp.ok) throw new Error(String(resp.status));
    const tag = (await resp.json()).tag_name || "";
    const latest = tag.replace(/^v/, "");
    const fresh = { at: now, latest, current: ext.runtime.getManifest().version };
    await ext.storage.local.set({ updateCheck: fresh });
    return fresh;
  } catch {
    // Offline or rate-limited: stay quiet, try again tomorrow.
    const stale = { at: now, latest: null, current: ext.runtime.getManifest().version };
    await ext.storage.local.set({ updateCheck: stale });
    return stale;
  }
}

ext.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type !== "checkUpdate") return;
  checkForUpdate().then((r) => {
    sendResponse(r && r.latest && newer(r.latest, r.current) ? r : null);
  });
  return true;
});
