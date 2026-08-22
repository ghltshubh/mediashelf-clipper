# Privacy policy — MediaShelf clipper

_Last updated: 22 August 2026_

Short version: this extension has no server, no analytics, no account, and no telemetry. Nothing
about you is collected, stored remotely, or sold. It sends titles to a server **you** run and
nowhere else.

If you switch on the optional schedule, it also opens those sites in background tabs on a timer,
signed in as you, and reads them the same way. That is described in the README under Scheduled
updates. It is off unless you turn it on, and what it reads still goes only to your MediaShelf.

## What it reads

When you click the extension's toolbar icon on a supported "My List" page, it reads the visible
titles from that page — the page your browser has already rendered for you. It reads nothing on
any other site. Without the optional schedule it reads nothing at all until you click.

It never reads, stores, or transmits your credentials, cookies, or session tokens for any
streaming service. It does not log in, and it cannot: it only sees the finished page, the same as
you do.

## Where data goes

Titles are sent to the MediaShelf address you configure — by default `http://127.0.0.1:8000`,
i.e. your own computer. That address is normally a machine on your own network. Nothing is sent
to the extension's author, and there is no third-party service in the path.

## What is stored, and where

Stored locally in your browser's extension storage only:

- The MediaShelf address you entered.
- The outcome of your last import (counts, and any titles that could not be matched), so the
  dropdown can still show it after you close the popup.
- The date of the last update check.

You can erase all of it by removing the extension.

## Network requests it makes

1. **To your MediaShelf**, when you click send: the list of titles.
2. **To `api.github.com`**, at most once a day: a request for this project's latest release number,
   so the dropdown can tell you an update exists. It is an ordinary unauthenticated request; no
   identifier, no page content, and nothing about your list is included. GitHub will see the
   request as it would any anonymous visit. Remove the `api.github.com` host permission from
   `manifest.json` if you would rather it never happen.

## Permissions

Each permission and why it exists is listed in the
[README](https://github.com/ghltshubh/mediashelf-clipper#permissions-and-why-each-one).

## Changes

Any change to this policy will be committed to this repository, so its full history is public.

## Contact

Open an issue at
[github.com/ghltshubh/mediashelf-clipper/issues](https://github.com/ghltshubh/mediashelf-clipper/issues).
