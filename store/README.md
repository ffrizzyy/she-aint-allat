# Publishing, step by step

1. Fill the placeholders: `YOUR-USERNAME` and `YOUR-EMAIL-HERE` in `PRIVACY.md` and the files in this folder, and the add-on id in `manifest.firefox.json`.
2. Run `node build.js`. It writes `dist/she-aint-allat-chrome-0.1.0.zip` and `dist/she-aint-allat-firefox-0.1.0.zip`.
3. Test each zip once as an unpacked extension (`dist/chrome` in Chrome, `dist/firefox` in Firefox).
4. Take the screenshots in `screenshots.md`.
5. Chrome: register at the Chrome Web Store developer dashboard (one-time fee), choose New item, upload the chrome zip, then fill the fields from `chrome.md`.
6. Firefox: sign in at addons.mozilla.org, choose Submit a New Add-on, pick "On this site", upload the firefox zip, then fill the fields from `firefox.md`.
7. Expect a review. The broad optional site access in Chrome can mean a longer review. The permission texts in `chrome.md` are written for that.
8. For every later release, raise `version` in both manifests, run `node build.js`, and upload the new zips.
