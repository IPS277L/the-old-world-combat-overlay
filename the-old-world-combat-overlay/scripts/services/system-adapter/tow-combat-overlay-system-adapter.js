function createTowCombatOverlaySystemAdapter() {
  return {
    setupAbilityTest(actor, ability) {
      if (!actor || typeof actor.setupAbilityTest !== "function") {
        ui.notifications.error("Ability test API is unavailable for this actor.");
        return null;
      }
      return actor.setupAbilityTest(ability);
    },

    setupSkillTest(actor, skill, context = {}) {
      if (!actor || typeof actor.setupSkillTest !== "function") {
        ui.notifications.error("Skill test API is unavailable for this actor.");
        return null;
      }
      return actor.setupSkillTest(skill, context);
    },

    setupCastingTest(actor, data, context = {}) {
      if (!actor || typeof actor.setupCastingTest !== "function") {
        ui.notifications.error("Casting test API is unavailable for this actor.");
        return null;
      }
      return actor.setupCastingTest(data, context);
    },

    getOldWorldTestClass() {
      return game.oldworld?.config?.rollClasses?.OldWorldTest ?? null;
    },

    addCondition(actor, condition, options = {}) {
      if (!actor || typeof actor.addCondition !== "function") {
        ui.notifications.error("Condition add API is unavailable for this actor.");
        return null;
      }
      return actor.addCondition(condition, options);
    },

    removeCondition(actor, condition) {
      if (!actor || typeof actor.removeCondition !== "function") {
        ui.notifications.error("Condition remove API is unavailable for this actor.");
        return null;
      }
      return actor.removeCondition(condition);
    },

    applyDamage(actor, damage, context = {}) {
      if (!actor?.system || typeof actor.system.applyDamage !== "function") {
        ui.notifications.error("Damage application API is unavailable for this actor.");
        return null;
      }
      return actor.system.applyDamage(damage, context);
    },

    addWound(actor, options = {}) {
      if (!actor?.system || typeof actor.system.addWound !== "function") {
        ui.notifications.error("Wound API is unavailable for this actor.");
        return null;
      }
      return actor.system.addWound(options);
    },

    promptStaggeredChoice(actor, options = {}) {
      if (!actor?.system || typeof actor.system.promptStaggeredChoice !== "function") {
        ui.notifications.error("Stagger choice API is unavailable for this actor.");
        return null;
      }
      return actor.system.promptStaggeredChoice(options);
    }
  };
}

function getTowCombatOverlaySystemAdapter() {
  const state = globalThis.towCombatOverlayModule ?? (globalThis.towCombatOverlayModule = {});
  if (!state.systemAdapter) {
    state.systemAdapter = createTowCombatOverlaySystemAdapter();
  }
  return state.systemAdapter;
}

globalThis.getTowCombatOverlaySystemAdapter = getTowCombatOverlaySystemAdapter;
