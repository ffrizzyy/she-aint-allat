# she aint allat

A browser extension that interrupts the urge to look up an ex. When your own browsing touches something on your own list, the page is covered by something you chose in advance: a picture that makes you laugh, a line that calms you, a reminder of why it ended.

Local first. No account, no server, no analytics. Everything stays on your device.

> This is a self-help tool, not therapy or medical care. If things feel heavy, talk to someone: [findahelpline.com](https://findahelpline.com) lists local helplines.

## How it works

You keep a list of triggers: a name, nickname, handle, hashtag, place, or a link pattern. You allow the sites you want watched, one at a time. When a trigger shows up in the address, title, a search box, visible text, image descriptions or links, the extension covers the page with an item from your own pool.

| Level | What happens |
|---|---|
| 0 | Small nudge in the corner, closes itself after 10 seconds |
| 1 | Page blurs and a card appears. Esc closes it |
| 2 | Full pause with a 30 second timer. "Take me back" works from second 0 |

The same trigger firing 3 times in 30 minutes moves up one level, never above 2.

On levels 1 and 2 the page blurs the moment a match is found, before the card loads. "Why did this fire?" on the card names the trigger and where it matched (address, title, search box, page text, a link), never the page content.

**Removing a trigger takes 24 hours.** It stays active, then asks you to confirm once more. This is a commitment device so a 1 a.m. decision cannot undo your own list. A trigger added by mistake can be removed at once within 15 minutes.

## Install (developer mode)

Needs Chrome, Edge or Brave 120 or newer. For Firefox see below.

1. Download or clone this repo.
2. Open `chrome://extensions` and turn on **Developer mode**.
3. Click **Load unpacked** and select this folder.
4. Open the extension's **Settings**, add a trigger and a pop-up line, then use **Allow this site** for each site to watch.

### Firefox (experimental)

Needs Firefox 128 or newer.

1. Run `node build-firefox.js`. It writes `dist/firefox`.
2. Open `about:debugging`, choose **This Firefox**, then **Load Temporary Add-on**, and pick `dist/firefox/manifest.json`.
3. Firefox asks for site access one site at a time, the same as Chrome.

Temporary add-ons are removed when Firefox closes. Before you publish it, change the add-on id in `manifest.firefox.json`.

## Insights

The toolbar popup opens an Insights page: detours per day, when urges show up by hour and weekday, which sites they come from, and a one line comparison with last week. Wording is kind and never counts slips against you. Everything is a table you can read with a screen reader, and you can export a CSV.

## Unsent letters

Write what you want to say without sending it. Lock a letter for 1, 3, 7 or 30 days and it stays hidden from you until then. You can shred a letter at any time, locked or open. Locking hides the text from you in the app. It is not encryption, so anyone with access to your browser profile could still read it.

## Reality check

Write down why it ended, in your own words. Reorder the list, and choose which reasons may appear in pop-ups. They show up with a small "A reason it ended" label, mixed in with your other pop-ups.

## Support

The toolbar popup and every level 1 and 2 card have a "Need support?" button. It opens a page with emergency numbers and crisis lines for Indonesia, the US, the UK and Ireland, plus worldwide directories, and a short message you can send to someone you trust by WhatsApp, text or copy. Only the text in the box is sent, nothing about your browsing. These sites are never intercepted by the extension. The resource list needs review by a clinical advisor before each release.

## Privacy

- Matching happens in memory on your device. Page content, URLs and search text are never stored.
- The event log keeps only time, domain, level and your response.
- No network requests. No analytics. No remote config.
- The toolbar icon and badge are always visible, so it cannot hide on someone's computer.
- Export and delete everything from the Settings page.

## Known limits

- Chrome family is the tested target. The Firefox build is new and only checked by tests, not yet by hand. No Safari build.
- Only the top frame of each page is watched.
- No text recognition inside images or video.
- A hostile site can probe for your trigger words by watching for the overlay. See the known risk in [SECURITY.md](SECURITY.md).
- Crisis and helpline sites are never intercepted. The list is short and needs review per country (`matcher.js`, `resources.js`).

## Development

Plain JavaScript, no build step.

```
node matcher.test.js && node rules.test.js && node stats.test.js && node manifest.test.js && node support.test.js
```

| File | Job |
|---|---|
| `matcher.js` | Text normalising and trigger matching, no DOM |
| `rules.js` | Escalation ladder and import validation, no DOM |
| `reasons.*` | Reality check page |
| `letters.*` | Unsent letters page |
| `stats.js` | Insights numbers and CSV export, no DOM |
| `content.js` | Watches the page, draws the overlay |
| `background.js` | Picks pool items, writes the event log |
| `options.*`, `popup.*` | Settings page and toolbar popup |
| `manifest.firefox.json`, `build-firefox.js` | Firefox manifest and the script that builds `dist/firefox` |
| `support.*`, `resources.js` | Support page and its region data |
| `i18n.js` | English and Bahasa Indonesia strings |

## Status

M1 plus pre-emptive blur, "Why did this fire?", delayed removal, Insights, unsent letters, reality check and a support page. Not on any extension store yet.

## License

MIT, see [LICENSE](LICENSE).
