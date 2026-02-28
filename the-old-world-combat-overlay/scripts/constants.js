function getTowCombatOverlayModuleConstants() {
  const state = globalThis.towCombatOverlayModule ?? (globalThis.towCombatOverlayModule = {});
  if (!state.constants) {
    state.constants = Object.freeze({
      moduleId: "the-old-world-combat-overlay",
      moduleName: "The Old World Combat Overlay",
      settings: Object.freeze({
        enableOverlay: "enableOverlay",
        enableAutoDefence: "enableAutoDefence",
        enableAutoApplyDamage: "enableAutoApplyDamage",
        enableStaggerChoiceAutomation: "enableStaggerChoiceAutomation",
        enableDialogAutoSubmit: "enableDialogAutoSubmit"
      })
    });
  }

  return state.constants;
}
