const input = document.getElementById("url");
const status = document.getElementById("status");

chrome.storage.sync.get("mediashelfUrl").then(({ mediashelfUrl }) => {
  if (mediashelfUrl) input.value = mediashelfUrl;
});

document.getElementById("save").addEventListener("click", async () => {
  status.textContent = "";
  let origin;
  const raw = input.value.trim().replace(/\/+$/, "");
  try {
    origin = new URL(raw).origin;
  } catch {
    status.textContent = "That doesn't look like a URL.";
    status.style.color = "#b35900";
    return;
  }
  // The fetch happens from the service worker, so Chrome needs host permission
  // for the instance's origin. Localhost is pre-granted in the manifest.
  const granted = await chrome.permissions.request({ origins: [origin + "/*"] });
  if (!granted) {
    status.textContent = "Permission declined; the clipper can't reach that address.";
    status.style.color = "#b35900";
    return;
  }
  await chrome.storage.sync.set({ mediashelfUrl: raw });
  status.textContent = `Saved. Imports will go to ${raw}.`;
  status.style.color = "#1a7f37";
});
