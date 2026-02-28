function registerTowCombatOverlayActionServices(overrides = {}) {
  const state = globalThis.towCombatOverlayModule ?? (globalThis.towCombatOverlayModule = {});
  const existingServices = state.actionServices ?? {};

  state.actionServices = {
    ...existingServices,
    attackActor: globalThis.towCombatOverlayAttackActor,
    defenceActor: globalThis.towCombatOverlayDefenceActor,
    castActor: globalThis.towCombatOverlayCastActor,
    runAttackForControlled: globalThis.towCombatOverlayRunAttackForControlled,
    runDefenceForControlled: globalThis.towCombatOverlayRunDefenceForControlled,
    runCastingForControlled: globalThis.towCombatOverlayRunCastingForControlled,
    ...overrides
  };

  return state.actionServices;
}

function getTowCombatOverlayActionServices() {
  const state = globalThis.towCombatOverlayModule ?? (globalThis.towCombatOverlayModule = {});
  return state.actionServices ?? registerTowCombatOverlayActionServices();
}

globalThis.registerTowCombatOverlayActionServices = registerTowCombatOverlayActionServices;
globalThis.getTowCombatOverlayActionServices = getTowCombatOverlayActionServices;
