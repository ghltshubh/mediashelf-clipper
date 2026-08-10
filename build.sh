#!/bin/sh
# Package both browser builds. Same code, different manifest: Chrome wants a
# service worker, Firefox an event page with an add-on id.
set -e
cd "$(dirname "$0")"
VER=$(python3 -c "import json;print(json.load(open('manifest.json'))['version'])")
SHARED="background.js popup.html popup.js sites.js icon-16.png icon-32.png icon-48.png icon-128.png README.md LICENSE"

rm -rf dist && mkdir -p dist/chrome/mediashelf-clipper dist/firefox/mediashelf-clipper

cp $SHARED dist/chrome/mediashelf-clipper/
cp manifest.json dist/chrome/mediashelf-clipper/

cp $SHARED dist/firefox/mediashelf-clipper/
cp manifest.firefox.json dist/firefox/mediashelf-clipper/manifest.json

(cd dist/chrome  && zip -qr "../mediashelf-clipper-chrome.zip"  mediashelf-clipper)
(cd dist/firefox && zip -qr "../mediashelf-clipper-firefox.zip" mediashelf-clipper)
rm -rf dist/chrome dist/firefox
echo "built v$VER:"
ls -lh dist/*.zip | awk '{print "  " $9, $5}'
