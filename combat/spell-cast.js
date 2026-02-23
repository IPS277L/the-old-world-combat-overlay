// TODO: Read the book and validate spell casting flow

const tokens = canvas.tokens.controlled;
if (!tokens.length) {
  return ui.notifications.warn("Select at least one token.");
}

const SHIFT_KEY = foundry.helpers.interaction.KeyboardManager.MODIFIER_KEYS.SHIFT;
const shiftHeld = game.keyboard.isModifierActive(SHIFT_KEY);

// Common flow is auto-roll. Holding Shift switches to manual selection.
const rollPath = shiftHeld ? "manual" : "auto";
const SELF_ROLL_CONTEXT = { skipTargets: true, targets: [] };

function escapeHtml(value) {
  return foundry.utils.escapeHTML(String(value ?? ""));
}

function toElement(appElement) {
  if (!appElement) return null;
  if (appElement instanceof HTMLElement) return appElement;
  if (appElement[0] instanceof HTMLElement) return appElement[0];
  return null;
}

function hasText(value) {
  return typeof value === "string" && value.length > 0;
}

function isCastableSpell(item) {
  if (item?.type !== "spell") return false;
  const lore = item.system?.lore;
  return hasText(lore) && lore !== "none";
}

function getLoreLabel(spell) {
  const lore = spell.system?.lore;
  return game.oldworld?.config?.magicLore?.[lore] ?? lore ?? "";
}

function getSortedSpells(actor) {
  return actor.items
    .filter(isCastableSpell)
    .sort((a, b) => {
      const loreCmp = getLoreLabel(a).localeCompare(getLoreLabel(b));
      if (loreCmp !== 0) return loreCmp;

      const cvA = Number(a.system?.cv ?? 0);
      const cvB = Number(b.system?.cv ?? 0);
      if (cvA !== cvB) return cvA - cvB;

      return a.name.localeCompare(b.name);
    });
}

function armAutoSubmitCastingDialog(actor, spell) {
  Hooks.once("renderCastingDialog", (app) => {
    const sameActor = app?.actor?.id === actor.id;
    const sameSpell = app?.spell?.id === spell.id;
    if (!sameActor || !sameSpell) return;

    const element = toElement(app?.element);
    if (element) {
      element.style.visibility = "hidden";
      element.style.pointerEvents = "none";
    }

    setTimeout(async () => {
      if (typeof app?.submit !== "function") {
        console.error("[spell-cast-select] CastingDialog.submit() is unavailable.");
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

async function setupCastingTest(actor, spell, { autoRoll = false } = {}) {
  const lore = spell.system?.lore;

  if (!hasText(lore) || lore === "none") {
    ui.notifications.warn(`${actor.name}: '${spell.name}' has no lore, cannot open Casting Test.`);
    return null;
  }

  if (autoRoll) {
    armAutoSubmitCastingDialog(actor, spell);
  }

  return actor.setupCastingTest({ lore, spell }, SELF_ROLL_CONTEXT);
}

function renderSpellSelector(actor, spells) {
  const buttonMarkup = spells
    .map((spell) => {
      const itemId = escapeHtml(spell.id);
      const itemName = escapeHtml(spell.name);
      const loreName = escapeHtml(getLoreLabel(spell) || "No Lore");
      const cv = Number(spell.system?.cv ?? 0);

      return `<button type="button"
        class="spell-btn"
        data-id="${itemId}"
        style="text-align:left; padding:6px;">
        <strong>${itemName}</strong>
        <div style="font-size:12px; opacity:0.8;">${loreName} | CV ${cv}</div>
      </button>`;
    })
    .join("");

  const content = `<div style="display:flex; flex-direction:column; gap:6px;">${buttonMarkup}</div>`;

  const selectorDialog = new Dialog({
    title: `${actor.name} - Spells`,
    content,
    buttons: { close: { label: "Close" } },
    render: (html) => {
      html.find(".spell-btn").on("click", async (event) => {
        const chosen = actor.items.get(event.currentTarget.dataset.id);
        if (!chosen) return;

        selectorDialog.close();
        await setupCastingTest(actor, chosen, { autoRoll: false });
      });
    }
  });

  selectorDialog.render(true);
}

async function runAutoRollPath(actor, spells) {
  await setupCastingTest(actor, spells[0], { autoRoll: true });
}

function runManualPath(actor, spells) {
  renderSpellSelector(actor, spells);
}

async function runSpellFlow(actor) {
  if (!actor) return;

  const spells = getSortedSpells(actor);
  if (spells.length === 0) {
    ui.notifications.warn(`${actor.name}: no castable spells found in Magic tab.`);
    return;
  }

  if (rollPath === "manual") {
    runManualPath(actor, spells);
    return;
  }

  await runAutoRollPath(actor, spells);
}

for (const token of tokens) {
  await runSpellFlow(token.actor);
}
