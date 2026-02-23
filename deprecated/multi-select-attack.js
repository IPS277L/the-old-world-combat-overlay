const tokens = canvas.tokens.controlled;
if (!tokens.length) {
  return ui.notifications.warn("Select at least one token.");
}

const SHIFT_KEY = foundry.helpers.interaction.KeyboardManager.MODIFIER_KEYS.SHIFT;
const shiftHeld = game.keyboard.isModifierActive(SHIFT_KEY);

function isRangedAttack(attackItem) {
  return (attackItem.system.attack.range?.max ?? 0) > 0;
}

function isWeaponAttack(attackItem) {
  if (attackItem.type !== "ability" || !attackItem.system?.attack) {
    return false;
  }

  const attack = attackItem.system.attack;
  return (
    attack.grip !== "" ||
    (attack.range?.max ?? 0) > 0 ||
    (attack.range?.melee ?? 0) > 0
  );
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

function escapeHtml(value) {
  return foundry.utils.escapeHTML(String(value ?? ""));
}

function toElement(appElement) {
  if (!appElement) return null;
  if (appElement instanceof HTMLElement) return appElement;
  if (appElement[0] instanceof HTMLElement) return appElement[0];
  return null;
}

async function appendDamageToMessage(message, damage) {
  await message.update({
    content: `${message.content}
      <hr>
      <div class="tow-damage-inline" style="font-size: 16px">
        <strong>Damage:</strong> ${damage}
      </div>`
  });
}

function armAutoRollDialogHook() {
  Hooks.once("renderAbilityAttackDialog", (app) => {
    const element = toElement(app?.element);
    if (!element) return;

    element.style.opacity = "0";
    element.style.pointerEvents = "none";

    setTimeout(() => {
      const rollButton =
        element.querySelector("button.default") ||
        element.querySelector("button[type='submit']");
      if (rollButton) rollButton.click();
    }, 1);
  });
}

async function setupAbilityTestWithDamage(actor, ability, { autoRoll = false } = {}) {
  let testRef = null;
  let timeoutId = null;

  const cleanup = (hookId) => {
    Hooks.off("createChatMessage", hookId);
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  const hookId = Hooks.on("createChatMessage", async (message) => {
    const messageId = testRef?.context?.messageId;
    if (!messageId || message.id !== messageId) return;

    cleanup(hookId);
    const flatDamage = testRef?.testData?.damage ?? 0;
    await appendDamageToMessage(message, flatDamage);
  });

  // Avoid leaving a stale global hook if no roll message is ever produced.
  timeoutId = setTimeout(() => cleanup(hookId), 30000);

  try {
    if (autoRoll) armAutoRollDialogHook();
    testRef = await actor.setupAbilityTest(ability);
  } catch (error) {
    cleanup(hookId);
    throw error;
  }

  return testRef;
}

function renderAttackSelector(actor, attacks) {
  const buttonMarkup = attacks
    .map((attack) => {
      const itemId = escapeHtml(attack.id);
      const itemName = escapeHtml(attack.name);
      return `<button type="button"
        class="attack-btn"
        data-id="${itemId}"
        style="text-align:left; padding:6px;">
        <strong>${itemName}</strong>
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

        selectorDialog.close();
        await setupAbilityTestWithDamage(actor, chosen);
      });
    }
  });

  selectorDialog.render(true);
}

for (const token of tokens) {
  const actor = token.actor;
  if (!actor) continue;

  const attacks = getSortedWeaponAttacks(actor);
  if (!attacks.length) continue;

  if (shiftHeld) {
    await setupAbilityTestWithDamage(actor, attacks[0], { autoRoll: true });
    continue;
  }

  renderAttackSelector(actor, attacks);
}
