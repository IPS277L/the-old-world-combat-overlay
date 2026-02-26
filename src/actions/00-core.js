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

  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const message = game.messages.get(messageId);
    if (message) return message;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  return game.messages.get(messageId) ?? null;
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

