async function attackActor(actor, { manual = false, onFastAuto = null } = {}) {
  if (!actor) return;
  if (!shouldExecuteAttack(actor, { manual })) return;
  const attacks = getSortedWeaponAttacks(actor);
  if (attacks.length === 0) return;

  if (manual) {
    renderAttackSelector(actor, attacks, { onFastAuto });
    return;
  }
  await setupAbilityTestWithDamage(actor, attacks[0], { autoRoll: true });
}

async function defenceActor(actor, { manual = false } = {}) {
  if (!actor) return;
  const skills = getActorSkills(actor);
  const manualEntries = getManualDefenceEntries(actor);
  if (manualEntries.length === 0) {
    ui.notifications.warn(`${actor.name}: no rollable skills or characteristics found.`);
    return;
  }

  if (manual) {
    renderDefenceSelector(actor, manualEntries);
    return;
  }

  if (skills.length === 0) {
    ui.notifications.warn(`${actor.name}: no rollable skills found for default defence roll.`);
    return;
  }

  const skillToRoll = skills.includes(DEFAULT_DEFENCE_SKILL) ? DEFAULT_DEFENCE_SKILL : skills[0];
  if (skillToRoll !== DEFAULT_DEFENCE_SKILL) {
    ui.notifications.warn(`${actor.name}: '${DEFAULT_DEFENCE_SKILL}' not found, rolled '${skillToRoll}' instead.`);
  }
  await rollSkill(actor, skillToRoll, { autoRoll: true });
}

async function runAttackForControlled({ manual = false } = {}) {
  const tokens = canvas.tokens.controlled;
  if (!tokens.length) {
    ui.notifications.warn("Select at least one token.");
    return;
  }
  for (const token of tokens) {
    await attackActor(token.actor, { manual });
  }
}

async function runDefenceForControlled({ manual = false } = {}) {
  const tokens = canvas.tokens.controlled;
  if (!tokens.length) {
    ui.notifications.warn("Select at least one token.");
    return;
  }
  for (const token of tokens) {
    await defenceActor(token.actor, { manual });
  }
}

game[TOW_ACTIONS_KEY] = {
  version: TOW_ACTIONS_VERSION,
  isShiftHeld,
  escapeHtml,
  toElement,
  scheduleSoon,
  attackActor,
  defenceActor,
  runAttackForControlled,
  runDefenceForControlled
};

ui.notifications.info("TOW shared actions loaded.");
