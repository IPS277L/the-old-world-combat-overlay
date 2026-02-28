function registerTowCombatOverlayPublicApis({
  actionsApi = null,
  overlayApi = null
} = {}) {
  const { moduleId } = getTowCombatOverlayModuleConstants();
  const moduleState = game.modules.get(moduleId);
  if (moduleState) {
    moduleState.api = {
      ...(moduleState.api ?? {}),
      ...(actionsApi ? { towActions: actionsApi } : {}),
      ...(overlayApi ? { towOverlay: overlayApi } : {})
    };
  }

  if (actionsApi) {
    game.towActions = {
      ...(game.towActions ?? {}),
      ...actionsApi
    };
  }

  if (overlayApi) {
    game.towOverlay = {
      ...(game.towOverlay ?? {}),
      ...overlayApi
    };
  }
}

function getTowCombatOverlayModuleApi() {
  const { moduleId } = getTowCombatOverlayModuleConstants();
  return game.modules.get(moduleId)?.api ?? null;
}

function getTowCombatOverlayPublicApi(apiKey) {
  const key = String(apiKey ?? "").trim();
  if (!key) return null;

  const moduleApi = getTowCombatOverlayModuleApi()?.[key] ?? null;
  if (moduleApi && typeof moduleApi === "object") return moduleApi;

  const gameApi = game[key] ?? null;
  if (gameApi && typeof gameApi === "object") return gameApi;

  return null;
}

function syncTowCombatOverlayPublicApisFromGlobals() {
  registerTowCombatOverlayPublicApis({
    actionsApi: game.towActions ?? null,
    overlayApi: game.towOverlay ?? null
  });
}

globalThis.registerTowCombatOverlayPublicApis = registerTowCombatOverlayPublicApis;
globalThis.getTowCombatOverlayPublicApi = getTowCombatOverlayPublicApi;
globalThis.syncTowCombatOverlayPublicApisFromGlobals = syncTowCombatOverlayPublicApisFromGlobals;
