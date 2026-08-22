// The whole UI, including the MediaShelf address: one field in the dropdown
// beats sending people to a separate options page for a single setting.
//
// Nothing is injected into the streaming site. Clicking the toolbar icon
// grants activeTab, the scrape runs once in that tab, and the import runs in
// the background worker so closing this popup can't kill it.


// Firefox exposes the promise-based API as `browser`; its `chrome` alias is
// callback-style, so awaiting it there returns undefined. Chrome has no
// `browser`, and its `chrome` is promise-based in MV3. One name for both.
const ext = globalThis.browser?.runtime ? globalThis.browser : globalThis.chrome;
const $ = (id) => document.getElementById(id);
const DEFAULT_URL = "http://127.0.0.1:8000";

function render(result) {
  if (!result) return;
  const r = result.result || {};
  if (result.ok && r.services !== undefined) {
    $("status").innerHTML =
      `<span class="ok">✓ ${r.services} services · ${r.added} added, ${r.kept} unchanged</span>` +
      (r.unmatchedCount ? `<br><span class="warn">${r.unmatchedCount} titles had no TMDB match</span>` : "");
  } else if (result.ok) {
    $("status").innerHTML =
      `<span class="ok">✓ ${r.added ?? 0} added, ${r.kept ?? 0} already there` +
      (r.removed ? `, ${r.removed} removed` : "") + `</span>` +
      (r.unmatched?.length
        ? `<br><span class="warn">no match: ${r.unmatched.slice(0, 3).join(", ")}` +
          (r.unmatched.length > 3 ? ` +${r.unmatched.length - 3} more` : "") + `</span>`
        : "");
  } else {
    $("status").innerHTML = `<span class="err">${result.error || "failed"}</span>`;
    // A connection failure is nearly always the wrong address, so put the
    // field in front of them rather than making them hunt for it.
    if (/reach MediaShelf/i.test(result.error || "")) $("urlrow").classList.add("open");
  }
}

async function currentUrl() {
  const { mediashelfUrl } = await ext.storage.sync.get("mediashelfUrl");
  return mediashelfUrl || DEFAULT_URL;
}

function showTarget(url) {
  $("target").textContent = url.replace(/^https?:\/\//, "");
  $("target").title = url;
}

(async () => {
  const saved = await currentUrl();
  showTarget(saved);
  $("url").value = saved;

  $("edit").onclick = (e) => {
    e.preventDefault();
    $("urlrow").classList.toggle("open");
    if ($("urlrow").classList.contains("open")) $("url").focus();
  };

  $("saveurl").onclick = async () => {
    const raw = $("url").value.trim().replace(/\/+$/, "");
    let origin;
    try {
      origin = new URL(raw).origin;
    } catch {
      $("urlnote").innerHTML = `<span class="err">That doesn't look like a URL.</span>`;
      return;
    }
    // Store first: requesting a permission can dismiss this popup, and the
    // address shouldn't be lost if that happens.
    await ext.storage.sync.set({ mediashelfUrl: raw });
    showTarget(raw);
    try {
      const granted = await ext.permissions.request({ origins: [origin + "/*"] });
      $("urlnote").innerHTML = granted
        ? `<span class="ok">Saved. Imports go to ${raw}.</span>`
        : `<span class="warn">Saved, but Chrome needs permission to reach it — press Save again and allow.</span>`;
    } catch (e) {
      $("urlnote").innerHTML = `<span class="warn">Saved. ${e.message}</span>`;
    }
  };
  $("url").onkeydown = (e) => { if (e.key === "Enter") $("saveurl").click(); };

  const [tab] = await ext.tabs.query({ active: true, currentWindow: true });
  let site = null;
  try {
    site = tab?.url ? siteForLocation(new URL(tab.url)) : null;
  } catch { /* chrome:// and friends aren't URLs we can read */ }

  // A run already in flight (popup closed and reopened), or the last outcome.
  const { job } = await ext.storage.local.get("job");
  if (job?.running) {
    $("send").disabled = true;
    const unit = job.mode === "top10" ? "services" : "titles";
    $("status").textContent = `Importing ${job.count} ${unit}… this can take a few minutes.`;
  } else if (job?.result) {
    render(job.result);
  }


  // ---- scheduled runs ----
  // Turning this on is a real decision: it opens these sites in background
  // tabs while you are not there. The note under the switch says so.
  const autoNote = (auto, eligible, last) => {
    if (!eligible.length) {
      return "Nothing to schedule yet. Clip a site once by hand and it becomes eligible.";
    }
    const when = last?.at ? new Date(last.at).toLocaleString() : null;
    const ran = when ? `Last run ${when}: ${last.ok} updated, ${last.skipped} skipped.` : "";
    return auto.enabled
      ? `Opens ${eligible.join(", ")} in background tabs, signed in as you. ${ran}`
      : `Would open ${eligible.join(", ")} in background tabs, signed in as you.`;
  };

  ext.runtime.sendMessage({ type: "getAuto" }, (info) => {
    if (!info) return;
    const { auto, eligible, lastScheduled } = info;
    $("autoon").checked = auto.enabled;
    $("autoevery").value = String(auto.intervalHours);
    $("autodetail").classList.toggle("open", auto.enabled);
    $("autonote").textContent = autoNote(auto, eligible, lastScheduled);
    $("runnow").disabled = !eligible.length;

    const push = (patch) => ext.runtime.sendMessage(
      { type: "setAuto", auto: patch },
      (next) => {
        if (!next) return;
        $("autodetail").classList.toggle("open", next.enabled);
        $("autonote").textContent = autoNote(next, eligible, lastScheduled);
      });

    $("autoon").onchange = () => push({ enabled: $("autoon").checked });
    $("autoevery").onchange = () => push({ intervalHours: Number($("autoevery").value) });
    $("runnow").onclick = () => {
      $("runnow").disabled = true;
      $("autonote").textContent = "Running now… tabs will open and close on their own.";
      ext.runtime.sendMessage({ type: "runNow" }, (res) => {
        $("runnow").disabled = false;
        $("autonote").textContent = res
          ? `Finished: ${res.ok} updated, ${res.skipped} skipped.` +
            (res.error ? ` Last error: ${res.error}` : "")
          : "Finished.";
      });
    };
  });

  if (!site) {
    $("sub").textContent = "Open your My List page on a supported service.";
    $("status").innerHTML =
      "Netflix, Prime Video, Disney+, Hulu, Max, Paramount+, Peacock, Tubi, Crunchyroll, Apple TV+";
    return;
  }

  const isTop10 = site.mode === "top10";
  $("title").textContent = `MediaShelf · ${site.name}`;
  $("sub").textContent = isTop10
    ? "Click once the page has finished loading."
    : "Click when your list has finished loading.";
  if (isTop10) $("send").textContent = "Send Top 10s";
  if (!job?.running) $("send").disabled = false;

  $("send").onclick = async () => {
    $("send").disabled = true;
    $("status").textContent = "Reading the page…";
    let payload;
    try {
      const [res] = await ext.scripting.executeScript({
        target: { tabId: tab.id },
        ...readerFor(site, [...NOISE]),
      });
      payload = res?.result;
    } catch (e) {
      $("status").innerHTML = `<span class="err">Couldn't read the page: ${e.message}</span>`;
      $("send").disabled = false;
      return;
    }
    const found = isTop10 ? Object.keys(payload || {}).length : (payload || []).length;
    if (!found) {
      // Never send nothing: with replace semantics that is a delete.
      $("status").innerHTML = isTop10
        ? `<span class="err">Found no lists. If they are visible, the page's markup has changed.</span>`
        : `<span class="err">Found no titles. If the list is visible, this service's markup has changed.</span>`;
      $("send").disabled = false;
      return;
    }
    $("status").textContent = isTop10
      ? `Importing ${found} services… this can take a few minutes.`
      : `Importing ${found} titles… this can take a few minutes.`;
    // Fire and forget: the worker owns the request and stores the outcome, so
    // closing this popup mid-import is safe.
    ext.runtime.sendMessage(
      isTop10
        ? { type: "import", mode: "top10", sections: payload, tabId: tab.id }
        : { type: "import", key: site.key, titles: payload, tabId: tab.id });
  };

  // Nothing updates a load-unpacked extension on its own, and a stale build
  // looks like a broken one when a service redesigns. Ask once a day.
  ext.runtime.sendMessage({ type: "checkUpdate" }, (upd) => {
    if (!upd) return;
    const link = $("update");
    link.style.display = "";
    link.title = `${upd.current} installed · ${upd.latest} available`;
    link.onclick = (e) => {
      e.preventDefault();
      ext.tabs.create({ url: "https://github.com/ghltshubh/mediashelf-clipper/releases/latest" });
    };
    $("updatesep").style.display = "";
  });


  ext.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes.job) return;
    const j = changes.job.newValue;
    if (j?.running) return;
    $("send").disabled = false;
    render(j?.result);
  });
})();
