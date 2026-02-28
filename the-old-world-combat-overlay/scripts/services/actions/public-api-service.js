function createTowActionsApi(overrides = {}) {
  return {
    version: TOW_ACTIONS_VERSION,
    isShiftHeld,
    escapeHtml,
    toElement,
    scheduleSoon,
    systemAdapter: towCombatOverlaySystemAdapter,
    ...overrides
  };
}

function registerTowActionsApi(apiOverrides = {}) {
  const existingApi = game[TOW_ACTIONS_KEY] ?? {};
  const nextApi = createTowActionsApi(apiOverrides);
  game[TOW_ACTIONS_KEY] = {
    ...existingApi,
    ...nextApi
  };

  if (typeof globalThis.registerTowCombatOverlayPublicApis === "function") {
    globalThis.registerTowCombatOverlayPublicApis({
      actionsApi: game[TOW_ACTIONS_KEY]
    });
  }

  return game[TOW_ACTIONS_KEY];
}

const towCombatOverlayActionServices = getTowCombatOverlayActionServices();

registerTowActionsApi({
  attackActor: towCombatOverlayActionServices.attackActor,
  castActor: towCombatOverlayActionServices.castActor,
  defenceActor: towCombatOverlayActionServices.defenceActor,
  runAttackForControlled: towCombatOverlayActionServices.runAttackForControlled,
  runCastingForControlled: towCombatOverlayActionServices.runCastingForControlled,
  runDefenceForControlled: towCombatOverlayActionServices.runDefenceForControlled
});
