# Security

This extension reads pages you are already signed in to and posts the titles it finds to a
MediaShelf address you configure. That makes a bug here worth more to an attacker than the
846 lines of JavaScript suggest, so please report problems privately.

## Reporting a vulnerability

**Please do not open a public issue for a security problem.**

Use GitHub's private reporting on this repository: **Security → Report a vulnerability**. If
that is unavailable to you, email **shubhankargahlot@gmail.com** with "clipper security" in
the subject.

Useful to include: what an attacker gains, the steps to reproduce it, the extension version
(shown in the popup), and the browser. Expect an acknowledgement within **7 days** and an
honest answer about when it can be fixed.

## What it can reach

- **Host permissions** on the ten streaming sites it reads, plus `api.github.com` for the
  update check and `127.0.0.1` / `localhost` for a MediaShelf running on the same machine.
- **An optional all-URLs permission**, requested only when you point it at a service outside
  the shipped list. Granted by you, per install, and revocable in the browser's extension
  settings. Narrowing this is known debt.
- **No credential handling of any kind.** It never sees, stores or transmits a password, and
  it does not sign you in. It reads a page you opened while already signed in.
- **No telemetry**, no analytics, no third-party endpoint. Titles go to the address you typed
  and nowhere else. See [PRIVACY.md](PRIVACY.md).

## Supported versions

The latest release only. Extensions update in place; there are no backports.

## Out of scope

- The fact that a site reader stops working when a service redesigns its markup. That is
  breakage, not a vulnerability. Open a normal issue.
- Anything requiring an attacker to already control the browser profile.
