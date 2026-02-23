// Toggle Overlay (Foundry V13)
// Combines:
// 1) Wound controls (W left click add, right click remove)
// 2) STAG text toggle control
// 3) RES label above token
// 4) Status icon backgrounds (yellow staggered, gray dead)

const MODULE_KEY = "towMacroToggleOverlay";
const PreciseTextClass = foundry.canvas.containers.PreciseText;
const LIB_MACRO_CANDIDATES = ["tow-actions-lib-v1", "tow-actions-lib"];

const KEYS = {
  woundUI: "_towWoundControlUI",
  woundUiMarker: "_towOverlayWoundUiMarker",
  woundUiTokenId: "_towOverlayWoundUiTokenId",
  resilienceLabel: "_towResilienceLabel",
  staggerLayer: "_towStaggerBgLayer",
  staggerApplying: "_towStaggerApplying",
  staggerSignature: "_towStaggerSig",
  staggerTimers: "_towStaggerTimers"
};

const STATUS_BG_RULES = [
  { id: "staggered", iconPart: "/conditions/staggered.svg", color: 0xFFD54A, alpha: 0.9 },
  { id: "dead", iconPart: "/conditions/dead.svg", color: 0xFFFFFF, alpha: 0.98 }
];
const STAGGER_REFRESH_DELAY_MS = 90;
const OVERLAY_FONT_SIZE = 22;
const DRAG_START_THRESHOLD_PX = 8;
const DRAG_LINE_OUTER_COLOR = 0x1A0909;
const DRAG_LINE_OUTER_ALPHA = 0.85;
const DRAG_LINE_OUTER_WIDTH = 7;
const DRAG_LINE_INNER_COLOR = 0x8F2A2A;
const DRAG_LINE_INNER_ALPHA = 0.96;
const DRAG_LINE_INNER_WIDTH = 3;
const DRAG_ARROW_SIZE = 13;
const DRAG_ENDPOINT_OUTER_RADIUS = 6;
const DRAG_ENDPOINT_RING_WIDTH = 2;
const ATTACK_DEDUPE_WINDOW_MS = 700;
const TARGET_DEDUPE_WINDOW_MS = 300;
const AUTO_DEFENCE_WAIT_MS = 4000;
const AUTO_APPLY_WAIT_MS = 10000;
const OPPOSED_LINK_WAIT_MS = 700;
const AUTO_STAGGER_PATCH_MS = 12000;
const FLOW_CARD_FONT_SIZE = "var(--font-size-16)";
const FLOW_CARD_CHIP_FONT_SIZE = "var(--font-size-12)";

const WOUND_ITEM_TYPE = "wound";
const STAGGERED_CONDITION = "staggered";

function canEditActor(actor) {
  return actor?.isOwner === true;
}

function warnNoPermission(actor) {
  ui.notifications.warn(`No permission to edit ${actor?.name ?? "actor"}.`);
}

function getActorFromToken(tokenObject) {
  return tokenObject?.document?.actor ?? null;
}

function asTokenObject(tokenLike) {
  return tokenLike?.object ?? tokenLike ?? null;
}

function forEachSceneToken(callback) {
  for (const token of canvas.tokens.placeables) callback(token);
}

function forEachActorToken(actor, callback) {
  if (!actor) return;
  for (const token of actor.getActiveTokens(true)) {
    const tokenObject = asTokenObject(token);
    if (tokenObject) callback(tokenObject);
  }
}

function preventPointerDefault(event) {
  event.stopPropagation();
  event.nativeEvent?.preventDefault?.();
}

function getMouseButton(event) {
  return event.button ?? event.data?.button ?? event.nativeEvent?.button ?? 0;
}

function isShiftModifier(event) {
  if (event?.shiftKey === true) return true;
  if (event?.data?.originalEvent?.shiftKey === true) return true;
  if (event?.nativeEvent?.shiftKey === true) return true;
  return game.keyboard?.isModifierActive?.(KeyboardManager.MODIFIER_KEYS.SHIFT) === true;
}

function getWorldPoint(event) {
  const global = event?.global ?? event?.data?.global;
  if (global && canvas?.stage?.worldTransform) {
    return canvas.stage.worldTransform.applyInverse(global);
  }
  return canvas.mousePosition ?? null;
}

function tokenAtPoint(point, { excludeTokenId } = {}) {
  if (!point) return null;
  const placeables = [...canvas.tokens.placeables];
  for (let i = placeables.length - 1; i >= 0; i--) {
    const token = placeables[i];
    if (!token || token.destroyed || !token.visible) continue;
    if (token.id === excludeTokenId) continue;
    if (point.x >= token.x && point.x <= token.x + token.w && point.y >= token.y && point.y <= token.y + token.h) {
      return token;
    }
  }
  return null;
}

function setSingleTarget(token) {
  if (!token) return;
  const currentTargets = Array.from(game.user.targets ?? []);
  if (currentTargets.length === 1 && currentTargets[0]?.id === token.id) return;

  const state = game[MODULE_KEY];
  if (state) {
    if (!state.recentTargets) state.recentTargets = new Map();
    const key = `${game.user.id}:${token.id}`;
    const now = Date.now();
    const last = Number(state.recentTargets.get(key) ?? 0);
    if (now - last < TARGET_DEDUPE_WINDOW_MS) return;
    state.recentTargets.set(key, now);
  }

  if (typeof game.user.updateTokenTargets === "function") {
    game.user.updateTokenTargets([token.id]);
    return;
  }

  token.setTarget(true, { releaseOthers: true, groupSelection: false });
}

function shouldRunDragAttack(sourceToken, targetToken) {
  const state = game[MODULE_KEY];
  if (!state) return true;

  if (!state.recentAttacks) state.recentAttacks = new Map();
  const key = `${game.user.id}:${sourceToken?.id ?? "none"}:${targetToken?.id ?? "none"}`;
  const now = Date.now();
  const last = Number(state.recentAttacks.get(key) ?? 0);
  if (now - last < ATTACK_DEDUPE_WINDOW_MS) return false;

  state.recentAttacks.set(key, now);
  if (state.recentAttacks.size > 100) {
    for (const [mapKey, ts] of state.recentAttacks.entries()) {
      if (now - Number(ts) > ATTACK_DEDUPE_WINDOW_MS * 3) state.recentAttacks.delete(mapKey);
    }
  }
  return true;
}

function createDragLine() {
  const line = new PIXI.Graphics();
  line.eventMode = "none";
  canvas.tokens.addChild(line);
  return line;
}

function drawDragLine(line, fromPoint, toPoint) {
  if (!line || !fromPoint || !toPoint) return;

  const dx = toPoint.x - fromPoint.x;
  const dy = toPoint.y - fromPoint.y;
  const angle = Math.atan2(dy, dx);
  const leftAngle = angle + (Math.PI * 5 / 6);
  const rightAngle = angle - (Math.PI * 5 / 6);
  const leftX = toPoint.x + (Math.cos(leftAngle) * DRAG_ARROW_SIZE);
  const leftY = toPoint.y + (Math.sin(leftAngle) * DRAG_ARROW_SIZE);
  const rightX = toPoint.x + (Math.cos(rightAngle) * DRAG_ARROW_SIZE);
  const rightY = toPoint.y + (Math.sin(rightAngle) * DRAG_ARROW_SIZE);

  line.clear();
  line.lineStyle({
    width: DRAG_LINE_OUTER_WIDTH,
    color: DRAG_LINE_OUTER_COLOR,
    alpha: DRAG_LINE_OUTER_ALPHA,
    cap: "round",
    join: "round"
  });
  line.moveTo(fromPoint.x, fromPoint.y);
  line.lineTo(toPoint.x, toPoint.y);
  line.moveTo(toPoint.x, toPoint.y);
  line.lineTo(leftX, leftY);
  line.moveTo(toPoint.x, toPoint.y);
  line.lineTo(rightX, rightY);

  line.lineStyle({
    width: DRAG_LINE_INNER_WIDTH,
    color: DRAG_LINE_INNER_COLOR,
    alpha: DRAG_LINE_INNER_ALPHA,
    cap: "round",
    join: "round"
  });
  line.moveTo(fromPoint.x, fromPoint.y);
  line.lineTo(toPoint.x, toPoint.y);
  line.moveTo(toPoint.x, toPoint.y);
  line.lineTo(leftX, leftY);
  line.moveTo(toPoint.x, toPoint.y);
  line.lineTo(rightX, rightY);

  line.lineStyle({
    width: DRAG_ENDPOINT_RING_WIDTH + 1,
    color: DRAG_LINE_OUTER_COLOR,
    alpha: DRAG_LINE_OUTER_ALPHA
  });
  line.beginFill(DRAG_LINE_INNER_COLOR, DRAG_LINE_INNER_ALPHA);
  line.drawCircle(fromPoint.x, fromPoint.y, DRAG_ENDPOINT_OUTER_RADIUS);
  line.endFill();
}

function clearDragLine(line) {
  if (!line) return;
  line.parent?.removeChild(line);
  line.destroy();
}

async function ensureTowActions() {
  const hasApi = typeof game.towActions?.attackActor === "function" &&
    typeof game.towActions?.defenceActor === "function" &&
    typeof game.towActions?.isShiftHeld === "function";
  if (hasApi) return true;

  const libMacro = LIB_MACRO_CANDIDATES
    .map((name) => game.macros.getName(name))
    .find(Boolean);
  if (!libMacro) {
    ui.notifications.error(`Shared actions macro not found. Tried: ${LIB_MACRO_CANDIDATES.join(", ")}`);
    return false;
  }

  try {
    await libMacro.execute();
  } catch (error) {
    console.error("[overlay-toggle] Failed to execute shared actions macro.", error);
    ui.notifications.error("Failed to load shared actions macro.");
    return false;
  }

  const loaded = typeof game.towActions?.attackActor === "function" &&
    typeof game.towActions?.defenceActor === "function" &&
    typeof game.towActions?.isShiftHeld === "function";
  if (!loaded) {
    ui.notifications.error("Shared actions loaded, but ATK/DEF API is unavailable.");
  }
  return loaded;
}

function armDefaultStaggerChoiceWound(durationMs = AUTO_STAGGER_PATCH_MS) {
  const state = game[MODULE_KEY];
  const DialogApi = foundry.applications?.api?.Dialog;
  if (!state || typeof DialogApi?.wait !== "function") return () => {};

  if (!state.staggerWaitPatch) {
    const originalWait = DialogApi.wait.bind(DialogApi);
    state.staggerWaitPatch = { originalWait, refs: 0 };

    DialogApi.wait = async (config, options) => {
      const title = String(config?.window?.title ?? "");
      const content = String(config?.content ?? "");
      const actions = Array.isArray(config?.buttons)
        ? config.buttons.map((b) => String(b?.action ?? ""))
        : Object.values(config?.buttons ?? {}).map((b) => String(b?.action ?? ""));
      const hasStaggerChoices = actions.includes("wound")
        && (actions.includes("prone") || actions.includes("give"));
      const likelyStaggerText = title.toLowerCase().includes("stagger")
        || content.toLowerCase().includes("stagger")
        || content.toLowerCase().includes("choose from the following options");
      if (hasStaggerChoices || likelyStaggerText) return "wound";
      return state.staggerWaitPatch.originalWait(config, options);
    };
  }

  state.staggerWaitPatch.refs += 1;
  let restored = false;
  const restore = () => {
    if (restored) return;
    restored = true;
    if (!state.staggerWaitPatch) return;
    state.staggerWaitPatch.refs = Math.max(0, state.staggerWaitPatch.refs - 1);
    if (state.staggerWaitPatch.refs === 0) {
      DialogApi.wait = state.staggerWaitPatch.originalWait;
      delete state.staggerWaitPatch;
    }
  };

  const timer = setTimeout(restore, durationMs);
  return () => {
    clearTimeout(timer);
    restore();
  };
}

function armAutoDefenceForOpposed(sourceToken, targetToken, { sourceBeforeState } = {}) {
  if (!sourceToken?.actor || !targetToken?.actor?.isOwner) return;

  let timeoutId = null;
  const cleanup = (hookId) => {
    Hooks.off("createChatMessage", hookId);
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = null;
  };

  const hookId = Hooks.on("createChatMessage", async (message) => {
    if (message?.type !== "opposed") return;
    if (message.system?.defender?.token !== targetToken.id) return;

    const attackerMessage = game.messages.get(message.system?.attackerMessage);
    const attackerActorUuid = attackerMessage?.system?.test?.actor;
    if (attackerActorUuid && attackerActorUuid !== sourceToken.actor.uuid) return;

    const state = game[MODULE_KEY];
    if (state) {
      if (!state.autoDefenceHandled) state.autoDefenceHandled = new Set();
      if (state.autoDefenceHandled.has(message.id)) return;
      state.autoDefenceHandled.add(message.id);
    }

    cleanup(hookId);
    if (!(await ensureTowActions())) return;

    const started = Date.now();
    while (Date.now() - started < OPPOSED_LINK_WAIT_MS) {
      if (targetToken.actor.system?.opposed?.id === message.id) break;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    await game.towActions.defenceActor(targetToken.actor, { manual: false });
    armAutoApplyDamageForOpposed(message, {
      sourceActor: sourceToken.actor,
      sourceBeforeState
    });
  });

  timeoutId = setTimeout(() => cleanup(hookId), AUTO_DEFENCE_WAIT_MS);
}

function armAutoApplyDamageForOpposed(opposedMessage, { sourceActor = null, sourceBeforeState = null } = {}) {
  if (!opposedMessage?.id) return;
  const state = game[MODULE_KEY];
  if (state) {
    if (!state.autoApplyArmed) state.autoApplyArmed = new Set();
    if (state.autoApplyArmed.has(opposedMessage.id)) return;
    state.autoApplyArmed.add(opposedMessage.id);
  }

  const cleanup = () => {
    state?.autoApplyArmed?.delete(opposedMessage.id);
    state?.autoDefenceHandled?.delete(opposedMessage.id);
  };
  void (async () => {
    let applying = false;
    let separatorPosted = false;
    const postSeparatorOnce = async (opposed) => {
      if (separatorPosted) return;
      separatorPosted = true;
      const sourceStatusHints = await deriveSourceStatusHints(sourceActor, sourceBeforeState);
      await postFlowSeparatorCard(opposed, { sourceStatusHints, targetStatusHints: [] });
    };

    const started = Date.now();
    while (Date.now() - started < AUTO_APPLY_WAIT_MS) {
      const message = game.messages.get(opposedMessage.id);
      const opposed = message?.system;
      if (!opposed) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        continue;
      }

      const computed = opposed.result?.computed === true;
      const hasDamage = typeof opposed.result?.damage !== "undefined" && opposed.result?.damage !== null;
      const alreadyApplied = opposed.result?.damage?.applied === true;
      if (!computed) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        continue;
      }

      if (!hasDamage || alreadyApplied) {
        await postSeparatorOnce(opposed);
        break;
      }

      const defenderActor = ChatMessage.getSpeakerActor(opposed.defender);
      if (!defenderActor?.isOwner || applying) {
        await postSeparatorOnce(opposed);
        break;
      }

      applying = true;
      const beforeState = snapshotActorState(defenderActor);
      const damageValue = Number(opposed.result?.damage?.value ?? 0);
      await applyDamageWithWoundsFallback(defenderActor, damageValue, {
        opposed,
        item: opposed.attackerTest?.item,
        test: opposed.attackerMessage?.system?.test
      });
      const afterState = await captureSettledActorState(defenderActor, beforeState, 700);
      const targetStatusHints = deriveAppliedStatusLabels(beforeState, afterState);
      const sourceStatusHints = await deriveSourceStatusHints(sourceActor, sourceBeforeState);
      if (!separatorPosted) {
        separatorPosted = true;
        await postFlowSeparatorCard(opposed, { sourceStatusHints, targetStatusHints });
      }
      break;
    }
    cleanup();
  })();
}

async function applyDamageWithWoundsFallback(defenderActor, damageValue, context) {
  const system = defenderActor?.system;
  if (!system || typeof system.applyDamage !== "function") return;

  const originalAddWound = (typeof system.addWound === "function") ? system.addWound.bind(system) : null;
  if (!originalAddWound) {
    await system.applyDamage(damageValue, context);
    return;
  }

  system.addWound = async function wrappedAddWound(options = {}) {
    const currentWoundCount = () => Number((this.parent?.items?.contents ?? []).filter((i) => i.type === WOUND_ITEM_TYPE).length);
    const beforeCount = currentWoundCount();
    const tableId = game.settings.get("whtow", "tableSettings")?.wounds;
    const hasTable = !!(tableId && game.tables.get(tableId));

    const fallbackGenericWound = async () => {
      const afterCount = currentWoundCount();
      if (afterCount > beforeCount) return null;
      ui.notifications.warn("Wounds table missing. Applied generic Wound.");
      return this.parent.createEmbeddedDocuments("Item", [{ type: "wound", name: "Wound" }]);
    };

    if (!hasTable) {
      // Keep system wound/death scripts, just skip table roll path.
      try {
        const result = await originalAddWound({ ...options, roll: false });
        await new Promise((resolve) => setTimeout(resolve, 25));
        if (currentWoundCount() <= beforeCount) return fallbackGenericWound();
        return result;
      } catch (error) {
        return fallbackGenericWound();
      }
    }
    try {
      return await originalAddWound(options);
    } catch (error) {
      const message = String(error?.message ?? error ?? "");
      if (message.includes("No table found for wounds")) return fallbackGenericWound();
      throw error;
    }
  };

  try {
    await system.applyDamage(damageValue, context);
  } finally {
    system.addWound = originalAddWound;
  }
}

function snapshotActorState(actor) {
  const statuses = new Set(Array.from(actor?.statuses ?? []).map((s) => String(s)));
  for (const effect of Array.from(actor?.effects?.contents ?? [])) {
    for (const status of Array.from(effect?.statuses ?? [])) {
      statuses.add(String(status));
    }
  }
  const wounds = Number(actor?.itemTypes?.wound?.length ?? 0);
  return { statuses, wounds };
}

async function captureSettledActorState(actor, baselineState, settleMs = 700) {
  const started = Date.now();
  let last = snapshotActorState(actor);
  let stableFor = 0;

  while (Date.now() - started < settleMs) {
    await new Promise((resolve) => setTimeout(resolve, 80));
    const current = snapshotActorState(actor);
    const sameWounds = current.wounds === last.wounds;
    const sameStatuses = current.statuses.size === last.statuses.size
      && Array.from(current.statuses).every((s) => last.statuses.has(s));
    if (sameWounds && sameStatuses) {
      stableFor += 80;
      if (stableFor >= 160) return current;
    } else {
      stableFor = 0;
      last = current;
    }
  }

  const finalState = snapshotActorState(actor);
  if ((finalState.wounds ?? 0) < (baselineState?.wounds ?? 0)) return last;
  return finalState;
}

async function deriveSourceStatusHints(sourceActor, sourceBeforeState) {
  if (!sourceActor || !sourceBeforeState) return [];
  const sourceAfterState = await captureSettledActorState(sourceActor, sourceBeforeState, 500);
  return deriveAppliedStatusLabels(sourceBeforeState, sourceAfterState);
}

function deriveAppliedStatusLabels(before, after) {
  const labels = [];
  const add = (label) => {
    if (!label) return;
    if (!labels.includes(label)) labels.push(label);
  };

  if ((after?.wounds ?? 0) > (before?.wounds ?? 0)) add("Wound");

  const beforeStatuses = before?.statuses ?? new Set();
  const afterStatuses = after?.statuses ?? new Set();
  for (const statusId of afterStatuses) {
    if (beforeStatuses.has(statusId)) continue;
    const label = game.oldworld?.config?.conditions?.[statusId]?.name
      ?? game.i18n.localize(`TOW.ConditionName.${statusId}`)
      ?? statusId;
    add(label);
  }
  return labels;
}

function getFlowNamesMarkup(attackerName, defenderName) {
  const attackerSafe = foundry.utils.escapeHTML(attackerName);
  const defenderSafe = foundry.utils.escapeHTML(defenderName);
  const combinedLen = `${attackerName} vs. ${defenderName}`.length;
  const needsStacked = combinedLen > 34 || attackerName.length > 18 || defenderName.length > 18;

  if (!needsStacked) {
    return `<div style="font-size: inherit; text-align:center; font-weight:700;">
      ${attackerSafe} vs. ${defenderSafe}
    </div>`;
  }

  return `<div style="font-size: inherit; text-align:center; font-weight:700; display:flex; flex-direction:column; align-items:center; line-height:1.2; gap:1px;">
    <div>${attackerSafe}</div>
    <div style="font-weight:600; opacity:0.85;">vs.</div>
    <div>${defenderSafe}</div>
  </div>`;
}

async function postFlowSeparatorCard(opposed, { sourceStatusHints = [], targetStatusHints = [] } = {}) {
  const attackerName = opposed?.attackerToken?.name ?? "Attacker";
  const defenderName = opposed?.defenderToken?.name ?? opposed?.defender?.alias ?? "Defender";
  const outcome = opposed?.result?.outcome ?? "resolved";
  const outcomeText = String(outcome);
  const outcomeLabel = outcomeText.charAt(0).toUpperCase() + outcomeText.slice(1).toLowerCase();
  const margin = Number(opposed?.result?.successes ?? 0);
  const marginLabel = `${margin >= 0 ? "+" : ""}${margin}`;
  const damageValue = Number(opposed?.result?.damage?.value ?? 0);
  const damageLabel = Number.isFinite(damageValue) && damageValue > 0 ? String(damageValue) : "0";

  const statusLabels = [];
  const pushStatus = (label) => {
    if (!label) return;
    if (!statusLabels.includes(label)) statusLabels.push(label);
  };

  const damageMessageKey = String(opposed?.result?.damage?.message ?? "");
  if (damageMessageKey.includes("TakesWound")) pushStatus("Wound");
  if (damageMessageKey.includes("GainsStaggered")) pushStatus("Staggered");
  if (damageMessageKey.includes("SuffersFault")) pushStatus("Fault");

  const effectStatuses = Array.isArray(opposed?.attackerTest?.damageEffects)
    ? opposed.attackerTest.damageEffects.flatMap((effect) => Array.from(effect?.statuses ?? []))
    : [];
  for (const status of effectStatuses) {
    const key = String(status ?? "");
    const label = game.oldworld?.config?.conditions?.[key]?.name
      ?? game.i18n.localize(`TOW.ConditionName.${key}`)
      ?? key;
    pushStatus(label);
  }

  for (const label of targetStatusHints) pushStatus(label);
  const targetStatusLabels = [...statusLabels];
  const sourceStatusLabels = Array.from(new Set((sourceStatusHints ?? []).filter(Boolean)));

  const outcomeColor = outcome === "success"
    ? "#2e7d32"
    : outcome === "failure"
      ? "#9b1c1c"
      : "#6b5e3a";
  const marginColor = margin > 0 ? "#2e7d32" : margin < 0 ? "#9b1c1c" : "#6b5e3a";
  const damageColor = damageValue > 0 ? "#9b1c1c" : "#6b5e3a";

  const statusColorFor = (label) => {
    const key = String(label).toLowerCase();
    if (key.includes("wound")) return { bg: "#5e1f1f", fg: "#ffd9d9", border: "#b75b5b" };
    if (key.includes("stagger")) return { bg: "#5a4a18", fg: "#ffe8a6", border: "#c9a447" };
    if (key.includes("prone")) return { bg: "#24344f", fg: "#d6e6ff", border: "#5f84c6" };
    if (key.includes("fault")) return { bg: "#4b214f", fg: "#f0d8ff", border: "#a164bf" };
    return { bg: "#3a362b", fg: "#efe8d2", border: "#8f8468" };
  };

  const statusMarkupFrom = (labels) => labels.length
    ? labels.map((label) => {
      const c = statusColorFor(label);
      return `<span style="
        display:inline-block;
        margin:0 2px;
        padding:1px 6px;
        border-radius:10px;
        border:1px solid ${c.border};
        background:${c.bg};
        color:${c.fg};
        font-size:${FLOW_CARD_CHIP_FONT_SIZE};
        line-height:1.4;
      ">${foundry.utils.escapeHTML(label)}</span>`;
    }).join("")
    : `<span style="
      display:inline-block;
      margin:0 2px;
      padding:1px 6px;
      border-radius:10px;
      border:1px solid #8f8468;
      background:#3a362b;
      color:#efe8d2;
      font-size:${FLOW_CARD_CHIP_FONT_SIZE};
      line-height:1.4;
    ">None</span>`;
  const sourceStatusMarkup = statusMarkupFrom(sourceStatusLabels);
  const targetStatusMarkup = statusMarkupFrom(targetStatusLabels);
  const namesMarkup = getFlowNamesMarkup(attackerName, defenderName);

  const content = `<div style="
      border-top: 1px solid rgba(130,110,80,0.45);
      border-bottom: 1px solid rgba(130,110,80,0.45);
      margin: 4px 0;
      padding: 7px 8px;
      text-align: center;
      letter-spacing: 0.04em;
      opacity: 0.9;
      line-height: 1.35;
      font-size: ${FLOW_CARD_FONT_SIZE};">
      ${namesMarkup}
      <div style="margin-top:2px; font-size: inherit; text-align:center;">
        <strong style="color:${outcomeColor};">${foundry.utils.escapeHTML(outcomeLabel)}</strong>
      </div>
      <div style="margin-top:2px; font-size: inherit; text-align:center;">
        Margin: <strong style="color:${marginColor};">${foundry.utils.escapeHTML(marginLabel)}</strong>
        &nbsp;|&nbsp;
        Damage: <strong style="color:${damageColor};">${foundry.utils.escapeHTML(damageLabel)}</strong>
      </div>
      <div style="margin-top:5px; display:flex; flex-direction:column; gap:4px; align-items:stretch; text-align:left;">
        <div style="display:flex; gap:6px; align-items:center; flex-wrap:wrap;">
          <span style="opacity:0.8; min-width:56px;">Source:</span>
          <div style="display:flex; gap:4px; flex-wrap:wrap;">${sourceStatusMarkup}</div>
        </div>
        <div style="display:flex; gap:6px; align-items:center; flex-wrap:wrap;">
          <span style="opacity:0.8; min-width:56px;">Target:</span>
          <div style="display:flex; gap:4px; flex-wrap:wrap;">${targetStatusMarkup}</div>
        </div>
      </div>
    </div>`;

  await ChatMessage.create({
    content,
    speaker: { alias: "Combat Flow" }
  });
}

function clearDisplayObject(displayObject) {
  if (!displayObject) return;
  displayObject.parent?.removeChild(displayObject);
  displayObject.destroy({ children: true });
}

function getWoundCount(tokenDocument) {
  const actor = tokenDocument?.actor;
  if (!actor) return null;
  const liveItems = actor.items?.contents ?? [];
  if (Array.isArray(liveItems)) {
    return liveItems.filter((item) => item.type === WOUND_ITEM_TYPE).length;
  }
  if (Array.isArray(actor.itemTypes?.wound)) return actor.itemTypes.wound.length;
  return 0;
}

function getResilienceValue(tokenDocument) {
  return tokenDocument?.actor?.system?.resilience?.value ?? null;
}

function getActorWoundCount(actor) {
  const liveItems = actor?.items?.contents ?? [];
  if (Array.isArray(liveItems)) {
    return liveItems.filter((item) => item.type === WOUND_ITEM_TYPE).length;
  }
  if (Array.isArray(actor?.itemTypes?.wound)) return actor.itemTypes.wound.length;
  return 0;
}

async function normalizeDeadCondition(actor) {
  const deadEffects = Array.from(actor?.effects?.contents ?? []).filter((effect) =>
    effect?.statuses?.has?.("dead")
  );
  if (deadEffects.length <= 1) return;

  const toDelete = deadEffects.slice(1).map((effect) => effect.id).filter(Boolean);
  if (toDelete.length) await actor.deleteEmbeddedDocuments("ActiveEffect", toDelete);
}

async function syncDeadFromWounds(actor) {
  if (!actor || !canEditActor(actor)) return;
  const state = game[MODULE_KEY];
  if (state) {
    if (!state.deadSyncInFlight) state.deadSyncInFlight = new Set();
    if (state.deadSyncInFlight.has(actor.id)) return;
    state.deadSyncInFlight.add(actor.id);
  }

  try {
    const wounds = getActorWoundCount(actor);
    const npcType = String(actor.system?.type ?? "");
    const hasThresholds = actor.system?.hasThresholds === true;
    const isDead = actor.hasCondition?.("dead") === true;

    // Manual wound controls: if wounds are fully cleared, clear dead as well.
    if (wounds <= 0) {
      if (isDead) await actor.removeCondition("dead");
      await normalizeDeadCondition(actor);
      return;
    }

    let shouldBeDead = null;
    if (npcType === "minion") {
      shouldBeDead = wounds >= 1;
    } else if (hasThresholds && typeof actor.system?.thresholdAtWounds === "function") {
      shouldBeDead = actor.system.thresholdAtWounds(wounds) === "defeated";
    }

    if (shouldBeDead !== null) {
      if (shouldBeDead && !isDead) {
        await actor.addCondition("dead");
      } else if (!shouldBeDead && isDead) {
        await actor.removeCondition("dead");
      }
    }

    await normalizeDeadCondition(actor);
  } finally {
    state?.deadSyncInFlight?.delete(actor.id);
  }
}

async function addWound(actor) {
  if (!canEditActor(actor)) {
    warnNoPermission(actor);
    return;
  }
  await actor.createEmbeddedDocuments("Item", [{ type: WOUND_ITEM_TYPE, name: "Wound" }]);
  await syncDeadFromWounds(actor);
}

async function removeWound(actor) {
  if (!canEditActor(actor)) {
    warnNoPermission(actor);
    return;
  }

  const state = game[MODULE_KEY];
  if (state) {
    if (!state.woundDeleteInFlight) state.woundDeleteInFlight = new Set();
    if (state.woundDeleteInFlight.has(actor.id)) return;
    state.woundDeleteInFlight.add(actor.id);
  }

  try {
  const wounds = actor.itemTypes?.wound ?? actor.items.filter((item) => item.type === WOUND_ITEM_TYPE);
  if (!wounds.length) return;

  const toDelete = wounds.find((wound) => wound.system?.treated !== true) ?? wounds[wounds.length - 1];
  if (!toDelete) return;
  if (!actor.items.get(toDelete.id)) return;

    try {
      await actor.deleteEmbeddedDocuments("Item", [toDelete.id]);
    } catch (error) {
      const msg = String(error?.message ?? error ?? "");
      if (msg.includes("does not exist")) return;
      throw error;
    }
    await syncDeadFromWounds(actor);
  } finally {
    if (state?.woundDeleteInFlight) state.woundDeleteInFlight.delete(actor.id);
  }
}

async function toggleStaggered(actor) {
  if (!canEditActor(actor)) {
    warnNoPermission(actor);
    return;
  }

  if (actor.hasCondition?.(STAGGERED_CONDITION)) {
    await actor.removeCondition(STAGGERED_CONDITION);
  } else {
    await actor.addCondition(STAGGERED_CONDITION);
  }
}

function getControlStyle() {
  const style = CONFIG.canvasTextStyle?.clone?.() ?? new PIXI.TextStyle();
  style.fontFamily = "CaslonPro";
  style.fontSize = OVERLAY_FONT_SIZE;
  style.fill = "#f5e8c8";
  style.stroke = "#111111";
  style.strokeThickness = 4;
  style.dropShadow = false;
  style.align = "left";
  return style;
}

function getResilienceStyle() {
  const style = CONFIG.canvasTextStyle?.clone?.() ?? new PIXI.TextStyle();
  style.fontSize = OVERLAY_FONT_SIZE;
  style.fill = "#f5e8c8";
  style.stroke = "#1a1a1a";
  style.strokeThickness = 4;
  style.dropShadow = false;
  style.align = "center";
  return style;
}

function drawHitBoxRect(graphics, x, y, width, height) {
  graphics.clear();
  graphics.beginFill(0x000000, 0.001);
  graphics.drawRoundedRect(x, y, width, height, 6);
  graphics.endFill();
}

function createWoundControlUI(tokenObject) {
  for (const child of canvas.tokens.children ?? []) {
    if (child?.[KEYS.woundUiMarker] === true && child?.[KEYS.woundUiTokenId] === tokenObject.id) {
      clearDisplayObject(child);
    }
  }

  const container = new PIXI.Container();
  container.eventMode = "passive";
  container.interactiveChildren = true;
  container[KEYS.woundUiMarker] = true;
  container[KEYS.woundUiTokenId] = tokenObject.id;

  const countText = new PreciseTextClass("", getControlStyle());
  countText.anchor.set(0, 0.5);
  countText.eventMode = "none";

  const countHitBox = new PIXI.Graphics();
  countHitBox.eventMode = "static";
  countHitBox.interactive = true;
  countHitBox.buttonMode = true;
  countHitBox.cursor = "pointer";

  const staggerText = new PreciseTextClass("STAG", getControlStyle());
  staggerText.anchor.set(0, 0.5);
  staggerText.eventMode = "none";

  const attackText = new PreciseTextClass("ATK", getControlStyle());
  attackText.anchor.set(1, 0.5);
  attackText.eventMode = "none";

  const defenceText = new PreciseTextClass("DEF", getControlStyle());
  defenceText.anchor.set(1, 0.5);
  defenceText.eventMode = "none";

  const attackHitBox = new PIXI.Graphics();
  attackHitBox.eventMode = "static";
  attackHitBox.interactive = true;
  attackHitBox.buttonMode = true;
  attackHitBox.cursor = "grab";

  const defenceHitBox = new PIXI.Graphics();
  defenceHitBox.eventMode = "static";
  defenceHitBox.interactive = true;
  defenceHitBox.buttonMode = true;
  defenceHitBox.cursor = "pointer";

  const staggerHitBox = new PIXI.Graphics();
  staggerHitBox.eventMode = "static";
  staggerHitBox.interactive = true;
  staggerHitBox.buttonMode = true;
  staggerHitBox.cursor = "pointer";

  countHitBox.on("pointerdown", async (event) => {
    preventPointerDefault(event);
    const actor = getActorFromToken(tokenObject);
    if (!actor) return;

    if (getMouseButton(event) !== 0) {
      return;
    }
    await addWound(actor);
  });
  countHitBox.on("rightdown", async (event) => {
    preventPointerDefault(event);
    const actor = getActorFromToken(tokenObject);
    if (!actor) return;
    await removeWound(actor);
  });
  countHitBox.on("contextmenu", preventPointerDefault);

  staggerHitBox.on("pointerdown", async (event) => {
    preventPointerDefault(event);
    const actor = getActorFromToken(tokenObject);
    if (!actor) return;
    await toggleStaggered(actor);
  });
  staggerHitBox.on("contextmenu", preventPointerDefault);

  attackHitBox.on("pointerdown", async (event) => {
    preventPointerDefault(event);
    if (getMouseButton(event) !== 0) return;

    const sourceToken = tokenObject;
    const sourceActor = getActorFromToken(sourceToken);
    if (!sourceActor) return;
    if (!(await ensureTowActions())) return;

    const pointerDownShift = isShiftModifier(event);
    const origin = {
      x: sourceToken.x + (sourceToken.w / 2),
      y: sourceToken.y + (sourceToken.h / 2)
    };
    const startPoint = getWorldPoint(event) ?? origin;
    let dragStarted = false;
    let dragFinished = false;
    let dragLine = null;
    attackHitBox.cursor = "grabbing";

    const cleanupDrag = () => {
      canvas.stage.off("pointermove", onDragMove);
      canvas.stage.off("pointerup", finishDrag);
      canvas.stage.off("pointerupoutside", finishDrag);
      clearDragLine(dragLine);
      dragLine = null;
      attackHitBox.cursor = "grab";
    };

    const onDragMove = (moveEvent) => {
      const point = getWorldPoint(moveEvent);
      if (!point) return;
      const dx = point.x - startPoint.x;
      const dy = point.y - startPoint.y;
      if (!dragStarted) {
        if (Math.hypot(dx, dy) < DRAG_START_THRESHOLD_PX) return;
        dragStarted = true;
        dragLine = createDragLine();
      }
      drawDragLine(dragLine, origin, point);
    };

    const finishDrag = async (upEvent) => {
      if (dragFinished) return;
      dragFinished = true;
      cleanupDrag();

      const shiftManual = pointerDownShift || isShiftModifier(upEvent);
      if (!dragStarted) {
        await game.towActions.attackActor(sourceActor, { manual: shiftManual });
        return;
      }

      const point = getWorldPoint(upEvent);
      const target = tokenAtPoint(point, { excludeTokenId: sourceToken.id });
      if (!target) return;
      if (!shouldRunDragAttack(sourceToken, target)) return;

      setSingleTarget(target);
      if (shiftManual) {
        await game.towActions.attackActor(sourceActor, { manual: true });
        return;
      }

      const sourceBeforeState = snapshotActorState(sourceActor);
      const restoreStaggerPrompt = armDefaultStaggerChoiceWound(AUTO_STAGGER_PATCH_MS);
      armAutoDefenceForOpposed(sourceToken, target, { sourceBeforeState });
      try {
        await game.towActions.attackActor(sourceActor, { manual: false });
      } finally {
        setTimeout(() => restoreStaggerPrompt(), AUTO_APPLY_WAIT_MS);
      }
    };

    canvas.stage.on("pointermove", onDragMove);
    canvas.stage.on("pointerup", finishDrag);
    canvas.stage.on("pointerupoutside", finishDrag);
  });
  attackHitBox.on("contextmenu", preventPointerDefault);

  defenceHitBox.on("pointerdown", async (event) => {
    preventPointerDefault(event);
    if (getMouseButton(event) !== 0) return;
    const actor = getActorFromToken(tokenObject);
    if (!actor) return;
    if (!(await ensureTowActions())) return;
    await game.towActions.defenceActor(actor, { manual: game.towActions.isShiftHeld() });
  });
  defenceHitBox.on("contextmenu", preventPointerDefault);

  container.addChild(countHitBox);
  container.addChild(countText);
  container.addChild(staggerHitBox);
  container.addChild(staggerText);
  container.addChild(attackHitBox);
  container.addChild(defenceHitBox);
  container.addChild(attackText);
  container.addChild(defenceText);

  container._countText = countText;
  container._countHitBox = countHitBox;
  container._staggerText = staggerText;
  container._staggerHitBox = staggerHitBox;
  container._attackHitBox = attackHitBox;
  container._defenceHitBox = defenceHitBox;
  container._attackText = attackText;
  container._defenceText = defenceText;

  canvas.tokens.addChild(container);
  tokenObject[KEYS.woundUI] = container;
  return container;
}

function updateWoundControlUI(tokenObject) {
  if (!tokenObject || tokenObject.destroyed) return;

  const count = getWoundCount(tokenObject.document);
  if (count === null || count === undefined) {
    const ui = tokenObject[KEYS.woundUI];
    if (!ui) return;
    clearDisplayObject(ui);
    delete tokenObject[KEYS.woundUI];
    return;
  }

  const existingUi = tokenObject[KEYS.woundUI];
  const hasBrokenTextStyle = !!existingUi && (
    !existingUi._countText ||
    !existingUi._staggerText ||
    !existingUi._attackText ||
    !existingUi._defenceText ||
    existingUi._countText.destroyed ||
    existingUi._staggerText.destroyed ||
    existingUi._attackText.destroyed ||
    existingUi._defenceText.destroyed ||
    !existingUi._countText.style ||
    !existingUi._staggerText.style ||
    !existingUi._attackText.style ||
    !existingUi._defenceText.style
  );
  const staleUi = !!existingUi && (
    existingUi.destroyed ||
    existingUi.parent == null ||
    hasBrokenTextStyle ||
    existingUi._attackHitBox?.destroyed ||
    existingUi._defenceHitBox?.destroyed ||
    existingUi._countHitBox?.destroyed ||
    existingUi._staggerHitBox?.destroyed
  );
  if (staleUi) {
    clearDisplayObject(existingUi);
    delete tokenObject[KEYS.woundUI];
  }

  const ui = (!tokenObject[KEYS.woundUI] || tokenObject[KEYS.woundUI].destroyed)
    ? createWoundControlUI(tokenObject)
    : tokenObject[KEYS.woundUI];
  const actor = getActorFromToken(tokenObject);
  const hasStaggered = !!actor?.hasCondition?.(STAGGERED_CONDITION);

  const countText = ui._countText;
  const countHitBox = ui._countHitBox;
  const staggerText = ui._staggerText;
  const staggerHitBox = ui._staggerHitBox;
  const attackHitBox = ui._attackHitBox;
  const defenceHitBox = ui._defenceHitBox;
  const attackText = ui._attackText;
  const defenceText = ui._defenceText;

  try {
    countText.text = `W:${count}`;
    staggerText.text = "STAG";
    attackText.text = "ATK";
    defenceText.text = "DEF";
  } catch (_error) {
    clearDisplayObject(ui);
    delete tokenObject[KEYS.woundUI];
    return updateWoundControlUI(tokenObject);
  }

  const padX = 5;
  const padY = 3;
  const rowGap = Math.max(18, countText.height + 4);
  const topY = -(rowGap / 2);
  const bottomY = topY + rowGap;
  const leftTopY = topY;
  const leftBottomY = bottomY;

  drawHitBoxRect(
    countHitBox,
    -padX,
    topY - (countText.height / 2) - padY,
    countText.width + (padX * 2),
    countText.height + (padY * 2)
  );
  drawHitBoxRect(
    staggerHitBox,
    -padX,
    bottomY - (staggerText.height / 2) - padY,
    staggerText.width + (padX * 2),
    staggerText.height + (padY * 2)
  );

  ui.position.set(tokenObject.x + tokenObject.w + 6, tokenObject.y + (tokenObject.h / 2));
  countText.position.set(0, topY);
  staggerText.position.set(0, bottomY);

  const leftX = -(tokenObject.w + 10);
  attackText.position.set(leftX, leftTopY);
  defenceText.position.set(leftX, leftBottomY);

  drawHitBoxRect(
    attackHitBox,
    leftX - attackText.width - padX,
    leftTopY - (attackText.height / 2) - padY,
    attackText.width + (padX * 2),
    attackText.height + (padY * 2)
  );
  drawHitBoxRect(
    defenceHitBox,
    leftX - defenceText.width - padX,
    leftBottomY - (defenceText.height / 2) - padY,
    defenceText.width + (padX * 2),
    defenceText.height + (padY * 2)
  );

  const editable = canEditActor(actor);
  countText.alpha = editable ? 1 : 0.45;
  staggerText.alpha = editable ? 1 : 0.45;
  staggerText.style.fill = hasStaggered ? "#f5e8c8" : "#9f9f9f";
  attackText.alpha = 1;
  defenceText.alpha = 1;
  ui.visible = tokenObject.visible;
}

function clearAllWoundControls() {
  forEachSceneToken((token) => {
    const ui = token[KEYS.woundUI];
    if (!ui) return;
    clearDisplayObject(ui);
    delete token[KEYS.woundUI];
  });

  const orphaned = [];
  for (const child of canvas.tokens.children ?? []) {
    const marked = child?.[KEYS.woundUiMarker] === true;
    const legacyLikelyWoundUi = child?._countText && child?._attackText && child?._defenceText;
    if (marked || legacyLikelyWoundUi) orphaned.push(child);
  }
  for (const ui of orphaned) clearDisplayObject(ui);
}

function updateResilienceLabel(tokenObject) {
  if (!tokenObject || tokenObject.destroyed) return;

  const resilience = getResilienceValue(tokenObject.document);
  if (resilience === null || resilience === undefined) {
    const label = tokenObject[KEYS.resilienceLabel];
    if (!label) return;
    tokenObject.removeChild(label);
    label.destroy();
    delete tokenObject[KEYS.resilienceLabel];
    return;
  }

  let label = tokenObject[KEYS.resilienceLabel];
  if (!label) {
    label = new PreciseTextClass("", getResilienceStyle());
    label.anchor.set(0.5, 1);
    tokenObject.addChild(label);
    tokenObject[KEYS.resilienceLabel] = label;
  }

  label.text = `RES ${resilience}`;
  label.position.set(tokenObject.w / 2, -2);
  label.visible = tokenObject.visible;
}

function clearAllResilienceLabels() {
  forEachSceneToken((token) => {
    const label = token[KEYS.resilienceLabel];
    if (!label) return;
    token.removeChild(label);
    label.destroy();
    delete token[KEYS.resilienceLabel];
  });
}

function getIconSrc(displayObject) {
  return (
    displayObject?.texture?.baseTexture?.resource?.source?.src ||
    displayObject?.texture?.baseTexture?.resource?.url ||
    displayObject?.texture?.baseTexture?.resource?.src ||
    ""
  );
}

function getStatusBgRule(sprite) {
  if (!sprite?.texture) return false;
  const src = String(getIconSrc(sprite)).toLowerCase();
  return STATUS_BG_RULES.find((rule) => src.includes(rule.iconPart)) ?? null;
}

function clearStaggeredGraphics(token) {
  const layer = token?.[KEYS.staggerLayer];
  if (!layer) return;
  layer.removeChildren().forEach((child) => child.destroy());
}

function ensureStaggerLayer(token) {
  if (!token) return null;
  const effects = token.effects;
  if (!effects) return null;

  let layer = token[KEYS.staggerLayer];
  if (!layer) {
    layer = new PIXI.Container();
    layer.eventMode = "none";
    layer.interactiveChildren = false;
    token[KEYS.staggerLayer] = layer;
  }

  const effectsIndex = token.getChildIndex(effects);
  const layerIndex = Math.max(0, effectsIndex - 1);
  if (layer.parent !== token) token.addChildAt(layer, layerIndex);
  else token.setChildIndex(layer, layerIndex);
  return layer;
}

function removeStaggerLayer(token) {
  const layer = token?.[KEYS.staggerLayer];
  if (!layer) return;
  layer.removeChildren().forEach((child) => child.destroy());
  layer.parent?.removeChild(layer);
  layer.destroy();
  delete token[KEYS.staggerLayer];
}

function applyStaggeredBackground(token) {
  if (!token || token[KEYS.staggerApplying]) return;
  const effects = token.effects;
  if (!effects?.children) return;

  token[KEYS.staggerApplying] = true;
  try {
    const highlightedSprites = effects.children
      .map((sprite) => ({ sprite, rule: getStatusBgRule(sprite) }))
      .filter((entry) => entry.rule);
    const layer = ensureStaggerLayer(token);
    if (!layer) return;
    layer.position.set(effects.x, effects.y);

    if (highlightedSprites.length === 0) {
      if (token[KEYS.staggerSignature] !== "") {
        clearStaggeredGraphics(token);
        token[KEYS.staggerSignature] = "";
      }
      layer.visible = false;
      return;
    }

    const signature = highlightedSprites
      .map((entry) => `${entry.rule.id}:${entry.sprite.x},${entry.sprite.y},${entry.sprite.width},${entry.sprite.height}`)
      .join("|");
    if (token[KEYS.staggerSignature] === signature) {
      layer.visible = true;
      return;
    }

    clearStaggeredGraphics(token);
    layer.visible = true;

    for (const entry of highlightedSprites) {
      const sprite = entry.sprite;
      const bg = new PIXI.Graphics();
      bg.beginFill(entry.rule.color, entry.rule.alpha);
      bg.drawRoundedRect(
        sprite.x - 1,
        sprite.y - 1,
        Math.max(2, sprite.width + 2),
        Math.max(2, sprite.height + 2),
        4
      );
      bg.endFill();
      layer.addChild(bg);
    }

    token[KEYS.staggerSignature] = signature;
  } finally {
    token[KEYS.staggerApplying] = false;
  }
}

function clearStaggerTimers(token) {
  const timers = token?.[KEYS.staggerTimers];
  if (!Array.isArray(timers)) return;
  for (const timer of timers) clearTimeout(timer);
  token[KEYS.staggerTimers] = [];
}

function scheduleStaggerRefresh(token) {
  if (!token) return;

  const layer = token[KEYS.staggerLayer];
  if (layer) {
    clearStaggeredGraphics(token);
    layer.visible = false;
    token[KEYS.staggerSignature] = "";
  }

  clearStaggerTimers(token);
  if (!Array.isArray(token[KEYS.staggerTimers])) token[KEYS.staggerTimers] = [];

  const timer = setTimeout(() => {
    applyStaggeredBackground(token);
  }, STAGGER_REFRESH_DELAY_MS);
  token[KEYS.staggerTimers].push(timer);
}

function clearAllStaggerBackgrounds() {
  forEachSceneToken((token) => {
    clearStaggerTimers(token);
    token[KEYS.staggerSignature] = "";
    removeStaggerLayer(token);
  });
}

function refreshTokenOverlay(tokenObject) {
  updateWoundControlUI(tokenObject);
  updateResilienceLabel(tokenObject);
}

function refreshActorOverlays(actor) {
  forEachActorToken(actor, (tokenObject) => {
    refreshTokenOverlay(tokenObject);
    scheduleStaggerRefresh(tokenObject);
  });
}

function refreshAllOverlays() {
  forEachSceneToken((token) => {
    refreshTokenOverlay(token);
    applyStaggeredBackground(token);
  });
}

function registerHooks() {
  return {
    canvasReady: Hooks.on("canvasReady", refreshAllOverlays),
    refreshToken: Hooks.on("refreshToken", (token) => refreshTokenOverlay(token)),
    createItem: Hooks.on("createItem", (item) => {
      if (item.type === WOUND_ITEM_TYPE) refreshActorOverlays(item.parent);
    }),
    updateItem: Hooks.on("updateItem", (item) => {
      if (item.type === WOUND_ITEM_TYPE) refreshActorOverlays(item.parent);
    }),
    deleteItem: Hooks.on("deleteItem", (item) => {
      if (item.type === WOUND_ITEM_TYPE) refreshActorOverlays(item.parent);
    }),
    createActiveEffect: Hooks.on("createActiveEffect", (effect) => refreshActorOverlays(effect?.parent)),
    updateActiveEffect: Hooks.on("updateActiveEffect", (effect) => refreshActorOverlays(effect?.parent)),
    deleteActiveEffect: Hooks.on("deleteActiveEffect", (effect) => refreshActorOverlays(effect?.parent))
  };
}

function unregisterHooks(hookIds) {
  Hooks.off("canvasReady", hookIds.canvasReady);
  Hooks.off("refreshToken", hookIds.refreshToken);
  Hooks.off("createItem", hookIds.createItem);
  Hooks.off("updateItem", hookIds.updateItem);
  Hooks.off("deleteItem", hookIds.deleteItem);
  Hooks.off("createActiveEffect", hookIds.createActiveEffect);
  Hooks.off("updateActiveEffect", hookIds.updateActiveEffect);
  Hooks.off("deleteActiveEffect", hookIds.deleteActiveEffect);
}

if (!game[MODULE_KEY]) {
  game[MODULE_KEY] = {
    ...registerHooks(),
    recentAttacks: new Map(),
    recentTargets: new Map(),
    autoApplyArmed: new Set()
  };
  refreshAllOverlays();
  ui.notifications.info("Overlay enabled: wounds + resilience + status highlights.");
} else {
  const state = game[MODULE_KEY];
  unregisterHooks(state);
  if (state?.staggerWaitPatch && typeof foundry.applications?.api?.Dialog?.wait === "function") {
    foundry.applications.api.Dialog.wait = state.staggerWaitPatch.originalWait;
  }
  delete game[MODULE_KEY];

  clearAllWoundControls();
  clearAllResilienceLabels();
  clearAllStaggerBackgrounds();
  ui.notifications.info("Overlay disabled.");
}
