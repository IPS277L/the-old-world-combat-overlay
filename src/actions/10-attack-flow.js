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

    setTimeout(async () => {
      if (typeof app?.submit !== "function") {
        console.error(`[tow-actions-lib-v1] ${submitErrorMessage}`);
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

function renderAttackSelector(actor, attacks) {
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
        await setupAbilityTestWithDamage(actor, chosen, { autoRoll: fastRoll });
      });
    }
  });

  selectorDialog.render(true);
}

