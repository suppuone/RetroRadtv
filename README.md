# Mobile Retro Radio v1.0

Standalone retro radio and live TV app for phones and desktop browsers.

## GitHub Pages

Repository: `suppuone/RetroRadtv`

After enabling GitHub Pages from `main` / `/(root)`, open:

`https://suppuone.github.io/RetroRadtv/`

Keep `index.html`, `style.css`, and `app.js` in the repository root. Keep the station catalogs in `data/radio-presets.json` and `data/tv-presets.json`.

## Install on a phone

- **Android:** open the Pages link in Chrome and tap **INSTALL** in the app, or use Chrome's menu and choose **Install app** / **Add to Home screen**.
- **iPhone/iPad:** open the link in Safari, tap **Share**, then **Add to Home Screen**.

Launch the COOLmagRaTv home-screen icon to open the app without the normal browser address bar. Radio and TV streams still require an internet connection.

## Local preview

From this folder, run `python -m http.server 8000`, then open `http://localhost:8000/`.

Favorites and volume are stored in the current browser. Stream availability can vary by provider, region, and device.

## Administrator catalogue tools

- Tap the **COOLmagRaTv** title in the app header seven times to reveal the Admin button, then open it in a separate browser tab.
- Connect with a fine-grained GitHub token limited to the `suppuone/RetroRadtv` repository and **Contents: read and write** permission.
- Enter the token in the admin tab. It is kept only for that tab session and cleared when you return to the player; it is not saved to local storage or app files.
- Edit Radio or TV catalogue entries, preview cards, import/export JSON or M3U, reorder entries, undo draft edits, review the diff, and publish to the `main` branch.
- Each changed catalogue file is published as its own GitHub commit. If the online file changed since the admin panel loaded it, publishing stops and asks you to reconnect to prevent overwriting someone else’s update.
- Personal presets saved by each viewer remain in that viewer’s browser and are separate from the shared catalogue.
