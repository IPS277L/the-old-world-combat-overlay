// Toggle ATK drag-to-target quick attack (test macro, isolated from overlay-toggle)
// Drag from source token's ATK label and release over another token to quick-roll first attack.

const MODULE_KEY = "towAtkDragTargetToggle";
const UI_KEY = "_towAtkDragUi";
const UI_MARKER_KEY = "_towAtkDragUiMarker";
const UI_TOKEN_ID_KEY = "_towAtkDragTokenId";
const LIB_MACRO_CANDIDATES = ["tow-actions-lib-v1", "tow-actions-lib"];
const PreciseTextClass = foundry.canvas.containers.PreciseText;
const DRAG_LINE_OUTER_COLOR = 0x1A0909;
const DRAG_LINE_OUTER_ALPHA = 0.85;
const DRAG_LINE_OUTER_WIDTH = 7;
const DRAG_LINE_INNER_COLOR = 0xB75B5B;
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

function getLabelStyle() {
  const style = CONFIG.canvasTextStyle?.clone?.() ?? new PIXI.TextStyle();
  style.fontFamily = "CaslonPro";
  style.fontSize = 22;
  style.fill = "#f5e8c8";
  style.stroke = "#111111";
  style.strokeThickness = 4;
  style.dropShadow = false;
  style.align = "right";
  return style;
}

async function ensureTowActions() {
  const hasApi = typeof game.towActions?.attackActor === "function";
  if (hasApi) return true;

  const libMacro = LIB_MACRO_CANDIDATES.map((name) => game.macros.getName(name)).find(Boolean);
  if (!libMacro) {
    ui.notifications.error(`Shared actions macro not found. Tried: ${LIB_MACRO_CANDIDATES.join(", ")}`);
    return false;
  }

  try {
    await libMacro.execute();
  } catch (error) {
    console.error("[attack-drag-target-toggle] Failed to execute shared actions macro.", error);
    ui.notifications.error("Failed to load shared actions macro.");
    return false;
  }

  return typeof game.towActions?.attackActor === "function";
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

  // Single call to avoid duplicate target update side effects.
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

  // Keep map small over time.
  if (state.recentAttacks.size > 100) {
    for (const [mapKey, ts] of state.recentAttacks.entries()) {
      if (now - Number(ts) > ATTACK_DEDUPE_WINDOW_MS * 3) state.recentAttacks.delete(mapKey);
    }
  }

  return true;
}

function armDefaultStaggerChoiceWound(actors, durationMs = AUTO_STAGGER_PATCH_MS) {
  const state = game[MODULE_KEY];
  const DialogApi = foundry.applications?.api?.Dialog;
  if (!state || typeof DialogApi?.wait !== "function") {
    return () => {};
  }

  if (!state.staggerWaitPatch) {
    const originalWait = DialogApi.wait.bind(DialogApi);
    state.staggerWaitPatch = {
      originalWait,
      refs: 0
    };

    DialogApi.wait = async (config, options) => {
      const title = String(config?.window?.title ?? "");
      const content = String(config?.content ?? "");

      const actions = Array.isArray(config?.buttons)
        ? config.buttons.map((b) => String(b?.action ?? ""))
        : Object.values(config?.buttons ?? {}).map((b) => String(b?.action ?? ""));

      const hasStaggerChoices = actions.includes("wound")
        && (actions.includes("prone") || actions.includes("give"));

      const lowerTitle = title.toLowerCase();
      const lowerContent = content.toLowerCase();
      const likelyStaggerText = lowerTitle.includes("stagger")
        || lowerContent.includes("stagger")
        || lowerContent.includes("choose from the following options");

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
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  const hookId = Hooks.on("createChatMessage", async (message) => {
    if (message?.type !== "opposed") return;
    const defenderTokenId = message.system?.defender?.token;
    if (defenderTokenId !== targetToken.id) return;

    const attackerMessage = game.messages.get(message.system?.attackerMessage);
    const attackerActorUuid = attackerMessage?.system?.test?.actor;
    if (attackerActorUuid && attackerActorUuid !== sourceToken.actor.uuid) return;

    cleanup(hookId);

    const ready = await ensureTowActions();
    if (!ready) return;

    // Race guard: defender must have this opposed message registered before rolling defence.
    // Otherwise defence test may not bind as a response.
    const started = Date.now();
    while (Date.now() - started < OPPOSED_LINK_WAIT_MS) {
      const opposedId = targetToken.actor.system?.opposed?.id;
      if (opposedId === message.id) break;
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

  let applying = false;
  let separatorPosted = false;

  const cleanup = () => {
    if (state?.autoApplyArmed) state.autoApplyArmed.delete(opposedMessage.id);
  };

  const postSeparatorOnce = async (opposed) => {
    if (separatorPosted) return;
    separatorPosted = true;
    const sourceStatusHints = await deriveSourceStatusHints(sourceActor, sourceBeforeState);
    await postFlowSeparatorCard(opposed, { sourceStatusHints, targetStatusHints: [] });
  };

  void (async () => {
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
      if (!defenderActor?.isOwner) {
        await postSeparatorOnce(opposed);
        break;
      }
      if (applying) {
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
      // Some status effects (e.g. dead from wound threshold scripts) can land a tick later.
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
    ? opposed.attackerTest.damageEffects
        .flatMap((effect) => Array.from(effect?.statuses ?? []))
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
  const targetStatusText = targetStatusLabels.length ? targetStatusLabels.join(", ") : "None";
  const sourceStatusText = sourceStatusLabels.length ? sourceStatusLabels.join(", ") : "None";

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

async function applyDamageWithWoundsFallback(defenderActor, damageValue, context) {
  const system = defenderActor?.system;
  if (!system || typeof system.applyDamage !== "function") return;

  const originalAddWound = (typeof system.addWound === "function") ? system.addWound.bind(system) : null;
  if (!originalAddWound) {
    await system.applyDamage(damageValue, context);
    return;
  }

  system.addWound = async function wrappedAddWound(options = {}) {
    const beforeCount = Number(this.parent?.itemTypes?.wound?.length ?? 0);
    const tableId = game.settings.get("whtow", "tableSettings")?.wounds;
    const hasTable = !!(tableId && game.tables.get(tableId));

    const fallbackGenericWound = async () => {
      const afterCount = Number(this.parent?.itemTypes?.wound?.length ?? 0);
      if (afterCount > beforeCount) return null;
      ui.notifications.warn("Wounds table missing. Applied generic Wound.");
      return this.parent.createEmbeddedDocuments("Item", [{ type: "wound", name: "Wound" }]);
    };

    // Prevent noisy system error by bypassing table roll when no wounds table is configured.
    if (!hasTable) return fallbackGenericWound();

    try {
      const result = await originalAddWound(options);
      return result;
    } catch (error) {
      const message = String(error?.message ?? error ?? "");
      if (message.includes("No table found for wounds")) {
        console.warn("[attack-drag-target-toggle] Wounds table missing, using generic wound fallback.");
        return fallbackGenericWound();
      }
      throw error;
    }
  };

  try {
    await system.applyDamage(damageValue, context);
  } finally {
    system.addWound = originalAddWound;
  }
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

  // Outline pass keeps the line legible on busy maps and token art.
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

  // Source marker: outlined ring + inner core, clearer than a flat filled dot.
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

function createAtkUi(tokenObject) {
  if (!tokenObject) return null;

  // Defensive cleanup: if a stale UI for this token exists on canvas root, remove it first.
  for (const child of canvas.tokens.children ?? []) {
    if (child?.[UI_MARKER_KEY] === true && child?.[UI_TOKEN_ID_KEY] === tokenObject.id) {
      child.parent?.removeChild(child);
      child.destroy({ children: true });
    }
  }

  const container = new PIXI.Container();
  container.eventMode = "passive";
  container.interactiveChildren = true;
  container[UI_MARKER_KEY] = true;
  container[UI_TOKEN_ID_KEY] = tokenObject.id;

  const text = new PreciseTextClass("ATK", getLabelStyle());
  text.anchor.set(1, 0.5);
  text.eventMode = "none";

  const hitBox = new PIXI.Graphics();
  hitBox.eventMode = "static";
  hitBox.interactive = true;
  hitBox.buttonMode = true;
  hitBox.cursor = "grab";

  hitBox.on("pointerdown", (event) => {
    if ((event.button ?? event.data?.button ?? event.nativeEvent?.button ?? 0) !== 0) return;
    event.stopPropagation();
    event.nativeEvent?.preventDefault?.();

    hitBox.cursor = "grabbing";
    const sourceToken = tokenObject;
    const origin = {
      x: sourceToken.x + (sourceToken.w / 2),
      y: sourceToken.y + (sourceToken.h / 2)
    };
    const dragLine = createDragLine();
    const startPoint = getWorldPoint(event) ?? origin;
    drawDragLine(dragLine, origin, startPoint);

    const onDragMove = (moveEvent) => {
      const point = getWorldPoint(moveEvent);
      if (!point) return;
      drawDragLine(dragLine, origin, point);
    };

    let dragFinished = false;

    const cleanupDrag = () => {
      canvas.stage.off("pointermove", onDragMove);
      canvas.stage.off("pointerup", finishDrag);
      canvas.stage.off("pointerupoutside", finishDrag);
      clearDragLine(dragLine);
      hitBox.cursor = "grab";
    };

    const finishDrag = async (upEvent) => {
      if (dragFinished) return;
      dragFinished = true;
      cleanupDrag();
      const point = getWorldPoint(upEvent);
      const target = tokenAtPoint(point, { excludeTokenId: sourceToken.id });
      if (!target) return;
      if (!shouldRunDragAttack(sourceToken, target)) return;

      const ready = await ensureTowActions();
      if (!ready) return;

      const restoreStaggerPrompt = armDefaultStaggerChoiceWound(
        [sourceToken.actor, target.actor],
        AUTO_STAGGER_PATCH_MS
      );

      const sourceBeforeState = snapshotActorState(sourceToken.actor);
      setSingleTarget(target);
      armAutoDefenceForOpposed(sourceToken, target, { sourceBeforeState });
      try {
        await game.towActions.attackActor(sourceToken.actor, { manual: false });
      } finally {
        // Leave patched briefly for defence/apply-damage chain, then restore.
        setTimeout(() => restoreStaggerPrompt(), AUTO_APPLY_WAIT_MS);
      }
    };

    canvas.stage.on("pointermove", onDragMove);
    canvas.stage.on("pointerup", finishDrag);
    canvas.stage.on("pointerupoutside", finishDrag);
  });

  hitBox.on("contextmenu", (event) => {
    event.stopPropagation();
    event.nativeEvent?.preventDefault?.();
  });

  container.addChild(hitBox);
  container.addChild(text);
  container._text = text;
  container._hitBox = hitBox;

  canvas.tokens.addChild(container);
  tokenObject[UI_KEY] = container;
  return container;
}

function updateAtkUi(tokenObject) {
  if (!tokenObject || tokenObject.destroyed) return;
  const existing = tokenObject[UI_KEY];
  const ui = (!existing || existing.destroyed) ? createAtkUi(tokenObject) : existing;
  if (!ui) return;
  const text = ui._text;
  const hitBox = ui._hitBox;

  const padX = 6;
  const padY = 4;
  const x = tokenObject.x - 10;
  const y = tokenObject.y + tokenObject.h / 2;
  const textY = 0;

  ui.position.set(x, y);
  text.position.set(0, textY);

  const width = text.width + padX * 2;
  const height = text.height + padY * 2;
  hitBox.clear();
  hitBox.beginFill(0x000000, 0.001);
  hitBox.drawRoundedRect(-width, textY - (text.height / 2) - padY, width, height, 6);
  hitBox.endFill();

  ui.visible = tokenObject.visible;
}

function clearAllUi() {
  for (const token of canvas.tokens.placeables) {
    const ui = token[UI_KEY];
    if (!ui) continue;
    ui.parent?.removeChild(ui);
    ui.destroy({ children: true });
    delete token[UI_KEY];
  }

  // Cleanup safety for orphaned UI containers from earlier versions.
  const toRemove = [];
  for (const child of canvas.tokens.children ?? []) {
    const marked = child?.[UI_MARKER_KEY] === true;
    const legacyLikelyAtkUi = child?._text?.text === "ATK" && child?._hitBox instanceof PIXI.Graphics;
    if (marked || legacyLikelyAtkUi) toRemove.push(child);
  }
  for (const ui of toRemove) {
    ui.parent?.removeChild(ui);
    ui.destroy({ children: true });
  }
}

function refreshAll() {
  for (const token of canvas.tokens.placeables) {
    updateAtkUi(token);
  }
}

if (!game[MODULE_KEY]) {
  const hooks = {
    canvasReady: Hooks.on("canvasReady", refreshAll),
    refreshToken: Hooks.on("refreshToken", (token) => updateAtkUi(token))
  };
  game[MODULE_KEY] = {
    ...hooks,
    recentAttacks: new Map(),
    recentTargets: new Map(),
    autoApplyArmed: new Set()
  };
  refreshAll();
  ui.notifications.info("ATK drag-to-target enabled (test). Drag ATK to another token and release.");
} else {
  const hooks = game[MODULE_KEY];
  Hooks.off("canvasReady", hooks.canvasReady);
  Hooks.off("refreshToken", hooks.refreshToken);
  delete game[MODULE_KEY];
  clearAllUi();
  ui.notifications.info("ATK drag-to-target disabled.");
}
