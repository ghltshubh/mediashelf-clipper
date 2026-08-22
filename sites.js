// Which page are we on, and how are titles marked up there?
//
// Two kinds of page:
//
//   mode "watchlist" (the default) — one page belongs to one service, and
//   `selectors` are tried in order until one yields titles. `key` must match
//   MediaShelf's seeded Service.key so the import is attributed correctly.
//
//   mode "top10" — one page carries several services at once, split by
//   headings, so the entry brings a `services` lookup instead of a `key`.
//
// Selectors drift when a service redesigns, which is why several are listed
// and a stale one falls through rather than breaking the clip.

const SITES = [
  {
    key: "netflix",
    name: "Netflix",
    test: (l) => l.hostname.endsWith("netflix.com") && l.pathname.includes("/browse/my-list"),
    selectors: [
      '[data-uia="collections-title"] a[aria-label]',
      ".title-card a[aria-label]",
      ".title-card .fallback-text",
      ".slider-refocus[aria-label]",
    ],
  },
  {
    key: "prime_video",
    name: "Prime Video",
    test: (l) => l.hostname.endsWith("primevideo.com") && l.pathname.includes("watchlist"),
    selectors: [
      '[data-testid="card"] a[aria-label]',
      "article[aria-label]",
      'a[aria-label][href*="/detail/"]',
      'img[alt]:not([alt=""])',
    ],
  },
  {
    key: "disney_plus",
    name: "Disney+",
    test: (l) => l.hostname.endsWith("disneyplus.com") && l.pathname.includes("watchlist"),
    selectors: [
      'a[data-testid="set-item"] img[alt]',
      '[data-gv2elementkey] img[alt]:not([alt=""])',
      'a[aria-label][href*="/browse/"]',
      'img[alt]:not([alt=""])',
    ],
  },
  {
    key: "hulu",
    name: "Hulu",
    test: (l) => l.hostname.endsWith("hulu.com") && l.pathname.includes("/my-stuff"),
    selectors: [
      "[data-automationid] a[aria-label]",
      ".StandardEmphasisNavigation a[aria-label]",
      'a[aria-label][href*="/watch/"]',
      'img[alt]:not([alt=""])',
    ],
  },
  {
    key: "max",
    name: "Max",
    test: (l) => l.hostname.endsWith("max.com") && l.pathname.includes("/mylist"),
    selectors: [
      'a[aria-label][href*="/show/"]',
      'a[aria-label][href*="/movie/"]',
      "[data-testid] a[aria-label]",
      'img[alt]:not([alt=""])',
    ],
  },
  {
    key: "paramount_plus",
    name: "Paramount+",
    test: (l) => l.hostname.endsWith("paramountplus.com") && l.pathname.includes("/watchlist"),
    selectors: [
      ".watch-list a[aria-label]",
      'a[aria-label][href*="/shows/"]',
      'a[aria-label][href*="/movies/"]',
      'img[alt]:not([alt=""])',
    ],
  },
  {
    key: "peacock",
    name: "Peacock",
    test: (l) => l.hostname.endsWith("peacocktv.com") && l.pathname.includes("/my-stuff"),
    selectors: [
      'a[aria-label][href*="/watch/asset/"]',
      "[data-testid] a[aria-label]",
      'img[alt]:not([alt=""])',
    ],
  },
  {
    key: "tubi",
    name: "Tubi",
    test: (l) => l.hostname.endsWith("tubitv.com") && l.pathname.includes("/my-stuff"),
    selectors: [
      '[class*="tile"] img[alt]:not([alt=""])',
      'a[href*="/tv-shows/"] img[alt], a[href*="/series/"] img[alt], a[href*="/movies/"] img[alt]',
    ],
  },
  {
    key: "crunchyroll",
    name: "Crunchyroll",
    test: (l) => l.hostname.endsWith("crunchyroll.com") && l.pathname.includes("/watchlist"),
    selectors: [
      'a[href*="/series/"] h4',
      '[data-t="title"]',
      'a[aria-label][href*="/series/"]',
      'img[alt]:not([alt=""])',
    ],
  },
  {
    key: "apple_tv_plus",
    name: "Apple TV+",
    // "Up Next" is a shelf on the home room rather than a real watchlist page,
    // so this one is best-effort.
    test: (l) => l.hostname === "tv.apple.com" && l.pathname.includes("/room/up-next"),
    selectors: [
      'a[aria-label][href*="/movie/"]',
      'a[aria-label][href*="/show/"]',
      'img[alt]:not([alt=""])',
    ],
  },
];

// StreamScope publishes each service's Top 10 on one page, under a heading
// per service. Netflix is deliberately absent: MediaShelf fills that rail
// itself from the Top 10 Netflix publishes as open data, and a second writer
// would fight it.
//
// Their terms ask that this data is not extracted. Permission was requested on
// 9 August 2026 and again on 21 August, and neither email was answered. See
// the README before using this one.
SITES.push({
  key: "streamscope",
  name: "StreamScope Top 10",
  mode: "top10",
  test: (l) => l.hostname.endsWith("streamscope.app") && l.pathname.startsWith("/trending"),
  headerSource: String.raw`^(.*?)\s+top\s*10\b`,
  services: {
    "prime video": "prime_video",
    "apple tv": "apple_tv_plus",
    "disney+": "disney_plus",
    "disney plus": "disney_plus",
    hulu: "hulu",
    max: "max",
    "hbo max": "max",
    "paramount+": "paramount_plus",
    "paramount plus": "paramount_plus",
    peacock: "peacock",
  },
});

// Chrome, button labels and store badges all end up in aria-label/alt text.
const NOISE = new Set([
  "play", "more info", "add to my list", "remove", "logo", "image", "thumbnail",
  "poster", "loading", "netflix", "prime video", "hulu", "app store - apple",
  "google play", "app store - microsoft", "app store", "download on the app store",
  "streamscope", "get this daily", "subscribe", "sign up", "charts today",
  "blog", "privacy", "terms",
]);

function siteForLocation(l) {
  return SITES.find((s) => s.test(l)) || null;
}
