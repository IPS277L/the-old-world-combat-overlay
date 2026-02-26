// Shared TOW action library (Foundry V13)
// Provides reusable attack/defence flows for other macros and overlay controls.

const TOW_ACTIONS_KEY = "towActions";
const TOW_ACTIONS_VERSION = "1.0.0";
const SHIFT_KEY = foundry.helpers.interaction.KeyboardManager.MODIFIER_KEYS.SHIFT;
const DEFAULT_DEFENCE_SKILL = "defence";
const SELF_ROLL_CONTEXT = { skipTargets: true, targets: [] };
const ATTACK_CALL_DEDUPE_MS = 700;
const DAMAGE_RENDER_DEDUPE_MS = 120000;

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

function scheduleSoon(callback) {
  if (typeof window?.requestAnimationFrame === "function") {
    window.requestAnimationFrame(() => {
      void callback();
    });
    return;
  }
  Promise.resolve().then(() => {
    void callback();
  });
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

function renderSelectorRowButton({
  rowClass,
  dataAttrs = "",
  label,
  valueLabel = "",
  subLabel = "",
  highlighted = false,
  compact = false
} = {}) {
  const safeLabel = escapeHtml(label);
  const safeValue = escapeHtml(valueLabel);
  const safeSubLabel = escapeHtml(subLabel);

  const labelColor = highlighted ? "#2c2412" : "#111111";
  const subLabelColor = highlighted ? "#4d4121" : "#5f5b4b";
  const buttonBackground = highlighted ? "#e8ddbe" : "#f2f1e8";
  const buttonBorder = highlighted ? "#8f7c43" : "#bdb9ab";
  const buttonShadow = highlighted ? "inset 0 0 0 1px rgba(255,255,255,0.35)" : "none";
  const accentColor = highlighted ? "#6a5623" : "transparent";
  const accent = `<span style="width:4px; align-self:stretch; border-radius:2px; background:${accentColor}; flex:0 0 auto;"></span>`;

  const hasSubLabel = safeSubLabel.length > 0;
  const subtitleMarkup = hasSubLabel
    ? `<span style="font-size:11px; line-height:1.2; color:${subLabelColor}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${safeSubLabel}</span>`
    : "";

  const valueMarkup = safeValue
    ? `<span style="font-size:12px; opacity:0.85; flex:0 0 auto; color:#2f2a1f;">${safeValue}</span>`
    : "";

  const compactHeight = compact ? "34px" : "";
  const minHeight = compact ? "34px" : "52px";
  const padding = compact ? "5px 6px" : "6px";

  return `<button type="button"
    class="${rowClass}"
    ${dataAttrs}
    style="width:100%; box-sizing:border-box; text-align:left; padding:${padding}; min-height:${minHeight}; ${compactHeight ? `height:${compactHeight};` : ""} display:flex; align-items:center; justify-content:space-between; gap:8px; background:${buttonBackground}; border:1px solid ${buttonBorder}; box-shadow:${buttonShadow}; border-radius:3px;">
    <span style="display:flex; align-items:center; gap:7px; min-width:0; flex:1;">
      ${accent}
      <span style="display:flex; flex-direction:column; justify-content:center; min-width:0; gap:1px;">
        <span style="font-weight:400; color:${labelColor}; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${safeLabel}</span>
        ${subtitleMarkup}
      </span>
    </span>
    ${valueMarkup}
  </button>`;
}

async function waitForChatMessage(messageId, timeoutMs = 3000) {
  if (!messageId) return null;
  const existing = game.messages.get(messageId);
  if (existing) return existing;

  return new Promise((resolve) => {
    let settled = false;
    let timeoutId = null;
    let hookId = null;

    const finish = () => {
      if (settled) return;
      settled = true;
      if (hookId) Hooks.off("createChatMessage", hookId);
      if (timeoutId) clearTimeout(timeoutId);
      resolve(game.messages.get(messageId) ?? null);
    };

    hookId = Hooks.on("createChatMessage", (message) => {
      if (message?.id !== messageId) return;
      finish();
    });

    timeoutId = setTimeout(finish, timeoutMs);
  });
}

function getDamageRenderState() {
  const api = game[TOW_ACTIONS_KEY];
  if (!api) return null;
  if (!api._damageRenderDeduper) api._damageRenderDeduper = new Map();
  return api._damageRenderDeduper;
}

function markDamageRender(dedupe, key) {
  if (!dedupe || !key) return false;
  const now = Date.now();
  const last = Number(dedupe.get(key) ?? 0);
  if (now - last < DAMAGE_RENDER_DEDUPE_MS) return false;
  dedupe.set(key, now);

  if (dedupe.size > 250) {
    for (const [entryKey, ts] of dedupe.entries()) {
      if (now - Number(ts) > DAMAGE_RENDER_DEDUPE_MS * 2) dedupe.delete(entryKey);
    }
  }
  return true;
}

async function postSeparateDamageMessage(message, damage) {
  if (!message) return;
  const targetCount = Number(message.system?.test?.context?.targetSpeakers?.length ?? 0);
  if (targetCount > 0) return; // Do not interfere with opposed creation/update flows.

  const dedupe = getDamageRenderState();
  const dedupeKey = `separate:${message.id}`;
  if (!markDamageRender(dedupe, dedupeKey)) return;

  const content = `<div style="
      border-top: 1px solid rgba(130,110,80,0.45);
      border-bottom: 1px solid rgba(130,110,80,0.45);
      margin: 4px 0;
      padding: 6px 8px;
      text-align: center;
      font-size: var(--font-size-16);
      letter-spacing: 0.04em;
      opacity: 0.9;">
      <strong>Damage:</strong> ${Number(damage ?? 0)}
    </div>`;

  await ChatMessage.create({
    content,
    speaker: message.speaker ?? {}
  });
}

async function renderDamageDisplay(message, { damage }) {
  if (!message) return;
  await postSeparateDamageMessage(message, damage);
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
    await renderDamageDisplay(message, { damage: flatDamage });
  });

  timeoutId = setTimeout(() => cleanup(hookId), 30000);
}

function armAutoSubmitDialog({ hookName, matches, submitErrorMessage }) {
  Hooks.once(hookName, (app) => {
    if (!matches(app)) return;

    const element = toElement(app?.element);
    if (element) {
      element.style.visibility = "hidden";
      element.style.pointerEvents = "none";
    }

    scheduleSoon(async () => {
      if (typeof app?.submit !== "function") {
        console.error(`[tow-actions-lib-v1] ${submitErrorMessage}`);
        if (element) {
          element.style.visibility = "";
          element.style.pointerEvents = "";
        }
        return;
      }
      await app.submit();
    });
  });
}

function armAutoSubmitAbilityDialog(actor, ability) {
  armAutoSubmitDialog({
    hookName: "renderAbilityAttackDialog",
    matches: (app) => app?.actor?.id === actor.id && app?.ability?.id === ability.id,
    submitErrorMessage: "AbilityAttackDialog.submit() is unavailable."
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
  await renderDamageDisplay(message, { damage: flatDamage });
  return testRef;
}

function renderAttackSelector(actor, attacks, { onFastAuto } = {}) {
  const buttonMarkup = attacks
    .map((attack, index) => {
      const itemId = escapeHtml(attack.id);
      return renderSelectorRowButton({
        rowClass: "attack-btn",
        dataAttrs: `data-id="${itemId}"`,
        label: attack.name,
        subLabel: getAttackMeta(attack),
        valueLabel: "",
        highlighted: index === 0,
        compact: false
      });
    })
    .join("");

  const content = `<div style="display:flex; flex-direction:column; min-width:0; border:1px solid #b9b6aa; border-radius:4px; overflow:hidden;">
    <div style="padding:4px 6px; font-size:12px; font-weight:700; background:#d9d5c7;">Attacks</div>
    <div style="display:flex; flex-direction:column; gap:4px; padding:6px; overflow-y:auto; overflow-x:hidden; max-height:430px; scrollbar-gutter:stable;">
      ${buttonMarkup || '<div style="font-size:12px; opacity:0.7;">No attacks</div>'}
    </div>
  </div>`;
  const selectorDialog = new Dialog({
    title: `${actor.name} - Weapon Attacks`,
    content,
    width: 560,
    height: 560,
    buttons: { close: { label: "Close" } },
    render: (html) => {
      html.find(".attack-btn").on("click", async (event) => {
        const chosen = actor.items.get(event.currentTarget.dataset.id);
        if (!chosen) return;
        const fastRoll = event.shiftKey === true;

        selectorDialog.close();
        if (fastRoll && typeof onFastAuto === "function") {
          try {
            await onFastAuto({ actor, ability: chosen });
          } catch (error) {
            console.error("[tow-actions-lib-v1] onFastAuto callback failed.", error);
          }
        }

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

  // Match NPC token-sheet ordering (alpha by skill key).
  return skills.sort((a, b) => a.localeCompare(b));
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

  // Keep characteristics in native schema order to match sheet columns.
  return [...skillEntries, ...charEntries];
}

function armAutoSubmitSkillDialog(actor, skill) {
  armAutoSubmitDialog({
    hookName: "renderTestDialog",
    matches: (app) => app?.actor?.id === actor.id && app?.skill === skill,
    submitErrorMessage: "TestDialog.submit() is unavailable."
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
  const emphasizedSkills = new Set(["defence", "athletics", "endurance"]);
  const renderEntryButton = (entry) => {
      const id = escapeHtml(entry.id);
      const type = escapeHtml(entry.type);
      const value = Number(entry.target ?? 0);
      const shouldEmphasize = entry.type === "skill" && emphasizedSkills.has(String(entry.id).toLowerCase());
      return renderSelectorRowButton({
        rowClass: "skill-btn",
        dataAttrs: `data-type="${type}" data-id="${id}"`,
        label: entry.label,
        valueLabel: `T${value}`,
        highlighted: shouldEmphasize,
        compact: true
      });
  };

  const characteristicEntries = entries.filter((entry) => entry.type === "characteristic");
  const skillEntries = entries.filter((entry) => entry.type === "skill");

  const characteristicMarkup = characteristicEntries.map(renderEntryButton).join("");
  const skillMarkup = skillEntries.map(renderEntryButton).join("");

  const content = `<div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; align-items:start;">
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

