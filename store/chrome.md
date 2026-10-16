# Chrome Web Store listing

Copy each block into the matching field in the developer dashboard.

## Name
she aint allat

## Summary (limit 132 characters)
Interrupt the urge to look up an ex with pop-ups you wrote yourself. Private, on your device, no account.

## Category
Pick "Productivity" or "Lifestyle", whichever the dashboard offers.

## Description
she aint allat interrupts the urge to look up an ex.

You make a short list of words that should stop you: a name, a nickname, a handle, a hashtag, a place or a link. You choose which sites the extension may watch, one at a time. When your own browsing touches something on your list, the page is covered by something you chose in advance: a picture that makes you laugh, a line that calms you, a reason it ended.

Three levels, set per trigger:
- Level 0: a small nudge in the corner.
- Level 1: the page blurs and a card appears. Esc closes it.
- Level 2: a short pause with a timer. "Take me back" works from the first second.
- Optional level 3: send yourself to a page of your own.

Also included:
- Reality check: your own reasons it ended, shown in your pop-ups.
- Unsent letters: write it down, lock it for 1 to 30 days, shred it any time.
- Night mode: a short wind-down, soft sleep sounds made on your device, and one small thing for tomorrow.
- Insights in kind wording: no streaks, no scores, no red.
- Snooze, delayed trigger removal, and an optional app lock.
- A support page with emergency numbers and crisis lines by region, and a message you can send to someone you trust.
- English and Bahasa Indonesia.

Private by design:
- No account, no server, no analytics, no ads.
- Everything stays on your device. The extension makes no network requests.
- The toolbar icon is always visible, so it cannot run hidden.
- Export or delete everything whenever you like.

This is a self-help tool, not therapy or medical care.

## Single purpose
Interrupts the user's own list of personal triggers (for example the name of an ex) during browsing, using pop-ups the user wrote, to help them avoid compulsive lookups.

## Permission justifications (Privacy practices tab)

**storage**: Saves the user's triggers, pop-up items, settings and event log on their device.

**unlimitedStorage**: Pop-up pictures are stored on the device. A full set of pictures can pass the default storage limit.

**scripting**: Starts the content script on a site only after the user allows that site, and on tabs already open when they allow it.

**webNavigation**: Detects in-page navigation on sites that update the address without reloading, so a trigger in a new address is noticed.

**Host permissions (optional, `*://*/*`)**: Requested at runtime, one site at a time, only when the user presses "Allow this site" and accepts the browser prompt. The extension reads the page address, title, search boxes, visible text, image descriptions and links on that site, in memory, to compare them with the user's own triggers. Nothing is stored or sent. The broad pattern is needed because the user decides which sites to watch.

**Remote code**: No. All code is in the package. No remote scripts, no eval.

## Data usage tab
Read the definitions on screen. The extension handles website content on the device only and does not transmit anything. If the dashboard counts on-device handling, tick Website content, Web history (the domain-only log) and Personal communications (letters and reasons), and state they are never transmitted. If it counts only data sent off the device, tick nothing.

Then tick all three certifications. They are true: data is not sold, not used for anything unrelated to the single purpose, and not used for creditworthiness.

## Privacy policy URL
Use the link to PRIVACY.md in your public repository, for example:
https://github.com/YOUR-USERNAME/she-aint-allat/blob/main/PRIVACY.md

## Support URL
https://github.com/YOUR-USERNAME/she-aint-allat/issues

## Instructions for testing (Test instructions field)
No account is needed. 1) Click the toolbar icon, then Settings. 2) Under Your triggers add the word banana (Free text, Level 1). 3) Under Sites to watch type wikipedia.org and press Allow this site, then accept the prompt. 4) Open wikipedia.org and type banana in the search box. The page blurs and a card appears. 5) Try Take me back, Continue anyway, Esc, and the Need support? link on the card.

## Images
See screenshots.md. Icon: icons/icon128.png.
