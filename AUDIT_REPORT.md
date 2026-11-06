# Rectified RetroRadtv v2 — audit report

This is a separate local working copy. The original RetroRadtv_v2.0 folder and GitHub site were not modified.

## Corrections

- Removed the 40-channel carousel limit; included the current channel even when it is not a saved preset.
- Replaced channel button containers with non-button containers so embedded video controls are not nested in a button. Video interaction no longer invokes channel selection.
- Restored the radio artwork playback class after redraws.
- Guarded global keyboard shortcuts when interacting with controls; Space is limited to media pages.
- Preserved saved radio volume up to 100 instead of capping it at 40.
- Reset volume to 5 for channel changes through all selection routes, retaining the initial 5-to-10 ramp.
- Removed the secondary network audio player. The visualizer is now explicitly decorative playback animation, not measured sound analysis.
- Restricted HTML offline fallback to navigation requests; failed asset requests return a network error.
- Changed admin publishing to a single Git tree/commit and non-forced branch update. The connected branch is checked before publishing. Failed intermediate blob uploads do not publish partial catalogue/branding changes.
- Removed the inactive original splash markup, removed priority-arrow movement code and hidden carousel-arrow markup/handlers, and removed the obsolete TV clock update.
- Updated the admin and player asset versions together; gave this copy its own service-worker cache namespace.

## Remaining cleanup and validation limits

The stylesheet still contains overlapping historical styling and responsive overrides. Removing all of them safely requires computed-style comparisons at desktop and mobile sizes; this report does not claim that cleanup is complete. Some hidden legacy radio artwork/metadata and compatibility analyser variables remain to avoid breaking existing consumers. Their removal is also unfinished cleanup.

JavaScript syntax checks and source regression assertions passed. These do not substitute for real playback/device testing. Touch carousel settling, native fullscreen/orientation, mobile clipping, accessibility, and the new GitHub atomic publishing flow require browser/integration tests. No publication was performed. A second audio stream is no longer opened, but decorative animation intentionally does not measure audio amplitude.

## Source regression checks

- PASS: all carousel entries rendered
- PASS: unsaved playing channel included
- PASS: video is not inside a button
- PASS: playback class restored
- PASS: full saved radio volume restored
- PASS: no duplicate analyser stream
- PASS: obsolete arrow handlers removed
- PASS: keyboard guards present
- PASS: atomic admin publish
- PASS: non-navigation offline error

## Fullscreen fit correction
The fullscreen video is fitted using the source dimensions and available stage dimensions. Source aspect ratio is retained, with black bars where needed. Updated after metadata, video resize, and viewport changes. Device verification remains pending.
