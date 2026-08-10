// Posts clipped titles to MediaShelf. Lives in the service worker because the
// fetch must go from the extension's context (host_permissions), not the
// streaming site's (its CORS policy would block a cross-origin POST).

const DEFAULT_URL = "http://127.0.0.1:8000";

async function importUrl() {
  const { mediashelfUrl } = await chrome.storage.sync.get("mediashelfUrl");
  return `${(mediashelfUrl || DEFAULT_URL).replace(/\/+$/, "")}/api/watchlist/import`;
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type !== "import") return;
  (async () => {
    try {
      if (!msg.titles || !msg.titles.length) throw new Error("nothing to send");
      const resp = await fetch(await importUrl(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: msg.key,
          list_type: "watchlist",
          // Full-state sync: this IS your list on that service now. Titles you
          // saved inside MediaShelf use a separate type and are never touched.
          replace: true,
          items: msg.titles.map((t) => ({ title: t })),
        }),
      });
      if (!resp.ok) {
        const detail = await resp.text().catch(() => "");
        throw new Error(`MediaShelf said HTTP ${resp.status}${detail ? `: ${detail.slice(0, 120)}` : ""}`);
      }
      sendResponse({ ok: true, result: await resp.json() });
    } catch (e) {
      const m = String(e && e.message ? e.message : e);
      sendResponse({
        ok: false,
        error: m.includes("Failed to fetch")
          ? "Couldn't reach MediaShelf — check the URL in this extension's options."
          : m,
      });
    }
  })();
  return true; // keep the channel open for the async reply
});
