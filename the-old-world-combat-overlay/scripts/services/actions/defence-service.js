function towCombatOverlayGetSkillLabel(skill) {
  return game.oldworld?.config?.skills?.[skill] ?? skill;
}

function towCombatOverlayGetCharacteristicLabel(characteristic) {
  return game.oldworld?.config?.characteristics?.[characteristic]
    ?? game.oldworld?.config?.characteristicAbbrev?.[characteristic]
    ?? characteristic;
}

function towCombatOverlayGetActorSkills(actor) {
  const skills = Object.keys(actor.system?.skills ?? {}).filter((skill) => {
    const skillData = actor.system?.skills?.[skill];
    return skillData && typeof skillData.value !== "undefined";
  });

  return skills.sort((a, b) => a.localeCompare(b));
}

function towCombatOverlayGetActorCharacteristics(actor) {
  return Object.keys(actor.system?.characteristics ?? {}).filter((characteristic) => {
    const value = Number(actor.system?.characteristics?.[characteristic]?.value ?? NaN);
    return Number.isFinite(value);
  });
}

function towCombatOverlayGetManualDefenceEntries(actor) {
  const skillEntries = towCombatOverlayGetActorSkills(actor).map((skill) => ({
    type: "skill",
    id: skill,
    label: towCombatOverlayGetSkillLabel(skill),
    target: Number(actor.system?.skills?.[skill]?.value ?? 0)
  }));

  const charEntries = towCombatOverlayGetActorCharacteristics(actor).map((characteristic) => ({
    type: "characteristic",
    id: characteristic,
    label: towCombatOverlayGetCharacteristicLabel(characteristic),
    target: Number(actor.system?.characteristics?.[characteristic]?.value ?? 0)
  }));

  return [...skillEntries, ...charEntries];
}

function towCombatOverlayArmAutoSubmitSkillDialog(actor, skill) {
  const submitDialog = globalThis.towCombatOverlayArmAutoSubmitDialog;
  if (typeof submitDialog !== "function") return;

  submitDialog({
    hookName: "renderTestDialog",
    matches: (app) => app?.actor?.id === actor.id && app?.skill === skill,
    submitErrorMessage: "TestDialog.submit() is unavailable."
  });
}

async function towCombatOverlayRollSkill(actor, skill, { autoRoll = false } = {}) {
  if (autoRoll) towCombatOverlayArmAutoSubmitSkillDialog(actor, skill);
  return towCombatOverlaySystemAdapter.setupSkillTest(actor, skill, SELF_ROLL_CONTEXT);
}

async function towCombatOverlayRollCharacteristic(actor, characteristic) {
  const OldWorldTestClass = towCombatOverlaySystemAdapter.getOldWorldTestClass();
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
      title: game.i18n.format("TOW.Test.SkillTest", { skill: towCombatOverlayGetCharacteristicLabel(characteristic) }),
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

function towCombatOverlayRenderDefenceSelector(actor, entries) {
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
          await towCombatOverlayRollCharacteristic(actor, id);
          return;
        }
        await towCombatOverlayRollSkill(actor, id, { autoRoll: fastRoll });
      });
    }
  });

  selectorDialog.render(true);
}

async function towCombatOverlayDefenceActor(actor, { manual = false } = {}) {
  if (!actor) return;
  const skills = towCombatOverlayGetActorSkills(actor);
  const manualEntries = towCombatOverlayGetManualDefenceEntries(actor);
  if (manualEntries.length === 0) {
    ui.notifications.warn(`${actor.name}: no rollable skills or characteristics found.`);
    return;
  }

  if (manual) {
    towCombatOverlayRenderDefenceSelector(actor, manualEntries);
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
  await towCombatOverlayRollSkill(actor, skillToRoll, { autoRoll: true });
}

async function towCombatOverlayRunDefenceForControlled({ manual = false } = {}) {
  const tokens = canvas.tokens.controlled;
  if (!tokens.length) {
    ui.notifications.warn("Select at least one token.");
    return;
  }
  for (const token of tokens) {
    await towCombatOverlayDefenceActor(token.actor, { manual });
  }
}

globalThis.towCombatOverlayGetActorSkills = towCombatOverlayGetActorSkills;
globalThis.towCombatOverlayGetManualDefenceEntries = towCombatOverlayGetManualDefenceEntries;
globalThis.towCombatOverlayRollSkill = towCombatOverlayRollSkill;
globalThis.towCombatOverlayRenderDefenceSelector = towCombatOverlayRenderDefenceSelector;
globalThis.towCombatOverlayDefenceActor = towCombatOverlayDefenceActor;
globalThis.towCombatOverlayRunDefenceForControlled = towCombatOverlayRunDefenceForControlled;
