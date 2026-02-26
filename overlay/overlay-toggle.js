// Toggle Overlay macro entrypoint (Foundry V13)
// Thin runner that ensures shared overlay library is loaded, then toggles overlay state.

const OVERLAY_LIB_API_KEY = "towOverlay";
const OVERLAY_LIB_CANDIDATES = ["tow-overlay-lib-v1", "tow-overlay-lib"];
const OVERLAY_RUNTIME_PARTS = [
  "tow-overlay-runtime-part-00-header-and-combat-v1",
  "tow-overlay-runtime-part-10-layout-and-state-v1",
  "tow-overlay-runtime-part-20-controls-v1",
  "tow-overlay-runtime-part-30-status-and-api-v1"
];
const OVERLAY_RUNTIME_LOADER_CANDIDATES = ["tow-overlay-runtime-loader-v1"];

async function executeMacroByNameCandidates(candidates) {
  const macro = candidates
    .map((name) => game.macros.getName(name))
    .find(Boolean);
  if (!macro) return false;
  await macro.execute();
  return true;
}

async function ensureOverlayRuntimeLib() {
  if (typeof game[OVERLAY_LIB_API_KEY]?.toggle === "function") return true;

  for (const macroName of OVERLAY_RUNTIME_PARTS) {
    const macro = game.macros.getName(macroName);
    if (!macro) return false;
    await macro.execute();
  }

  const loaderExecuted = await executeMacroByNameCandidates(OVERLAY_RUNTIME_LOADER_CANDIDATES);
  if (!loaderExecuted) return false;

  return typeof game[OVERLAY_LIB_API_KEY]?.toggle === "function";
}

async function ensureOverlayLib() {
  const hasApi = typeof game[OVERLAY_LIB_API_KEY]?.toggle === "function";
  if (hasApi) return true;

  try {
    const runtimeReady = await ensureOverlayRuntimeLib();
    if (runtimeReady) return true;
  } catch (error) {
    console.error("[overlay-toggle] Failed to execute runtime overlay macros.", error);
  }

  try {
    const loaded = await executeMacroByNameCandidates(OVERLAY_LIB_CANDIDATES);
    if (!loaded) {
      const attempted = [...OVERLAY_RUNTIME_PARTS, ...OVERLAY_RUNTIME_LOADER_CANDIDATES, ...OVERLAY_LIB_CANDIDATES];
      ui.notifications.error(`Overlay library macro not found. Tried: ${attempted.join(", ")}`);
      return false;
    }
  } catch (error) {
    console.error("[overlay-toggle] Failed to execute overlay library macro.", error);
    ui.notifications.error("Failed to load overlay library macro.");
    return false;
  }

  return typeof game[OVERLAY_LIB_API_KEY]?.toggle === "function";
}

void (async () => {
  if (!(await ensureOverlayLib())) return;
  game[OVERLAY_LIB_API_KEY].toggle();
})();
