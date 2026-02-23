# Macro Index

This folder is organized for operational use now and future module packaging.

## Combat

- `macros/combat/attack-roll.js`
  - Runs attack flow for currently selected token(s).
  - Default: auto-roll first weapon attack.
  - `Shift`: manual attack selection dialog.
- `macros/combat/defence-roll.js`
  - Runs defence flow for currently selected token(s).
  - Default: auto-roll `defence`.
  - `Shift`: manual skill selection dialog.
- `macros/combat/spell-cast.js`
  - Spell and magical action flow.

## Overlay

- `macros/overlay/overlay-toggle.js`
  - Toggles token overlays:
  - right-side `W` and `STAG` controls
  - top `RES` label
  - staggered yellow status background
  - left-side `ATK` / `DEF` actions using shared library

## Shared Library

- `macros/libs/tow-actions-lib-v1.js`
  - Registers shared runtime API at `game.towActions`.
  - Used by combat wrappers and overlay ATK/DEF controls.
  - Expected macro name in Foundry: `tow-actions-lib-v1` (or fallback `tow-actions-lib`).

## Deprecated

- `macros/deprecated/*`
  - Archived legacy scripts kept for reference.
  - Not part of current active flow.
