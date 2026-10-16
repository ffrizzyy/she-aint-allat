# Firefox Add-ons (AMO) listing

## Name
she aint allat

## Summary (limit 250 characters)
Interrupt the urge to look up an ex with pop-ups you wrote yourself. You choose the words and the sites. Everything stays on your device: no account, no server, no analytics, no network requests.

## Description
Use the same description as store/chrome.md.

## Categories
Pick "Other" or the closest wellbeing category AMO offers.

## Tags
self-help, wellbeing, privacy, focus, pop-up

## Support site
https://github.com/YOUR-USERNAME/she-aint-allat/issues

## Privacy policy
Paste the text of PRIVACY.md, or link to it.

## License
MIT

## Data collection (the add-on manifest already declares "none")
The manifest says the extension collects no data. That matches PRIVACY.md.

## Notes to reviewer
- No build step, no minification, no obfuscation. The uploaded zip is the source. `node build.js` regenerates it from the repository.
- No network requests, no remote code, no eval. Search the code for `fetch`: there is none.
- Site access is optional and asked for one site at a time (`optional_host_permissions`), then a content script is registered for that site only.
- To test: open the add-on Settings, add the trigger "banana" (Free text, Level 1), allow wikipedia.org, open it and type "banana" in the search box. A blur and a card appear.
- Add-on id in the manifest: change `she-aint-allat@example.com` to your own before the first submission. It cannot be changed later.
- Minimum Firefox version: 128.
