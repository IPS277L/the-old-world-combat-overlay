async function towCombatOverlayEnsureTowActionsRuntime() {
  const api = typeof globalThis.getTowCombatOverlayPublicApi === "function"
    ? globalThis.getTowCombatOverlayPublicApi("towActions")
    : game.towActions;
  return typeof api?.attackActor === "function" &&
    typeof api?.defenceActor === "function" &&
    typeof api?.isShiftHeld === "function" &&
    typeof api?.systemAdapter === "object";
}

async function towCombatOverlayEnsureTowActions() {
  const ready = await towCombatOverlayEnsureTowActionsRuntime();
  if (!ready) ui.notifications.error("The Old World Combat Overlay module API is unavailable.");
  return ready;
}

function towCombatOverlayGetTowActionsSystemAdapter() {
  return game.towActions?.systemAdapter ?? null;
}

async function towCombatOverlayAddActorCondition(actor, condition, options = {}) {
  const adapter = towCombatOverlayGetTowActionsSystemAdapter();
  if (typeof adapter?.addCondition === "function") {
    return adapter.addCondition(actor, condition, options);
  }
  return actor?.addCondition?.(condition, options) ?? null;
}

async function towCombatOverlayRemoveActorCondition(actor, condition) {
  const adapter = towCombatOverlayGetTowActionsSystemAdapter();
  if (typeof adapter?.removeCondition === "function") {
    return adapter.removeCondition(actor, condition);
  }
  return actor?.removeCondition?.(condition) ?? null;
}

async function towCombatOverlayAddActorWound(actor, options = {}) {
  const adapter = towCombatOverlayGetTowActionsSystemAdapter();
  if (typeof adapter?.addWound === "function") {
    return adapter.addWound(actor, options);
  }
  return actor?.system?.addWound?.(options) ?? null;
}

async function towCombatOverlayApplyActorDamage(actor, damage, context = {}) {
  const adapter = towCombatOverlayGetTowActionsSystemAdapter();
  if (typeof adapter?.applyDamage === "function") {
    return adapter.applyDamage(actor, damage, context);
  }
  return actor?.system?.applyDamage?.(damage, context) ?? null;
}

globalThis.towCombatOverlayEnsureTowActionsRuntime = towCombatOverlayEnsureTowActionsRuntime;
globalThis.towCombatOverlayEnsureTowActions = towCombatOverlayEnsureTowActions;
globalThis.towCombatOverlayGetTowActionsSystemAdapter = towCombatOverlayGetTowActionsSystemAdapter;
globalThis.towCombatOverlayAddActorCondition = towCombatOverlayAddActorCondition;
globalThis.towCombatOverlayRemoveActorCondition = towCombatOverlayRemoveActorCondition;
globalThis.towCombatOverlayAddActorWound = towCombatOverlayAddActorWound;
globalThis.towCombatOverlayApplyActorDamage = towCombatOverlayApplyActorDamage;
