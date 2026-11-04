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
