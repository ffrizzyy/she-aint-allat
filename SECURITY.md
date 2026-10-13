# Security policy

## Reporting a vulnerability

Please report privately through GitHub: **Security** tab, then **Report a vulnerability**. Do not open a public issue for security problems.

We aim to reply within 7 days and to fix confirmed high severity issues first. Please give us up to 90 days before you disclose publicly.

## Known risk: trigger probing

The overlay adds a `<div>` to the page. A hostile site could plant a guessed word in its own text and watch for that div. If it appears, the site learns that word is on the user's list. The shadow root is closed, but the host element is still visible to page scripts.

Mitigations so far: no page attributes are changed while the overlay is open, and the extension only runs on sites the user allows. Planned: move level 2 to an extension page.

## Out of scope

- Anything that needs a user to install a modified copy of the extension.
- Other people's devices. The extension has no remote install, remote view or admin mode by design.
