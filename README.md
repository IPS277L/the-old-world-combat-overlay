# Macros Repo

This folder is structured as a standalone macros repository.

## Layout

- `macros/overlay/`
  - User-facing macro entrypoints.
  - `overlay-toggle.js`
  - `spell-cast.js`

- `macros/src/actions/`
  - Editable source of truth for actions library.
  - `00-core.js`
  - `10-attack-flow.js`
  - `20-defence-flow.js`
  - `30-api.js`

- `macros/src/overlay/`
  - Editable source of truth for overlay library.
  - `00-header-and-combat.js`
  - `10-layout-and-state.js`
  - `20-controls.js`
  - `30-status-and-api.js`

- `macros/libs/`
  - Generated monolithic libraries (compatibility macros for Foundry import).
  - `tow-actions-lib-v1.js`
  - `tow-overlay-lib-v1.js`

- `macros/libs/actions-runtime/`
  - Generated runtime-decoupled action macros.
  - Part macros + loader macro register `game.towActions`.

- `macros/libs/overlay-runtime/`
  - Generated runtime-decoupled overlay macros.
  - Part macros + loader macro register `game.towOverlay`.

- `macros/tools/`
  - Local build tooling.
  - `build-actions-lib.sh`
  - `build-actions-runtime-libs.mjs`
  - `build-overlay-lib.sh`
  - `build-overlay-runtime-libs.mjs`

## Build

- Rebuild actions artifacts:
  - `bash macros/tools/build-actions-lib.sh`

- Rebuild overlay artifacts:
  - `bash macros/tools/build-overlay-lib.sh`

## Runtime Macro Names

- Actions monolith:
  - `tow-actions-lib-v1`
  - fallback: `tow-actions-lib`

- Overlay monolith:
  - `tow-overlay-lib-v1`
  - fallback: `tow-overlay-lib`

- Actions runtime-decoupled:
  - `tow-actions-runtime-part-00-core-v1`
  - `tow-actions-runtime-part-10-attack-flow-v1`
  - `tow-actions-runtime-part-20-defence-flow-v1`
  - `tow-actions-runtime-part-30-api-v1`
  - `tow-actions-runtime-loader-v1`

- Overlay runtime-decoupled:
  - `tow-overlay-runtime-part-00-header-and-combat-v1`
  - `tow-overlay-runtime-part-10-layout-and-state-v1`
  - `tow-overlay-runtime-part-20-controls-v1`
  - `tow-overlay-runtime-part-30-status-and-api-v1`
  - `tow-overlay-runtime-loader-v1`
