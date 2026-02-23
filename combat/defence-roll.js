const LIB_MACRO_CANDIDATES = ["tow-actions-lib-v1", "tow-actions-lib"];

async function ensureTowActions() {
  const hasApi = typeof game.towActions?.runDefenceForControlled === "function" &&
    typeof game.towActions?.isShiftHeld === "function";
  if (hasApi) return true;

  const libMacro = LIB_MACRO_CANDIDATES
    .map((name) => game.macros.getName(name))
    .find(Boolean);
  if (!libMacro) {
    ui.notifications.error(`Shared actions macro not found. Tried: ${LIB_MACRO_CANDIDATES.join(", ")}`);
    return false;
  }

  try {
    await libMacro.execute();
  } catch (error) {
    console.error("[defence-roll] Failed to execute shared actions macro.", error);
    ui.notifications.error("Failed to load shared actions macro.");
    return false;
  }

  const loaded = typeof game.towActions?.runDefenceForControlled === "function" &&
    typeof game.towActions?.isShiftHeld === "function";
  if (!loaded) {
    ui.notifications.error("Shared actions loaded, but defence API is unavailable.");
  }
  return loaded;
}

const loaded = await ensureTowActions();
if (!loaded) return;

await game.towActions.runDefenceForControlled({ manual: game.towActions.isShiftHeld() });
