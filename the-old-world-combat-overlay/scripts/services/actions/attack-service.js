function towCombatOverlayArmDamageAppend(actor, ability) {
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

function towCombatOverlayArmAutoSubmitDialog({ hookName, matches, submitErrorMessage }) {
  if (typeof globalThis.shouldTowCombatOverlayAutoSubmitDialogs === "function"
    && !globalThis.shouldTowCombatOverlayAutoSubmitDialogs()) {
    return;
  }

  Hooks.once(hookName, (app) => {
    if (!matches(app)) return;

    const element = toElement(app?.element);
    if (element) {
      element.style.visibility = "hidden";
      element.style.pointerEvents = "none";
    }

    scheduleSoon(async () => {
      if (typeof app?.submit !== "function") {
        console.error(`[the-old-world-combat-overlay] ${submitErrorMessage}`);
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

function towCombatOverlayArmAutoSubmitAbilityDialog(actor, ability) {
  towCombatOverlayArmAutoSubmitDialog({
    hookName: "renderAbilityAttackDialog",
    matches: (app) => app?.actor?.id === actor.id && app?.ability?.id === ability.id,
    submitErrorMessage: "AbilityAttackDialog.submit() is unavailable."
  });
}

async function towCombatOverlaySetupAbilityTestWithDamage(actor, ability, { autoRoll = false } = {}) {
  towCombatOverlayArmDamageAppend(actor, ability);

  let testRef;

  if (autoRoll) {
    towCombatOverlayArmAutoSubmitAbilityDialog(actor, ability);
    testRef = await towCombatOverlaySystemAdapter.setupAbilityTest(actor, ability);
  } else {
    testRef = await towCombatOverlaySystemAdapter.setupAbilityTest(actor, ability);
  }

  if (!testRef) return null;

  const flatDamage = testRef.testData?.damage ?? ability.system.damage?.value ?? 0;
  const message = await waitForChatMessage(testRef.context?.messageId);
  await renderDamageDisplay(message, { damage: flatDamage });
  return testRef;
}

function towCombatOverlayRenderAttackSelector(actor, attacks, { onFastAuto } = {}) {
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
            console.error("[the-old-world-combat-overlay] onFastAuto callback failed.", error);
          }
        }

        await towCombatOverlaySetupAbilityTestWithDamage(actor, chosen, { autoRoll: fastRoll });
      });
    }
  });

  selectorDialog.render(true);
}

async function towCombatOverlayAttackActor(actor, { manual = false, onFastAuto = null } = {}) {
  if (!actor) return;
  if (!shouldExecuteAttack(actor, { manual })) return;
  const attacks = getSortedWeaponAttacks(actor);
  if (attacks.length === 0) return;

  if (manual) {
    towCombatOverlayRenderAttackSelector(actor, attacks, { onFastAuto });
    return;
  }
  await towCombatOverlaySetupAbilityTestWithDamage(actor, attacks[0], { autoRoll: true });
}

async function towCombatOverlayRunAttackForControlled({ manual = false } = {}) {
  const tokens = canvas.tokens.controlled;
  if (!tokens.length) {
    ui.notifications.warn("Select at least one token.");
    return;
  }
  for (const token of tokens) {
    await towCombatOverlayAttackActor(token.actor, { manual });
  }
}

globalThis.towCombatOverlayArmAutoSubmitDialog = towCombatOverlayArmAutoSubmitDialog;
globalThis.towCombatOverlaySetupAbilityTestWithDamage = towCombatOverlaySetupAbilityTestWithDamage;
globalThis.towCombatOverlayRenderAttackSelector = towCombatOverlayRenderAttackSelector;
globalThis.towCombatOverlayAttackActor = towCombatOverlayAttackActor;
globalThis.towCombatOverlayRunAttackForControlled = towCombatOverlayRunAttackForControlled;
