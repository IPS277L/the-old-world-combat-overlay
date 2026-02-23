// Shared TOW action library (Foundry V13)
// Provides reusable attack/defence flows for other macros and overlay controls.

const TOW_ACTIONS_KEY = "towActions";
const TOW_ACTIONS_VERSION = "1.0.0";
const SHIFT_KEY = foundry.helpers.interaction.KeyboardManager.MODIFIER_KEYS.SHIFT;
const DEFAULT_DEFENCE_SKILL = "defence";
const SELF_ROLL_CONTEXT = { skipTargets: true, targets: [] };
const ATTACK_CALL_DEDUPE_MS = 700;

function isShiftHeld() {
  return game.keyboard.isModifierActive(SHIFT_KEY);
}

function shouldExecuteAttack(actor, { manual = false } = {}) {
  if (!actor) return false;

  const api = game[TOW_ACTIONS_KEY];
  if (!api) return true;
  if (!api._attackCallDeduper) api._attackCallDeduper = new Map();

  const key = `${game.user.id}:${actor.id}:${manual ? "manual" : "auto"}`;
  const now = Date.now();
  const last = Number(api._attackCallDeduper.get(key) ?? 0);
  if (now - last < ATTACK_CALL_DEDUPE_MS) return false;

  api._attackCallDeduper.set(key, now);

  if (api._attackCallDeduper.size > 200) {
    for (const [entryKey, ts] of api._attackCallDeduper.entries()) {
      if (now - Number(ts) > ATTACK_CALL_DEDUPE_MS * 3) api._attackCallDeduper.delete(entryKey);
    }
  }

  return true;
}

function toElement(appElement) {
  if (!appElement) return null;
  if (appElement instanceof HTMLElement) return appElement;
  if (appElement[0] instanceof HTMLElement) return appElement[0];
  return null;
}

function escapeHtml(value) {
  return foundry.utils.escapeHTML(String(value ?? ""));
}

function isRangedAttack(attackItem) {
  return (attackItem.system.attack.range?.max ?? 0) > 0;
}

function isWeaponAttack(item) {
  if (item.type !== "ability" || !item.system?.attack) return false;
  if (item.system?.isAttack === true) return true;
  return typeof item.system.attack.skill === "string" && item.system.attack.skill.length > 0;
}

function getSortedWeaponAttacks(actor) {
  return actor.items
    .filter(isWeaponAttack)
    .sort((a, b) => {
      const aRanged = isRangedAttack(a);
      const bRanged = isRangedAttack(b);
      if (aRanged !== bRanged) return aRanged ? 1 : -1;
      return a.name.localeCompare(b.name);
    });
}

function getAttackMeta(attack) {
  const skill = attack.system?.attack?.skill;
  const skillLabel = game.oldworld?.config?.skills?.[skill] ?? skill ?? "Attack";
  const attackType = attack.system?.isRanged || isRangedAttack(attack) ? "Ranged" : "Melee";
  const rangeConfig = game.oldworld?.config?.range ?? {};
  const meleeRangeKey = attack.system?.attack?.range?.melee;
  const minRangeKey = attack.system?.attack?.range?.min;
  const maxRangeKey = attack.system?.attack?.range?.max;
  const rangeLabel = attackType === "Ranged"
    ? `${rangeConfig[minRangeKey] ?? minRangeKey ?? 0}-${rangeConfig[maxRangeKey] ?? maxRangeKey ?? 0}`
    : `${rangeConfig[meleeRangeKey] ?? meleeRangeKey ?? 0}`;
  const damage = Number(attack.system?.damage?.value ?? 0);
  return `${attackType} | ${rangeLabel} | ${skillLabel} | DMG ${damage}`;
}

async function waitForChatMessage(messageId, timeoutMs = 3000) {
  if (!messageId) return null;

  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const message = game.messages.get(messageId);
    if (message) return message;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  return game.messages.get(messageId) ?? null;
}

async function appendDamageToMessage(message, damage) {
  if (!message) return;
  if ((message.content ?? "").includes("tow-damage-inline")) return;
  const targetCount = Number(message.system?.test?.context?.targetSpeakers?.length ?? 0);
  if (targetCount > 0) return; // Avoid retriggering opposed card creation via message update hooks.

  await message.update({
    content: `${message.content}
      <hr>
      <div class="tow-damage-inline" style="font-size: 16px">
        <strong>Damage:</strong> ${damage}
      </div>`
  });
}

function armDamageAppend(actor, ability) {
  let timeoutId = null;

  const cleanup = (hookId) => {
    Hooks.off("createChatMessage", hookId);
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  const hookId = Hooks.on("createChatMessage", async (message) => {
    const test = message?.system?.test;
    const sameActor = test?.context?.actor === actor.uuid;
    const sameItem = test?.context?.itemUuid === ability.uuid;
    if (!sameActor || !sameItem) return;

    cleanup(hookId);
    const flatDamage = test?.testData?.damage ?? ability.system.damage?.value ?? 0;
    await appendDamageToMessage(message, flatDamage);
  });

  timeoutId = setTimeout(() => cleanup(hookId), 30000);
}

function armAutoSubmitAbilityDialog(actor, ability) {
  Hooks.once("renderAbilityAttackDialog", (app) => {
    const sameActor = app?.actor?.id === actor.id;
    const sameAbility = app?.ability?.id === ability.id;
    if (!sameActor || !sameAbility) return;

    const element = toElement(app?.element);
    if (element) {
      element.style.visibility = "hidden";
      element.style.pointerEvents = "none";
    }

    setTimeout(async () => {
      if (typeof app?.submit !== "function") {
        console.error("[tow-actions-lib-v1] AbilityAttackDialog.submit() is unavailable.");
        if (element) {
          element.style.visibility = "";
          element.style.pointerEvents = "";
        }
        return;
      }
      await app.submit();
    }, 1);
  });
}

async function setupAbilityTestWithDamage(actor, ability, { autoRoll = false } = {}) {
  // Always arm chat listener first because some roll paths do not expose messageId reliably.
  armDamageAppend(actor, ability);

  let testRef;

  if (autoRoll) {
    armAutoSubmitAbilityDialog(actor, ability);
    testRef = await actor.setupAbilityTest(ability);
  } else {
    testRef = await actor.setupAbilityTest(ability);
  }

  if (!testRef) return null;

  const flatDamage = testRef.testData?.damage ?? ability.system.damage?.value ?? 0;
  const message = await waitForChatMessage(testRef.context?.messageId);
  await appendDamageToMessage(message, flatDamage);
  return testRef;
}

function renderAttackSelector(actor, attacks) {
  const buttonMarkup = attacks
    .map((attack) => {
      const itemId = escapeHtml(attack.id);
      const itemName = escapeHtml(attack.name);
      const itemMeta = escapeHtml(getAttackMeta(attack));
      return `<button type="button"
        class="attack-btn"
        data-id="${itemId}"
        style="text-align:left; padding:6px;">
        <strong>${itemName}</strong>
        <div style="font-size:12px; opacity:0.8;">${itemMeta}</div>
      </button>`;
    })
    .join("");

  const content = `<div style="display:flex; flex-direction:column; gap:6px;">${buttonMarkup}</div>`;
  const selectorDialog = new Dialog({
    title: `${actor.name} - Weapon Attacks`,
    content,
    buttons: { close: { label: "Close" } },
    render: (html) => {
      html.find(".attack-btn").on("click", async (event) => {
        const chosen = actor.items.get(event.currentTarget.dataset.id);
        if (!chosen) return;
        const fastRoll = event.shiftKey === true;

        selectorDialog.close();
        await setupAbilityTestWithDamage(actor, chosen, { autoRoll: fastRoll });
      });
    }
  });

  selectorDialog.render(true);
}

function getSkillLabel(skill) {
  return game.oldworld?.config?.skills?.[skill] ?? skill;
}

function getCharacteristicLabel(characteristic) {
  return game.oldworld?.config?.characteristics?.[characteristic]
    ?? game.oldworld?.config?.characteristicAbbrev?.[characteristic]
    ?? characteristic;
}

function getActorSkills(actor) {
  const skills = Object.keys(actor.system?.skills ?? {}).filter((skill) => {
    const skillData = actor.system?.skills?.[skill];
    return skillData && typeof skillData.value !== "undefined";
  });

  const hasDefault = skills.includes(DEFAULT_DEFENCE_SKILL);
  const ordered = skills.sort((a, b) => getSkillLabel(a).localeCompare(getSkillLabel(b)));
  if (hasDefault) return [DEFAULT_DEFENCE_SKILL, ...ordered.filter((s) => s !== DEFAULT_DEFENCE_SKILL)];
  return ordered;
}

function getActorCharacteristics(actor) {
  return Object.keys(actor.system?.characteristics ?? {}).filter((characteristic) => {
    const value = Number(actor.system?.characteristics?.[characteristic]?.value ?? NaN);
    return Number.isFinite(value);
  });
}

function getManualDefenceEntries(actor) {
  const skillEntries = getActorSkills(actor).map((skill) => ({
    type: "skill",
    id: skill,
    label: getSkillLabel(skill),
    target: Number(actor.system?.skills?.[skill]?.value ?? 0)
  }));

  const charEntries = getActorCharacteristics(actor).map((characteristic) => ({
    type: "characteristic",
    id: characteristic,
    label: getCharacteristicLabel(characteristic),
    target: Number(actor.system?.characteristics?.[characteristic]?.value ?? 0)
  }));

  const prioritizedSkills = skillEntries.sort((a, b) => {
    if (a.id === DEFAULT_DEFENCE_SKILL && b.id !== DEFAULT_DEFENCE_SKILL) return -1;
    if (a.id !== DEFAULT_DEFENCE_SKILL && b.id === DEFAULT_DEFENCE_SKILL) return 1;
    return a.label.localeCompare(b.label);
  });

  const sortedChars = charEntries.sort((a, b) => a.label.localeCompare(b.label));
  return [...prioritizedSkills, ...sortedChars];
}

function armAutoSubmitSkillDialog(actor, skill) {
  Hooks.once("renderTestDialog", (app) => {
    const sameActor = app?.actor?.id === actor.id;
    const sameSkill = app?.skill === skill;
    if (!sameActor || !sameSkill) return;

    const element = toElement(app?.element);
    if (element) {
      element.style.visibility = "hidden";
      element.style.pointerEvents = "none";
    }

    setTimeout(async () => {
      if (typeof app?.submit !== "function") {
        console.error("[tow-actions-lib-v1] TestDialog.submit() is unavailable.");
        if (element) {
          element.style.visibility = "";
          element.style.pointerEvents = "";
        }
        return;
      }

      await app.submit();
    }, 1);
  });
}

async function rollSkill(actor, skill, { autoRoll = false } = {}) {
  if (autoRoll) armAutoSubmitSkillDialog(actor, skill);
  return actor.setupSkillTest(skill, SELF_ROLL_CONTEXT);
}

async function rollCharacteristic(actor, characteristic) {
  const OldWorldTestClass = game.oldworld?.config?.rollClasses?.OldWorldTest;
  if (!OldWorldTestClass) {
    ui.notifications.error("OldWorldTest roll class is unavailable.");
    return null;
  }

  const target = Number(actor.system?.characteristics?.[characteristic]?.value ?? 0);
  if (!Number.isFinite(target) || target <= 0) {
    ui.notifications.warn(`${actor.name}: characteristic '${characteristic}' has no valid value.`);
    return null;
  }

  const data = {
    actor,
    skill: characteristic,
    characteristic,
    target,
    dice: target,
    bonus: 0,
    penalty: 0,
    glorious: 0,
    grim: 0,
    state: "normal",
    loseTies: false,
    rollMode: game.settings.get("core", "rollMode"),
    speaker: CONFIG.ChatMessage.documentClass.getSpeaker({ actor }),
    targets: [],
    context: {
      title: game.i18n.format("TOW.Test.SkillTest", { skill: getCharacteristicLabel(characteristic) }),
      appendTitle: "",
      endeavour: false,
      action: undefined,
      subAction: undefined,
      itemUuid: undefined,
      reload: undefined,
      flags: undefined,
      defending: actor.system.opposed?.id
    }
  };

  const test = OldWorldTestClass.fromData(data);
  await test.roll();
  await test.sendToChat();
  return test;
}

function renderDefenceSelector(actor, entries) {
  const renderEntryButton = (entry) => {
      const id = escapeHtml(entry.id);
      const type = escapeHtml(entry.type);
      const label = escapeHtml(entry.label);
      const value = Number(entry.target ?? 0);
      return `<button type="button"
        class="skill-btn"
        data-type="${type}"
        data-id="${id}"
        style="width:100%; box-sizing:border-box; text-align:left; padding:6px; height:34px; display:flex; align-items:center; justify-content:space-between; gap:8px;">
        <strong style="font-weight:600; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${label}</strong>
        <span style="font-size:12px; opacity:0.8; flex:0 0 auto;">T${value}</span>
      </button>`;
  };

  const characteristicEntries = entries.filter((entry) => entry.type === "characteristic");
  const skillEntries = entries.filter((entry) => entry.type === "skill");

  const characteristicMarkup = characteristicEntries.map(renderEntryButton).join("");
  const skillMarkup = skillEntries.map(renderEntryButton).join("");

  const content = `<div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; max-height:470px;">
    <div style="display:flex; flex-direction:column; min-width:0; border:1px solid #b9b6aa; border-radius:4px; overflow:hidden;">
      <div style="padding:4px 6px; font-size:12px; font-weight:700; background:#d9d5c7;">Characteristics</div>
      <div style="display:flex; flex-direction:column; gap:4px; padding:6px; overflow-y:auto; overflow-x:hidden; max-height:430px; scrollbar-gutter:stable;">
        ${characteristicMarkup || '<div style="font-size:12px; opacity:0.7;">No characteristics</div>'}
      </div>
    </div>
    <div style="display:flex; flex-direction:column; min-width:0; border:1px solid #b9b6aa; border-radius:4px; overflow:hidden;">
      <div style="padding:4px 6px; font-size:12px; font-weight:700; background:#d9d5c7;">Skills</div>
      <div style="display:flex; flex-direction:column; gap:4px; padding:6px; overflow-y:auto; overflow-x:hidden; max-height:430px; scrollbar-gutter:stable;">
        ${skillMarkup || '<div style="font-size:12px; opacity:0.7;">No skills</div>'}
      </div>
    </div>
  </div>`;

  const selectorDialog = new Dialog({
    title: `${actor.name} - Defence Roll`,
    content,
    width: 560,
    height: 560,
    buttons: { close: { label: "Close" } },
    render: (html) => {
      html.find(".skill-btn").on("click", async (event) => {
        const id = event.currentTarget.dataset.id;
        const type = event.currentTarget.dataset.type;
        if (!id || !type) return;
        const fastRoll = event.shiftKey === true;
        selectorDialog.close();

        if (type === "characteristic") {
          await rollCharacteristic(actor, id);
          return;
        }
        await rollSkill(actor, id, { autoRoll: fastRoll });
      });
    }
  });

  selectorDialog.render(true);
}

async function attackActor(actor, { manual = false } = {}) {
  if (!actor) return;
  if (!shouldExecuteAttack(actor, { manual })) return;
  const attacks = getSortedWeaponAttacks(actor);
  if (attacks.length === 0) return;

  if (manual) {
    renderAttackSelector(actor, attacks);
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
  attackActor,
  defenceActor,
  runAttackForControlled,
  runDefenceForControlled
};

ui.notifications.info("TOW shared actions loaded.");
