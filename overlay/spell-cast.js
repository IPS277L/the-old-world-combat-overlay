// TODO: Read the book and validate spell casting flow
const ACTIONS_API_KEY = "towActions";
const ACTIONS_RUNTIME_PARTS = [
  "tow-actions-runtime-part-00-core-v1",
  "tow-actions-runtime-part-10-attack-flow-v1",
  "tow-actions-runtime-part-20-defence-flow-v1",
  "tow-actions-runtime-part-30-api-v1"
];
const ACTIONS_RUNTIME_LOADER_CANDIDATES = ["tow-actions-runtime-loader-v1"];
const ACTIONS_LIB_CANDIDATES = ["tow-actions-lib-v1", "tow-actions-lib"];
const SELF_ROLL_CONTEXT = { skipTargets: true, targets: [] };

async function executeMacroByNameCandidates(candidates) {
  const macro = candidates
    .map((name) => game.macros.getName(name))
    .find(Boolean);
  if (!macro) return false;
  await macro.execute();
  return true;
}

async function ensureTowActions() {
  const hasApi = typeof game[ACTIONS_API_KEY]?.isShiftHeld === "function"
    && typeof game[ACTIONS_API_KEY]?.escapeHtml === "function"
    && typeof game[ACTIONS_API_KEY]?.toElement === "function"
    && typeof game[ACTIONS_API_KEY]?.scheduleSoon === "function";
  if (hasApi) return true;

  try {
    for (const macroName of ACTIONS_RUNTIME_PARTS) {
      const macro = game.macros.getName(macroName);
      if (!macro) break;
      await macro.execute();
    }
    await executeMacroByNameCandidates(ACTIONS_RUNTIME_LOADER_CANDIDATES);
  } catch (error) {
    console.error("[spell-cast-select] Failed to execute runtime actions macros.", error);
  }

  const runtimeHasApi = typeof game[ACTIONS_API_KEY]?.isShiftHeld === "function"
    && typeof game[ACTIONS_API_KEY]?.escapeHtml === "function"
    && typeof game[ACTIONS_API_KEY]?.toElement === "function"
    && typeof game[ACTIONS_API_KEY]?.scheduleSoon === "function";
  if (runtimeHasApi) return true;

  try {
    const loaded = await executeMacroByNameCandidates(ACTIONS_LIB_CANDIDATES);
    if (!loaded) {
      const attempted = [...ACTIONS_RUNTIME_PARTS, ...ACTIONS_RUNTIME_LOADER_CANDIDATES, ...ACTIONS_LIB_CANDIDATES];
      ui.notifications.error(`Shared actions macro not found. Tried: ${attempted.join(", ")}`);
      return false;
    }
  } catch (error) {
    console.error("[spell-cast-select] Failed to execute shared actions macro.", error);
    ui.notifications.error("Failed to load shared actions macro.");
    return false;
  }

  return typeof game[ACTIONS_API_KEY]?.isShiftHeld === "function"
    && typeof game[ACTIONS_API_KEY]?.escapeHtml === "function"
    && typeof game[ACTIONS_API_KEY]?.toElement === "function"
    && typeof game[ACTIONS_API_KEY]?.scheduleSoon === "function";
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

    const element = game[ACTIONS_API_KEY].toElement(app?.element);
    if (element) {
      element.style.visibility = "hidden";
      element.style.pointerEvents = "none";
    }

    game[ACTIONS_API_KEY].scheduleSoon(async () => {
      if (typeof app?.submit !== "function") {
        console.error("[spell-cast-select] CastingDialog.submit() is unavailable.");
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
      const itemId = game[ACTIONS_API_KEY].escapeHtml(spell.id);
      const itemName = game[ACTIONS_API_KEY].escapeHtml(spell.name);
      const loreName = game[ACTIONS_API_KEY].escapeHtml(getLoreLabel(spell) || "No Lore");
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

function runManualPath(actor, spells) {
  renderSpellSelector(actor, spells);
}

void (async () => {
  if (!(await ensureTowActions())) return;
  const tokens = canvas.tokens.controlled;
  if (!tokens.length) {
    ui.notifications.warn("Select at least one token.");
    return;
  }

  const rollPath = game[ACTIONS_API_KEY].isShiftHeld() ? "manual" : "auto";
  for (const token of tokens) {
    if (!token?.actor) continue;
    const spells = getSortedSpells(token.actor);
    if (spells.length === 0) {
      ui.notifications.warn(`${token.actor.name}: no castable spells found in Magic tab.`);
      continue;
    }
    if (rollPath === "manual") {
      runManualPath(token.actor, spells);
      continue;
    }
    await setupCastingTest(token.actor, spells[0], { autoRoll: true });
  }
})();
