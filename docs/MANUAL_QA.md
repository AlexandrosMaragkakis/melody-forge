# Manual browser QA

Date: 2026-08-09

Production Chromium was exercised at 1440x1000 and 390x844 through:

`generate -> play -> stop -> replay -> select two parents -> evolve -> audition a descendant -> favorite -> reload -> project export -> MIDI export -> project import`

Checks performed in both viewports:

- Tone.js audio initialized only after Play; another Play and Stop cancelled the
  active schedule. Eager-load autoplay warnings found in the first pass were
  removed by loading Tone inside the gesture path.
- Favorites and generation 1 survived reload. Imported versioned JSON was
  validated and restored. MIDI/project downloads produced expected filenames.
- Unexpected browser console errors and warnings: none after the audio fix.
- Axe violations: none in the exercised workspace.
- Keyboard Tab moved focus to an interactive element and visible focus styling
  remained enabled.
- Document width did not exceed the viewport at either size.
- Candidate controls wrapped at mobile width without clipping. The initially
  sticky desktop evolution panel was changed to normal flow after screenshot
  inspection showed that it could obscure candidate cards while scrolling.
- Parent selection cleared after evolution/import; no stale third selection was
  possible. Playback status changed to stopped on Stop.

Captured artifacts:

- `screenshots/desktop-chromium-workflow.png`
- `screenshots/mobile-chromium-workflow.png`

Automated visual/accessibility checks supplement, but do not replace, listening
and human aesthetic judgment. The deterministic seeds in the README are the
recommended manual listening set.
