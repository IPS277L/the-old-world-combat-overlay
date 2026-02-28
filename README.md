# The Old World Combat Overlay

FoundryVTT module for combat overlay and automation helpers for Warhammer: The Old World Roleplaying Game.

## Layout

- `the-old-world-combat-overlay/`
  - Release/package root for FoundryVTT.
  - `module.json`
  - `scripts/`
  - `styles/`
  - `templates/`
  - `packs/`
  - `lang/`

- `oldworld-foundryvtt/`
  - Git submodule for the WHTOW system reference used by this module.

- `docs/`
  - Local project notes and migration records.

## Runtime

- Public APIs:
  - `game.towActions`
  - `game.towOverlay`

- Module API:
  - `game.modules.get("the-old-world-combat-overlay")?.api`

## Notes

- Legacy macro source, generated macro bundles, and macro build tooling have been removed.
- Repo-only files such as `.gitignore`, `.gitmodules`, docs, and the system submodule remain outside the release/package root.
- The package manifest at `the-old-world-combat-overlay/module.json` is the only supported runtime entrypoint.
