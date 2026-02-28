function getTowCombatOverlayApiFromModuleOrGame() {
  const { moduleId } = getTowCombatOverlayModuleConstants();
  return game.modules.get(moduleId)?.api?.towOverlay ?? game.towOverlay ?? null;
}

function syncTowCombatOverlayEnabledSetting() {
  const { settings } = getTowCombatOverlayModuleConstants();
  const overlayApi = getTowCombatOverlayApiFromModuleOrGame();
  if (!overlayApi) return false;

  const wantsEnabled = isTowCombatOverlaySettingEnabled(settings.enableOverlay, true);
  const isEnabled = typeof overlayApi.isEnabled === "function"
    ? !!overlayApi.isEnabled()
    : !!game.towOverlay;

  if (wantsEnabled && !isEnabled && typeof overlayApi.enable === "function") {
    overlayApi.enable();
    return true;
  }

  if (!wantsEnabled && isEnabled && typeof overlayApi.disable === "function") {
    overlayApi.disable();
    return true;
  }

  return false;
}

function registerTowCombatOverlayModuleHooks() {
  Hooks.once("init", () => {
    registerTowCombatOverlaySettings();
  });

  Hooks.once("ready", () => {
    if (typeof globalThis.syncTowCombatOverlayPublicApisFromGlobals === "function") {
      globalThis.syncTowCombatOverlayPublicApisFromGlobals();
    }
    syncTowCombatOverlayEnabledSetting();
  });
}

globalThis.syncTowCombatOverlayEnabledSetting = syncTowCombatOverlayEnabledSetting;
