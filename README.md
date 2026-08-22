# MediaShelf clipper

A Chrome extension that sends your streaming **"My List"** into your own
[MediaShelf](https://github.com/ghltshubh/mediashelf), where it becomes the Want-to-watch rail.

Open your list on the service's own site, click one button, done. Supported:
Netflix, Prime Video, Disney+, Hulu, Max, Paramount+, Peacock, Tubi, Crunchyroll, Apple TV+.

It can also clip the per-service **Top 10** lists from StreamScope's trending page into the
"Popular right now" rail. Read [Top 10 lists](#top-10-lists) before using that part.

**Not part of MediaShelf.** MediaShelf is a server; it never touches a logged-in session. This
runs in your browser, as you, on a page you opened. That split is deliberate — see
[Why it's separate](#why-its-separate).

## Install

Grab the zip for your browser from
[Releases](https://github.com/ghltshubh/mediashelf-clipper/releases) and unzip it.

**Chrome / Edge / Brave** — `mediashelf-clipper-chrome.zip`

1. Open `chrome://extensions`, turn on **Developer mode**.
2. **Load unpacked**, pick the unzipped `mediashelf-clipper` folder.

**Firefox** — `mediashelf-clipper-firefox.zip`

1. Open `about:debugging#/runtime/this-firefox`.
2. **Load Temporary Add-on**, pick `manifest.json` inside the unzipped folder.

   Firefox removes temporary add-ons when it restarts, so this is a per-session install. That is
   the trade for not listing on addons.mozilla.org — see
   [why it isn't in the stores](#why-it-isnt-in-the-stores). Firefox Developer Edition, Nightly
   and ESR can keep it permanently by setting `xpinstall.signatures.required` to `false` in
   `about:config`; release Firefox cannot.

Then click the toolbar icon. If your MediaShelf isn't at `http://127.0.0.1:8000`, hit **change** at
the bottom of the dropdown and enter its address (e.g. `http://192.168.1.105:8010`). Saving asks
the browser for permission to reach it.

The extension checks once a day whether a newer release exists and shows an **update** link in
the dropdown when there is one — it sends nothing but the request itself.

## Use

Go to your list on the service's own site — `netflix.com/browse/my-list`, `hulu.com/my-stuff`,
and so on. The toolbar icon gets a brass dot to say it recognises the page. Click it, and when
your list has finished loading press **Send my list**. It scrolls the page so lazy rows render,
reads the titles, sends them, and reports what MediaShelf did: added, already there, and anything
it couldn't match against TMDB.

A long list takes a few minutes to import, because MediaShelf looks up every new title. You can
close the popup and keep browsing; the icon shows `…` while it works and `✓` when it's done, and
reopening the popup shows the result.

Nothing is read until you click. There is no background fetching, no schedule, and no credentials
stored anywhere — it reads the page your browser already rendered for you, when you ask it to.

**Syncing is a click, every time.** The only way to do it automatically would be to open your
streaming account on a timer while you are away, which is the behaviour this exists to avoid.
You are on the page anyway when you add something, and the dot is there to remind you.

### Each clip replaces that service's list

An import is a full-state sync for that one service: titles you've since removed on Netflix get
removed from MediaShelf too. Two guardrails:

- Titles you saved inside MediaShelf with **+ Want to watch** are stored separately and are never
  touched by a clip.
- An empty scrape is never sent, and MediaShelf refuses empty replacements anyway — so a failed
  read can't wipe your list.

That is also why the button is a button, and not automatic on page load: a half-rendered page
would look like a shorter list.

### When a service redesigns

If the popup says it found no titles while the list is plainly visible, that service's markup has
changed. Each service is a handful of CSS selectors in `sites.js`, tried in order — a small edit.
Issues and PRs welcome.

## Top 10 lists

On [streamscope.app/trending](https://streamscope.app/trending) the same button sends each
service's Top 10 to MediaShelf, where they become the "Popular right now" rail. Netflix is
deliberately skipped: MediaShelf fills that one itself from the Top 10 Netflix publishes as open
data, and a second writer would fight it.

**Their terms ask that this data is not extracted.** I asked StreamScope for permission on
9 August 2026 and again on 21 August. Neither email was answered. Silence is not consent, and
this ships knowing that. If they object, the StreamScope entry is removed in the next release,
which is why it lives in `sites.js` as one line rather than in a separate tool.

Everything above still applies: it reads only the page you opened, only when you click, and what
it reads goes to your MediaShelf and nowhere else. Their rankings come from
[FlixPatrol](https://flixpatrol.com/), and StreamScope is worth visiting directly if you find this
useful. Nothing in MediaShelf needs this rail; without it, Netflix still fills itself and
per-service views rank by TMDB popularity.

## Why it isn't in the stores

It installs from a zip here and stays that way. A store listing would bring automatic updates,
and it would also mean a single-purpose extension that reads named streaming sites sitting where
one complaint can pull it — taking the auto-updates with it. A release you download depends on
nobody's approval.

The costs are real and accepted: Developer mode on Chrome, a per-session install on Firefox, and
the update notice in the dropdown instead of silent updates.

## Why it's separate

MediaShelf indexes streaming services and links out to them. It deliberately ships no code that
reads a logged-in session, for two reasons:

- **It can't, sensibly.** MediaShelf usually runs on a server or NAS that has no browser and none
  of your sessions.
- **It shouldn't.** Reading your account is a decision about *your* account, and it belongs in
  your hands rather than happening invisibly because you installed a server app.

Compared to the Playwright-based tool this replaces, an extension is the more honest shape: no
stored copy of your logged-in browser profile, no second browser launched with automation flags
disguised, nothing running while you're asleep. It reads what's on your screen, when you ask.

Even so: automated reading of these pages sits against the letter of most services' terms of
use, and the risk of any consequence lands on your streaming account, not on this project. Read
their terms and decide for yourself. If you'd rather not, MediaShelf has two routes needing no
extension at all: the **+ Want to watch** button on any title page, and the paste/upload box in
Settings → Plugins, which takes the official data export most services provide on request.

## Permissions, and why each one

| Permission | Why |
|---|---|
| `activeTab` + `scripting` | Read the list off the page — granted for one tab, only when you click the icon. |
| `tabs` | See the URL of tabs you switch to, so the icon can show its "clip available" dot. Chrome words this as *"read your browsing history"*; the extension never stores or sends any of it. Remove `"tabs"` from `manifest.json` if you'd rather not grant it — everything still works, minus the dot. |
| `storage` | Remember your MediaShelf address and the last import's outcome. |
| `api.github.com` | Read the latest release number, once a day, to tell you an update exists. Nothing is sent. |
| Host access to your MediaShelf | Send the titles there. Localhost is built in; any other address is requested when you save it in the dropdown. |

There is no host access to the streaming sites themselves.

## Privacy

No server, no analytics, no telemetry. Titles go to the MediaShelf address you configure and
nowhere else. Full policy: [PRIVACY.md](PRIVACY.md).

## License

MIT.
