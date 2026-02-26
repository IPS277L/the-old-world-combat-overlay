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
