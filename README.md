# RetroRadtv v2.0 — COOLmag Radio & TV

A separate mobile-first upgrade of RetroRadtv v1. The v1 folder and its files remain untouched.

## Preview on Windows

Double-click `OPEN-RETROtvRA.bat`. It starts a local preview at `http://127.0.0.1:8782/`. Keep the server window open while using the preview. You can also run `python -m http.server 8782 --bind 127.0.0.1` from this folder.

## What is included

- Three persistent themes in Settings: Retro, Modern, and Ultra, with a THEME on/off switch. LEGACY THEME is off by default; turn it on in Settings to enable the ten-tap Version 1 radio appearance.
- Radio and TV player screens now use the supplied device layout: centered live radio dial with station identity, compact station tiles and horizontal volume slider; TV picture with channel strip, playback keys and a touch-sized circular remote.
- Three quick taps on the radio artwork or a blank, non-control part of the TV page cycles themes in place; the radio glow follows the selected theme.
- On the Radio page, tap a blank area outside the artwork ten times to switch between the Version 2 and Version 1 radio appearance. This preference is saved on that browser. It only changes the radio styling and does not restart playback; triple-tap the artwork to keep cycling the global theme.
- Theme changes only restyle the current app page. They do not navigate, reload, or restart the active stream.
- Radio page with up to ten saved station quick-tune cards, one glow-cycle control (Color, Warm, White, Off), and Music/Talk/Movie level profiles.
- Live TV full-screen display with channel name and country plus transparent HOME, previous, play/pause, next, and mute controls on the right. HOME exits full screen back to the TV page so the channel list is available.
- Recently played history for both radio and TV under Presets.
- Explore filters for language, country, and genre. In Discover Online, choose Tamil, Hindi, or English to see up to 20 matching TV streams, ordered by reported stream quality. The public IPTV directory does not provide reliable popularity rankings, so the app does not label this quality ordering as popularity.
- A brief, skippable educational/private-use splash screen.
- Existing radio/TV presets, channel order, hidden-channel choices, and volume storage keys from v1 are retained. On the same browser and website origin, those saved choices are read by v2. A different website domain or browser has separate storage.
- Separate v2 service-worker cache namespace, so v2 updates do not delete v1’s cache.

## Publish this copy

Upload the contents of this folder to the repository root for a standalone site, or upload the folder into a repository and enable GitHub Pages for that location. The app uses relative paths, so both layouts work. Do not overwrite the v1 folder.

The Admin page asks for the target GitHub repository and optional app-folder path before connecting. For example, enter the folder name when this app is hosted inside a repository subfolder. This avoids accidentally publishing v2 catalogue edits to v1’s root JSON files. Use a fine-grained token with Contents read/write access, and only enter it in the Admin tab.

## Channel availability

The bundled station and TV catalogue is copied from the v1 snapshot. Explore’s online discovery uses Radio Browser and the public iptv-org directory. Those directories can contain streams that are offline, region-limited, or not permitted for redistribution; availability and viewing rights depend on the broadcaster and your location. The language filter ranks matching results by reported stream quality, not popularity.

The TV catalogue now starts with 25 curated picks: five each in News, Music, Education, Entertainment, and Kids, with Tamil, Hindi, and English channels represented across the set. The public IPTV directory does not publish trustworthy popularity rankings, so these are hand-curated picks rather than measured “top 5” rankings. The directly playable education streams found are English language; Tamil/Hindi PM e-Vidya links found in the public list were HTTP-only or YouTube channel pages, so they are not presented as direct playable streams on the HTTPS app.

Catalogue source: [iptv-org country playlists](https://github.com/iptv-org/iptv/tree/master/streams). Stream links are directory entries, not a guarantee of uptime, permission, or geographic availability. The app links to streams and does not host video.
