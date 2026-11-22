# Changelog

## 0.2.10 — 2026-11-22

### Changed

- Plugin page follows the unified button system: primary is a soft brand fill (18 %) with
  brand border and brand text instead of a solid brand fill with light text, secondary and
  header buttons are 32/36 px with 10 px radius and text width, and hover/disabled states
  come from DSH tokens.
- Responsive layout: auto-fit card grid with `min(100%, 280px)` columns, `min-width: 0`,
  `overflow-wrap: anywhere`, cards of one row stretched to equal height with their footer
  pushed down, and media queries at 900 and 640 px. Checked at 1280, 1024, 768 and 480 px —
  nothing overflows.
- Overlay pet behaviour, settings and handlers are unchanged.

## 0.2.9 — 2026-09-29

### Added

- Plugin manager icon, declared by the package manifest's top-level `icon` field (`assets/icon.svg`) and shown on installed bundle cards, detail pages and component rows.
- The icon embeds the complete working-state artwork **verbatim**, so the shipped illustration is not redrawn or retouched; a regression test fails if the icon and `assets/working.svg` ever diverge.

### Notes

- The icon is a manifest resource only. It is not embedded in the client runtime bundle, and `lib/client.js` is byte-identical to 0.2.8.
- The icon is drawn without a background plate. The plugin frame has no fill, so in the dark theme the black outline has low contrast against the page background and the silhouette is carried by the white belly and the bright blue body.

### Verification

- All automated checks pass, including a new manifest-icon contract test.
- The icon is validated against the DSH resolver rules (manifest-relative path, SVG, inside the package directory, within the 256 KiB limit) and confirmed present in the packed tarball.

Wait for active tasks to finish before updating. Fully quit and reopen DSH after the update to load the new Host and client modules. No profile migration or restart is performed automatically.

## 0.2.8 — 2026-09-24

### Fixed

- Restore reply-completion synchronization by calling `remote.whalePet` through a declared, lifecycle-owned child injection context after registering the namespace.
- Retry failed local Remote registration and coordinate shared mount cleanup without duplicating methods.
- Bound namespace readiness and cleanly handle cancellation, withdrawal and reconnects.

### Removed

- Temporary Sync diagnostics menu, report/clipboard controls, runtime diagnostic counters and diagnostic RPC.
- Prerelease installation instructions from the normal installation flow. This release uses npm's `latest` channel.

### Preserved

- Working and waiting states, current/global scope, dragging, size/motion/nap settings, greeting bubbles and artwork.
- Strict normal-completion semantics: cancellation, failure, history and falling work counts do not become success celebrations.
- Automated regression tests, including namespace capability checks that permissive Remote mocks previously missed.
- Entry ID `whale-pet`, module name `dsh-plugin-whale-pet`, existing preference format and separate code/artwork/font licenses.

### Verification

Normal-reply celebration was confirmed in the installed app with the namespace fix. The release also undergoes automated regression checks, isolated real Gateway/Cordis verification and offline browser checks. These do not certify every DSH version, platform or concurrent/reconnect scenario; see [compatibility notes](COMPATIBILITY.md).

Wait for active tasks to finish before updating. Fully quit and reopen DSH after the update to load the new Host and client modules. No profile migration or restart is performed automatically.
