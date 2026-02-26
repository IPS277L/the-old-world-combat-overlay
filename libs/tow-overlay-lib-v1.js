// Toggle Overlay (Foundry V13)
// Combines:
// 1) Wound controls (W left click add, right click remove)
// 2) STAG text toggle control
// 3) RES label above token
// 4) Status icon backgrounds (yellow staggered, gray dead)

const MODULE_KEY = "towMacroToggleOverlay";
const PreciseTextClass = foundry.canvas.containers.PreciseText;
const LIB_MACRO_CANDIDATES = ["tow-actions-lib-v1", "tow-actions-lib"];
const ACTIONS_RUNTIME_PARTS = [
  "tow-actions-runtime-part-00-core-v1",
  "tow-actions-runtime-part-10-attack-flow-v1",
  "tow-actions-runtime-part-20-defence-flow-v1",
  "tow-actions-runtime-part-30-api-v1"
];
const ACTIONS_RUNTIME_LOADER_CANDIDATES = ["tow-actions-runtime-loader-v1"];

const KEYS = {
  woundUI: "_towWoundControlUI",
  woundUiMarker: "_towOverlayWoundUiMarker",
  woundUiTokenId: "_towOverlayWoundUiTokenId",
  nameLabel: "_towNameLabel",
  nameLabelMarker: "_towOverlayNameLabelMarker",
  nameLabelTokenId: "_towOverlayNameLabelTokenId",
  resilienceLabel: "_towResilienceLabel",
  defaultEffectsVisible: "_towDefaultEffectsVisible",
  statusPaletteLayer: "_towStatusPaletteLayer",
  statusPaletteMarker: "_towOverlayStatusPaletteMarker",
  statusPaletteTokenId: "_towOverlayStatusPaletteTokenId",
  statusPaletteMetrics: "_towStatusPaletteMetrics",
  deadVisualState: "_towDeadVisualState",
  statusIconHandler: "_towStatusIconHandler",
  statusIconTooltipOverHandler: "_towStatusIconTooltipOverHandler",
  statusIconTooltipMoveHandler: "_towStatusIconTooltipMoveHandler",
  statusIconTooltipOutHandler: "_towStatusIconTooltipOutHandler",
  tokenInteractiveChildrenOriginal: "_towTokenInteractiveChildrenOriginal",
  tokenHitAreaOriginal: "_towTokenHitAreaOriginal",
  coreTooltipVisible: "_towCoreTooltipVisible",
  coreTooltipRenderable: "_towCoreTooltipRenderable",
  coreNameplateVisible: "_towCoreNameplateVisible",
  coreNameplateRenderable: "_towCoreNameplateRenderable",
  coreBorderVisible: "_towCoreBorderVisible",
  coreBorderAlpha: "_towCoreBorderAlpha",
  layoutBorder: "_towLayoutBorder",
  layoutBounds: "_towLayoutBounds"
};

const STATUS_PALETTE_ICON_SIZE = 20;
const STATUS_PALETTE_ICON_GAP = 2;
const STATUS_PALETTE_ROWS = 2;
const TOKEN_CONTROL_PAD = 6;
const NAME_TYPE_STACK_OVERLAP_PX = 13;
const NAME_TYPE_TO_TOKEN_OFFSET_PX = 6;
const STATUS_PALETTE_TOKEN_PAD = TOKEN_CONTROL_PAD;
const STATUS_PALETTE_INACTIVE_TINT = 0x7A7A7A;
const STATUS_PALETTE_ACTIVE_TINT = 0xFFFFFF;
const STATUS_PALETTE_STAGGERED_RING = 0xFFD54A;
const STATUS_PALETTE_DEAD_RING = 0xFFFFFF;
const STATUS_PALETTE_SPECIAL_BG_PAD = 1;
const STATUS_PALETTE_SPECIAL_BG_RADIUS = 3;
const STATUS_PALETTE_SPECIAL_BG_OUTLINE = 0x171717;
const STATUS_PALETTE_SPECIAL_BG_OUTLINE_WIDTH = 1;
const STATUS_PALETTE_SPECIAL_BG_OUTLINE_ALPHA = 0.72;
const STATUS_PALETTE_SPECIAL_BG_STAGGERED_ALPHA = 0.58;
const STATUS_PALETTE_SPECIAL_BG_DEAD_ALPHA = 0.62;
const LAYOUT_BORDER_COLOR = 0xE39A1A;
const LAYOUT_BORDER_ALPHA = 1;
const LAYOUT_BORDER_WIDTH = 2;
const LAYOUT_BORDER_RADIUS = 6;
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
const ACTOR_OVERLAY_RESYNC_DELAYS_MS = [50, 180];
const DEAD_SYNC_DEBOUNCE_MS = 60;
const DEAD_TO_WOUND_SYNC_DEBOUNCE_MS = 80;
const STATUS_TOOLTIP_FONT_SIZE = 14;
const STATUS_TOOLTIP_MAX_WIDTH = 260;
const STATUS_TOOLTIP_PAD_X = 8;
const STATUS_TOOLTIP_PAD_Y = 6;
const STATUS_TOOLTIP_OFFSET_X = 12;
const STATUS_TOOLTIP_OFFSET_Y = 12;
const STATUS_TOOLTIP_BG_COLOR = 0x0F0C09;
const STATUS_TOOLTIP_BG_ALPHA = 0.94;
const STATUS_TOOLTIP_BORDER_COLOR = 0xC18B2C;
const STATUS_TOOLTIP_BORDER_ALPHA = 0.9;
const STATUS_TOOLTIP_DOM_CLASS = "tow-overlay-status-tooltip";
const OVERLAY_TEXT_RESOLUTION_MIN = 3;
const OVERLAY_TEXT_RESOLUTION_MAX = 8;
const OVERLAY_CONTROL_ICON_TINT = 0xFFF4D8;
const OVERLAY_CONTROL_ICON_OUTLINE_COLOR = 0x2A2620;
const OVERLAY_CONTROL_ICON_OUTLINE_THICKNESS = 1.4;
const OVERLAY_CONTROL_ICON_OUTLINE_ALPHA = 0.58;

const WOUND_ITEM_TYPE = "wound";
const ICON_SRC_ATK = "icons/svg/sword.svg";
const ICON_SRC_DEF = "icons/svg/shield.svg";
const ICON_SRC_WOUND = "icons/svg/blood.svg";
const ICON_SRC_RES = "icons/svg/statue.svg";

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

function getActorTokenObjects(actor) {
  const seen = new Set();
  const tokens = [];
  forEachActorToken(actor, (tokenObject) => {
    if (!tokenObject?.id || seen.has(tokenObject.id)) return;
    seen.add(tokenObject.id);
    tokens.push(tokenObject);
  });

  const syntheticToken = asTokenObject(actor?.token);
  if (syntheticToken?.id && !seen.has(syntheticToken.id)) {
    seen.add(syntheticToken.id);
    tokens.push(syntheticToken);
  }

  return tokens;
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

function getScreenPoint(event) {
  return event?.global ?? event?.data?.global ?? null;
}

function getTooltipPointFromEvent(event) {
  return getScreenPoint(event) ?? getWorldPoint(event);
}

function bindTooltipHandlers(displayObject, getTooltipData, keyStore = null) {
  if (!displayObject || typeof getTooltipData !== "function") return null;

  const onShow = (event) => {
    const point = getTooltipPointFromEvent(event);
    if (!point) return;
    const data = getTooltipData(event) ?? {};
    const title = data.title ?? data.name ?? "";
    const description = data.description ?? "No description.";
    if (!title) return;
    showOverlayTooltip(title, description, point);
  };
  const onHide = () => hideStatusTooltip();

  displayObject.on("pointerover", onShow);
  displayObject.on("pointermove", onShow);
  displayObject.on("pointerout", onHide);
  displayObject.on("pointerupoutside", onHide);
  displayObject.on("pointercancel", onHide);

  if (keyStore?.over) displayObject[keyStore.over] = onShow;
  if (keyStore?.move) displayObject[keyStore.move] = onShow;
  if (keyStore?.out) displayObject[keyStore.out] = onHide;
  return { onShow, onHide };
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

async function executeFirstMacroByNameCandidates(candidates) {
  const macro = candidates
    .map((name) => game.macros.getName(name))
    .find(Boolean);
  if (!macro) return false;
  await macro.execute();
  return true;
}

async function ensureTowActionsRuntime() {
  for (const macroName of ACTIONS_RUNTIME_PARTS) {
    const macro = game.macros.getName(macroName);
    if (!macro) return false;
    await macro.execute();
  }
  return executeFirstMacroByNameCandidates(ACTIONS_RUNTIME_LOADER_CANDIDATES);
}

async function ensureTowActions() {
  const hasApi = typeof game.towActions?.attackActor === "function" &&
    typeof game.towActions?.defenceActor === "function" &&
    typeof game.towActions?.isShiftHeld === "function";
  if (hasApi) return true;

  try {
    await ensureTowActionsRuntime();
  } catch (error) {
    console.error("[overlay-toggle] Failed to execute actions runtime macros.", error);
  }

  let loaded = typeof game.towActions?.attackActor === "function" &&
    typeof game.towActions?.defenceActor === "function" &&
    typeof game.towActions?.isShiftHeld === "function";
  if (loaded) return true;

  try {
    const legacyLoaded = await executeFirstMacroByNameCandidates(LIB_MACRO_CANDIDATES);
    if (!legacyLoaded) {
      const attempted = [...ACTIONS_RUNTIME_PARTS, ...ACTIONS_RUNTIME_LOADER_CANDIDATES, ...LIB_MACRO_CANDIDATES];
      ui.notifications.error(`Shared actions macro not found. Tried: ${attempted.join(", ")}`);
      return false;
    }
  } catch (error) {
    console.error("[overlay-toggle] Failed to execute shared actions macro.", error);
    ui.notifications.error("Failed to load shared actions macro.");
    return false;
  }

  loaded = typeof game.towActions?.attackActor === "function" &&
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
    const tableId = game.settings.get("whtow", "tableSettings")?.wounds;
    const hasTable = !!(tableId && game.tables.get(tableId));

    if (!hasTable) {
      // Keep system wound/death scripts; only bypass table rolling.
      return originalAddWound({ ...options, roll: false });
    }
    try {
      return await originalAddWound(options);
    } catch (error) {
      const message = String(error?.message ?? error ?? "");
      if (message.includes("No table found for wounds")) {
        return originalAddWound({ ...options, roll: false });
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

function ensureTokenOverlayInteractivity(tokenObject) {
  if (!tokenObject || tokenObject.destroyed) return;
  if (typeof tokenObject[KEYS.tokenInteractiveChildrenOriginal] === "undefined") {
    tokenObject[KEYS.tokenInteractiveChildrenOriginal] = tokenObject.interactiveChildren === true;
  }
  if (typeof tokenObject[KEYS.tokenHitAreaOriginal] === "undefined") {
    tokenObject[KEYS.tokenHitAreaOriginal] = tokenObject.hitArea ?? null;
  }
  tokenObject.interactiveChildren = true;
}

function updateTokenOverlayHitArea(tokenObject) {
  if (!tokenObject || tokenObject.destroyed) return;
  const points = [
    { x: 0, y: 0 },
    { x: tokenObject.w, y: 0 },
    { x: 0, y: tokenObject.h },
    { x: tokenObject.w, y: tokenObject.h }
  ];
  const overlayChildren = [
    tokenObject[KEYS.woundUI],
    tokenObject[KEYS.nameLabel],
    tokenObject[KEYS.resilienceLabel],
    tokenObject[KEYS.statusPaletteLayer]
  ].filter((child) => child && !child.destroyed);

  for (const child of overlayChildren) {
    const bounds = child.getBounds?.();
    if (!bounds) continue;
    const corners = [
      { x: bounds.x, y: bounds.y },
      { x: bounds.x + bounds.width, y: bounds.y },
      { x: bounds.x, y: bounds.y + bounds.height },
      { x: bounds.x + bounds.width, y: bounds.y + bounds.height }
    ];
    for (const corner of corners) {
      const local = tokenObject.toLocal(corner);
      points.push({ x: local.x, y: local.y });
    }
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) return;
  const pad = 3;
  const hitBounds = {
    x: minX - pad,
    y: minY - pad,
    width: Math.max(1, (maxX - minX) + (pad * 2)),
    height: Math.max(1, (maxY - minY) + (pad * 2))
  };
  tokenObject.hitArea = new PIXI.Rectangle(
    hitBounds.x,
    hitBounds.y,
    hitBounds.width,
    hitBounds.height
  );
  tokenObject[KEYS.layoutBounds] = { ...hitBounds };
  drawCustomLayoutBorder(tokenObject);
}

function restoreTokenOverlayInteractivity(tokenObject) {
  if (!tokenObject || tokenObject.destroyed) return;
  const prior = tokenObject[KEYS.tokenInteractiveChildrenOriginal];
  if (typeof prior !== "boolean") return;
  tokenObject.interactiveChildren = prior;
  delete tokenObject[KEYS.tokenInteractiveChildrenOriginal];
  if (KEYS.tokenHitAreaOriginal in tokenObject) {
    tokenObject.hitArea = tokenObject[KEYS.tokenHitAreaOriginal];
    delete tokenObject[KEYS.tokenHitAreaOriginal];
  }
}

function ensureCustomLayoutBorder(tokenObject) {
  if (!tokenObject || tokenObject.destroyed) return null;
  let border = tokenObject[KEYS.layoutBorder];
  if (!border || border.destroyed || border.parent !== tokenObject) {
    if (border && !border.destroyed) clearDisplayObject(border);
    border = new PIXI.Graphics();
    border.eventMode = "none";
    tokenObject.addChild(border);
    tokenObject[KEYS.layoutBorder] = border;
  }
  return border;
}

function drawCustomLayoutBorder(tokenObject) {
  if (!tokenObject || tokenObject.destroyed) return;
  const border = ensureCustomLayoutBorder(tokenObject);
  if (!border) return;
  const bounds = tokenObject[KEYS.layoutBounds];
  border.clear();
  if (!bounds) return;
  border.lineStyle({
    width: LAYOUT_BORDER_WIDTH,
    color: LAYOUT_BORDER_COLOR,
    alpha: LAYOUT_BORDER_ALPHA,
    alignment: 0.5,
    cap: "round",
    join: "round"
  });
  border.drawRoundedRect(
    bounds.x,
    bounds.y,
    bounds.width,
    bounds.height,
    LAYOUT_BORDER_RADIUS
  );
}

function updateCustomLayoutBorderVisibility(tokenObject, { hovered = null, controlled = null } = {}) {
  if (!tokenObject || tokenObject.destroyed) return;
  const border = ensureCustomLayoutBorder(tokenObject);
  if (!border) return;
  const isHovered = (typeof hovered === "boolean")
    ? hovered
    : (tokenObject.hover === true || tokenObject._hover === true);
  const isControlled = (typeof controlled === "boolean")
    ? controlled
    : (tokenObject.controlled === true || tokenObject._controlled === true);
  border.visible = tokenObject.visible && (isHovered || isControlled);
}

function clearCustomLayoutBorder(tokenObject) {
  const border = tokenObject?.[KEYS.layoutBorder];
  if (border) clearDisplayObject(border);
  delete tokenObject?.[KEYS.layoutBorder];
  delete tokenObject?.[KEYS.layoutBounds];
}

async function bringTokenToFront(tokenObject) {
  if (!tokenObject || tokenObject.destroyed) return;
  const tokenDocument = tokenObject.document ?? null;
  if (tokenDocument?.isOwner && typeof tokenDocument.update === "function") {
    const sorts = (canvas?.tokens?.placeables ?? [])
      .map((token) => Number(token?.document?.sort ?? NaN))
      .filter((value) => Number.isFinite(value));
    const highestSort = sorts.length ? Math.max(...sorts) : Number(tokenDocument.sort ?? 0);
    const currentSort = Number(tokenDocument.sort ?? 0);
    if (Number.isFinite(highestSort) && currentSort <= highestSort) {
      if (currentSort < highestSort) {
        await tokenDocument.update({ sort: highestSort + 1 });
      }
      return;
    }
  }

  const layer = tokenObject.layer ?? canvas?.tokens;

  if (typeof layer?.bringToFront === "function") {
    layer.bringToFront(tokenObject);
    return;
  }

  if (typeof tokenObject.bringToFront === "function") {
    tokenObject.bringToFront();
    return;
  }

  const parent = tokenObject.parent;
  if (!parent || typeof parent.setChildIndex !== "function" || !Array.isArray(parent.children)) return;
  const topIndex = Math.max(0, parent.children.length - 1);
  const currentIndex = typeof parent.getChildIndex === "function"
    ? parent.getChildIndex(tokenObject)
    : -1;
  if (currentIndex === topIndex) return;
  parent.setChildIndex(tokenObject, topIndex);
}

function getDeadFilterTargets(tokenObject) {
  return [tokenObject?.mesh, tokenObject?.icon].filter(Boolean);
}

function ensureDeadVisual(tokenObject) {
  if (!tokenObject) return;
  const hasDead = !!tokenObject.document?.actor?.hasCondition?.("dead");
  if (!hasDead) {
    clearDeadVisual(tokenObject);
    return;
  }
  // Rebuild each refresh so tweaks to filter settings apply immediately.
  if (tokenObject[KEYS.deadVisualState]) clearDeadVisual(tokenObject);

  const targets = getDeadFilterTargets(tokenObject);
  const entries = [];

  for (const displayObject of targets) {
    const originalFilters = Array.isArray(displayObject.filters) ? [...displayObject.filters] : [];
    const originalAlpha = Number(displayObject.alpha ?? 1);
    const originalTint = Number(displayObject.tint ?? 0xFFFFFF);
    const deadFilter = new PIXI.ColorMatrixFilter();
    deadFilter.brightness(0.70, false);
    displayObject.alpha = Math.max(0.92, originalAlpha);
    if ("tint" in displayObject) displayObject.tint = 0x5A5A5A;
    displayObject.filters = [...originalFilters, deadFilter];
    entries.push({ displayObject, originalFilters, deadFilter, originalAlpha, originalTint });
  }

  tokenObject[KEYS.deadVisualState] = { entries };
}

function clearDeadVisual(tokenObject) {
  const state = tokenObject?.[KEYS.deadVisualState];
  if (!state) return;

  for (const entry of state.entries ?? []) {
    const displayObject = entry?.displayObject;
    if (!displayObject || displayObject.destroyed) continue;
    displayObject.filters = Array.isArray(entry.originalFilters) ? entry.originalFilters : null;
    if (typeof entry.originalAlpha === "number") displayObject.alpha = entry.originalAlpha;
    if (typeof entry.originalTint === "number" && "tint" in displayObject) displayObject.tint = entry.originalTint;
  }

  delete tokenObject[KEYS.deadVisualState];
}

function getWoundCount(tokenDocument) {
  const actor = tokenDocument?.actor;
  if (!actor) return null;
  const liveItems = actor.items?.contents ?? [];
  const itemWounds = Array.isArray(liveItems)
    ? liveItems.filter((item) => item.type === WOUND_ITEM_TYPE).length
    : (Array.isArray(actor.itemTypes?.wound) ? actor.itemTypes.wound.length : 0);

  // Minions can become dead via system addWound without creating wound items.
  const isMinion = actor.type === "npc" && actor.system?.type === "minion";
  if (isMinion && actor.hasCondition?.("dead")) return Math.max(1, itemWounds);
  return itemWounds;
}

function getActorWoundItemCount(actor) {
  if (!actor) return 0;
  const items = actor.items?.contents ?? [];
  if (Array.isArray(items)) return items.filter((item) => item.type === WOUND_ITEM_TYPE).length;
  if (Array.isArray(actor.itemTypes?.wound)) return actor.itemTypes.wound.length;
  return 0;
}

function getMaxWoundLimit(actor) {
  if (!actor || actor.type !== "npc") return null;
  if (actor.system?.type === "minion") return 1;
  if (!actor.system?.hasThresholds) return null;

  const defeatedThreshold = Number(actor.system?.wounds?.defeated?.threshold ?? NaN);
  if (!Number.isFinite(defeatedThreshold) || defeatedThreshold <= 0) return null;
  return defeatedThreshold;
}

function isAtWoundCap(actor) {
  const cap = getMaxWoundLimit(actor);
  if (!Number.isFinite(cap)) return false;

  if (actor.system?.type === "minion") {
    if (actor.hasCondition?.("dead")) return true;
  }
  return getActorWoundItemCount(actor) >= cap;
}

async function syncNpcDeadFromWounds(actor) {
  if (!actor || actor.type !== "npc" || !canEditActor(actor)) return;
  if (actor.system?.type === "minion") return;
  if (!actor.system?.hasThresholds || typeof actor.system?.thresholdAtWounds !== "function") return;
  const state = game[MODULE_KEY];
  if (!state) return;
  if (!state.deadSyncInFlight) state.deadSyncInFlight = new Set();

  const actorKey = actor.uuid ?? actor.id;
  if (!actorKey || state.deadSyncInFlight.has(actorKey)) return;
  state.deadSyncInFlight.add(actorKey);

  try {
    const woundCount = getActorWoundItemCount(actor);
    const threshold = actor.system.thresholdAtWounds(woundCount);
    const shouldBeDead = threshold === "defeated";
    const hasDead = !!actor.hasCondition?.("dead");
    if (shouldBeDead === hasDead) return;

    if (shouldBeDead) {
      await runActorOpLock(actor, "condition:dead", async () => {
        if (actor.hasCondition?.("dead")) return;
        await actor.addCondition("dead");
      });
    } else {
      await runActorOpLock(actor, "condition:dead", async () => {
        if (!actor.hasCondition?.("dead")) return;
        await actor.removeCondition("dead");
      });
    }
  } finally {
    state.deadSyncInFlight.delete(actorKey);
  }
}

function queueDeadSyncFromWounds(actor) {
  if (!actor) return;
  const state = game[MODULE_KEY];
  if (!state) return;
  if (!state.deadSyncTimers) state.deadSyncTimers = new Map();

  const actorKey = actor.uuid ?? actor.id;
  if (!actorKey) return;

  const existingTimer = state.deadSyncTimers.get(actorKey);
  if (existingTimer) clearTimeout(existingTimer);

  const timer = setTimeout(() => {
    state.deadSyncTimers.delete(actorKey);
    void syncNpcDeadFromWounds(actor).catch((error) => {
      console.error("[overlay-toggle] Failed to sync dead condition from wounds.", error);
    });
  }, DEAD_SYNC_DEBOUNCE_MS);
  state.deadSyncTimers.set(actorKey, timer);
}

async function syncWoundsFromDeadState(actor) {
  if (!actor || !canEditActor(actor)) return;
  const state = game[MODULE_KEY];
  if (!state) return;
  if (!state.deadPresenceByActor) state.deadPresenceByActor = new Map();

  const actorKey = actor.uuid ?? actor.id;
  if (!actorKey) return;

  const hasDead = !!actor.hasCondition?.("dead");
  const wasDead = state.deadPresenceByActor.get(actorKey) === true;
  state.deadPresenceByActor.set(actorKey, hasDead);

  const cap = getMaxWoundLimit(actor);
  if (!Number.isFinite(cap) || cap <= 0) return;

  if (hasDead) {
    await runActorOpLock(actor, "dead-wound-sync", async () => {
      const current = getActorWoundItemCount(actor);
      const missing = Math.max(0, cap - current);
      if (missing <= 0) return;
      // Create wounds one-by-one to avoid duplicate side-effects from batched creation.
      for (let i = 0; i < missing; i++) {
        await actor.createEmbeddedDocuments("Item", [{ type: WOUND_ITEM_TYPE, name: "Wound" }]);
      }
    }).catch((error) => {
      console.error("[overlay-toggle] Failed to sync wounds from dead condition.", error);
    });
    return;
  }

  if (!wasDead) return;
  // If dead was removed after a wound decrement, preserve current wound count.
  // Only run the legacy "clear all wounds" behavior when still at full cap.
  if (getActorWoundItemCount(actor) < cap) return;
  await runActorOpLock(actor, "dead-wound-sync", async () => {
    const maxPasses = Math.max(1, getActorWoundItemCount(actor) + 2);
    for (let i = 0; i < maxPasses; i++) {
      const wounds = (actor.items?.contents ?? []).filter((item) => item.type === WOUND_ITEM_TYPE);
      if (!wounds.length) break;
      const toDelete = wounds.find((wound) => wound.system?.treated !== true) ?? wounds[wounds.length - 1];
      if (!toDelete?.id || !actor.items.get(toDelete.id)) break;
      await actor.deleteEmbeddedDocuments("Item", [toDelete.id]);
    }
  }).catch((error) => {
    console.error("[overlay-toggle] Failed to clear wounds after removing dead condition.", error);
  });
}

function queueWoundSyncFromDeadState(actor) {
  if (!actor) return;
  const state = game[MODULE_KEY];
  if (!state) return;
  if (!state.deadToWoundSyncTimers) state.deadToWoundSyncTimers = new Map();

  const actorKey = actor.uuid ?? actor.id;
  if (!actorKey) return;

  const existingTimer = state.deadToWoundSyncTimers.get(actorKey);
  if (existingTimer) clearTimeout(existingTimer);

  const timer = setTimeout(() => {
    state.deadToWoundSyncTimers.delete(actorKey);
    void syncWoundsFromDeadState(actor);
  }, DEAD_TO_WOUND_SYNC_DEBOUNCE_MS);
  state.deadToWoundSyncTimers.set(actorKey, timer);
}

function primeDeadPresence(actor) {
  if (!actor) return;
  const state = game[MODULE_KEY];
  if (!state) return;
  if (!state.deadPresenceByActor) state.deadPresenceByActor = new Map();
  const actorKey = actor.uuid ?? actor.id;
  if (!actorKey || state.deadPresenceByActor.has(actorKey)) return;
  state.deadPresenceByActor.set(actorKey, !!actor.hasCondition?.("dead"));
}

function getResilienceValue(tokenDocument) {
  return tokenDocument?.actor?.system?.resilience?.value ?? null;
}

async function addWound(actor) {
  if (!canEditActor(actor)) {
    warnNoPermission(actor);
    return;
  }
  if (isAtWoundCap(actor)) return;
  if (typeof actor.system?.addWound === "function") {
    await actor.system.addWound({ roll: false });
  } else {
    await actor.createEmbeddedDocuments("Item", [{ type: WOUND_ITEM_TYPE, name: "Wound" }]);
  }
}

async function removeWound(actor) {
  if (!canEditActor(actor)) {
    warnNoPermission(actor);
    return;
  }

  await runActorOpLock(actor, "remove-wound", async () => {
    const wounds = (actor.items?.contents ?? []).filter((item) => item.type === WOUND_ITEM_TYPE);
    const isMinion = actor.type === "npc" && actor.system?.type === "minion";
    if (!wounds.length) {
      if (isMinion && actor.hasCondition?.("dead")) {
        await actor.removeCondition("dead");
      }
      return;
    }

    const toDelete = wounds.find((wound) => wound.system?.treated !== true) ?? wounds[wounds.length - 1];
    if (!toDelete?.id) return;
    if (!actor.items.get(toDelete.id)) return;
    await actor.deleteEmbeddedDocuments("Item", [toDelete.id]);

    // Minions can stay flagged dead after last wound is removed; clear dead immediately.
    if (isMinion && actor.hasCondition?.("dead")) {
      const remaining = getActorWoundItemCount(actor);
      if (remaining <= 0) await actor.removeCondition("dead");
    }
  });
}


function getControlStyle() {
  const style = CONFIG.canvasTextStyle?.clone?.() ?? new PIXI.TextStyle();
  style.fontFamily = "CaslonPro";
  style.fontWeight = "700";
  style.fontSize = OVERLAY_FONT_SIZE;
  style.fill = "#FFF4D8";
  style.stroke = "rgba(5, 5, 5, 0.76)";
  style.strokeThickness = 2;
  style.lineJoin = "round";
  style.miterLimit = 2;
  style.dropShadow = false;
  style.align = "left";
  return style;
}

function getNameStyle() {
  const style = getControlStyle();
  style.align = "center";
  return style;
}

function getNameTypeStyle() {
  const style = getControlStyle();
  style.align = "center";
  return style;
}

function getIconValueStyle() {
  const style = getControlStyle();
  style.fontWeight = "700";
  return style;
}

function createOverlayIconSprite(src, size = OVERLAY_FONT_SIZE + 2) {
  const OutlineFilterClass = PIXI?.filters?.OutlineFilter ?? PIXI?.OutlineFilter;
  if (typeof OutlineFilterClass === "function") {
    const sprite = PIXI.Sprite.from(src);
    sprite.width = size;
    sprite.height = size;
    sprite.tint = OVERLAY_CONTROL_ICON_TINT;
    sprite.alpha = 0.98;
    const outline = new OutlineFilterClass(
      OVERLAY_CONTROL_ICON_OUTLINE_THICKNESS,
      OVERLAY_CONTROL_ICON_OUTLINE_COLOR,
      1
    );
    if ("alpha" in outline) outline.alpha = OVERLAY_CONTROL_ICON_OUTLINE_ALPHA;
    sprite.filters = [outline];
    sprite.eventMode = "none";
    return sprite;
  }

  // Runtime-safe fallback when OutlineFilter is unavailable: fake stroke with offset clones.
  const container = new PIXI.Container();
  container.eventMode = "none";
  const offsets = [
    [-1, -1], [0, -1], [1, -1],
    [-1, 0],            [1, 0],
    [-1, 1],  [0, 1],  [1, 1]
  ];
  for (const [dx, dy] of offsets) {
    const strokeSprite = PIXI.Sprite.from(src);
    strokeSprite.width = size;
    strokeSprite.height = size;
    strokeSprite.tint = OVERLAY_CONTROL_ICON_OUTLINE_COLOR;
    strokeSprite.alpha = OVERLAY_CONTROL_ICON_OUTLINE_ALPHA;
    strokeSprite.position.set(dx, dy);
    strokeSprite.eventMode = "none";
    container.addChild(strokeSprite);
  }

  const sprite = PIXI.Sprite.from(src);
  sprite.width = size;
  sprite.height = size;
  sprite.tint = OVERLAY_CONTROL_ICON_TINT;
  sprite.alpha = 0.98;
  sprite.eventMode = "none";
  container.addChild(sprite);
  return container;
}

function getActorTypeLabel(actor) {
  const systemType = String(actor?.system?.type ?? "").trim();
  if (systemType) return systemType;
  const actorType = String(actor?.type ?? "").trim();
  if (actorType) return actorType;
  return "actor";
}

function tuneOverlayText(textObject) {
  if (!textObject) return;
  textObject.roundPixels = true;
  const devicePixelRatio = Math.max(1, Number(window.devicePixelRatio ?? 1));
  const canvasScale = Number(canvas?.stage?.scale?.x ?? 1);
  const zoom = (Number.isFinite(canvasScale) && canvasScale > 0) ? canvasScale : 1;
  const zoomBoost = zoom < 1 ? (1 / zoom) : 1;
  const resolution = Math.min(
    OVERLAY_TEXT_RESOLUTION_MAX,
    Math.max(OVERLAY_TEXT_RESOLUTION_MIN, Math.ceil(devicePixelRatio * zoomBoost))
  );
  if ("resolution" in textObject && textObject.resolution !== resolution) {
    textObject.resolution = resolution;
    textObject.dirty = true;
  }
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

  const countText = new PreciseTextClass("", getIconValueStyle());
  tuneOverlayText(countText);
  countText.anchor.set(0, 0.5);
  countText.eventMode = "none";
  const countIcon = createOverlayIconSprite(ICON_SRC_WOUND, OVERLAY_FONT_SIZE + 1);

  const countHitBox = new PIXI.Graphics();
  countHitBox.eventMode = "static";
  countHitBox.interactive = true;
  countHitBox.buttonMode = true;
  countHitBox.cursor = "pointer";

  const attackIcon = createOverlayIconSprite(ICON_SRC_ATK, OVERLAY_FONT_SIZE + 2);

  const defenceIcon = createOverlayIconSprite(ICON_SRC_DEF, OVERLAY_FONT_SIZE + 2);

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
  bindTooltipHandlers(countHitBox, () => ({
    title: "Wounds",
    description: "Left-click adds 1 wound. Right-click removes 1 wound."
  }));

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
  bindTooltipHandlers(attackHitBox, () => ({
    title: "Attack",
    description: "Attack roll. Left-click attacks. Drag to a target for quick targeting. Hold Shift for manual mode."
  }));

  defenceHitBox.on("pointerdown", async (event) => {
    preventPointerDefault(event);
    if (getMouseButton(event) !== 0) return;
    const actor = getActorFromToken(tokenObject);
    if (!actor) return;
    if (!(await ensureTowActions())) return;
    await game.towActions.defenceActor(actor, { manual: game.towActions.isShiftHeld() });
  });
  defenceHitBox.on("contextmenu", preventPointerDefault);
  bindTooltipHandlers(defenceHitBox, () => ({
    title: "Defence",
    description: "Defence roll. Left-click defends. Hold Shift for manual mode."
  }));

  container.addChild(countHitBox);
  container.addChild(countIcon);
  container.addChild(countText);
  container.addChild(attackHitBox);
  container.addChild(defenceHitBox);
  container.addChild(attackIcon);
  container.addChild(defenceIcon);

  container._countText = countText;
  container._countIcon = countIcon;
  container._countHitBox = countHitBox;
  container._attackHitBox = attackHitBox;
  container._defenceHitBox = defenceHitBox;
  container._attackIcon = attackIcon;
  container._defenceIcon = defenceIcon;

  tokenObject.addChild(container);
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
    !existingUi._countIcon ||
    !existingUi._attackIcon ||
    !existingUi._defenceIcon ||
    existingUi._countText.destroyed ||
    existingUi._countIcon.destroyed ||
    existingUi._attackIcon.destroyed ||
    existingUi._defenceIcon.destroyed ||
    !existingUi._countText.style
  );
  const staleUi = !!existingUi && (
    existingUi.destroyed ||
    existingUi.parent == null ||
    existingUi.parent !== tokenObject ||
    hasBrokenTextStyle ||
    existingUi._attackHitBox?.destroyed ||
    existingUi._defenceHitBox?.destroyed ||
    existingUi._countHitBox?.destroyed
  );
  if (staleUi) {
    clearDisplayObject(existingUi);
    delete tokenObject[KEYS.woundUI];
  }

  const ui = (!tokenObject[KEYS.woundUI] || tokenObject[KEYS.woundUI].destroyed)
    ? createWoundControlUI(tokenObject)
    : tokenObject[KEYS.woundUI];
  const actor = getActorFromToken(tokenObject);

  const countText = ui._countText;
  const countIcon = ui._countIcon;
  const countHitBox = ui._countHitBox;
  const attackHitBox = ui._attackHitBox;
  const defenceHitBox = ui._defenceHitBox;
  const attackIcon = ui._attackIcon;
  const defenceIcon = ui._defenceIcon;
  tuneOverlayText(countText);

  try {
    countText.text = `${count}`;
  } catch (_error) {
    clearDisplayObject(ui);
    delete tokenObject[KEYS.woundUI];
    return updateWoundControlUI(tokenObject);
  }

  const padX = 3;
  const padY = 2;
  const rowGap = Math.max(18, countText.height + 4);
  const centerY = 0;
  const rightBottomY = centerY + (rowGap / 2);
  const leftTopY = -(rowGap / 2);
  const leftBottomY = leftTopY + rowGap;

  const countGap = 4;
  countIcon.position.set(0, Math.round(rightBottomY - (countIcon.height / 2)));
  countText.position.set(Math.round(countIcon.width + countGap), Math.round(rightBottomY));
  const countBlockWidth = countIcon.width + countGap + countText.width;
  const countBlockHeight = Math.max(countIcon.height, countText.height);
  drawHitBoxRect(
    countHitBox,
    -padX,
    rightBottomY - (countBlockHeight / 2) - padY,
    countBlockWidth + (padX * 2),
    countBlockHeight + (padY * 2)
  );

  ui.position.set(Math.round(tokenObject.w + TOKEN_CONTROL_PAD), Math.round(tokenObject.h / 2));

  const leftX = -(tokenObject.w + (TOKEN_CONTROL_PAD * 2));
  attackIcon.position.set(
    Math.round(leftX - attackIcon.width),
    Math.round(leftTopY - (attackIcon.height / 2))
  );
  defenceIcon.position.set(
    Math.round(leftX - defenceIcon.width),
    Math.round(leftBottomY - (defenceIcon.height / 2))
  );

  drawHitBoxRect(
    attackHitBox,
    attackIcon.x - padX,
    attackIcon.y - padY,
    attackIcon.width + (padX * 2),
    attackIcon.height + (padY * 2)
  );
  drawHitBoxRect(
    defenceHitBox,
    defenceIcon.x - padX,
    defenceIcon.y - padY,
    defenceIcon.width + (padX * 2),
    defenceIcon.height + (padY * 2)
  );

  const editable = canEditActor(actor);
  countText.alpha = editable ? 1 : 0.45;
  countIcon.alpha = editable ? 1 : 0.45;
  attackIcon.alpha = 1;
  defenceIcon.alpha = 1;
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

function updateNameLabel(tokenObject) {
  if (!tokenObject || tokenObject.destroyed) return;

  const tokenName = tokenObject.document?.name ?? tokenObject.name ?? "";
  const actor = tokenObject.document?.actor ?? null;
  const typeLabel = getActorTypeLabel(actor).toLowerCase();
  if (!tokenName) {
    const labelContainer = tokenObject[KEYS.nameLabel];
    if (!labelContainer) return;
    labelContainer.parent?.removeChild(labelContainer);
    labelContainer.destroy({ children: true });
    delete tokenObject[KEYS.nameLabel];
    return;
  }

  let labelContainer = tokenObject[KEYS.nameLabel];
  if (!labelContainer || labelContainer.destroyed || labelContainer.parent !== tokenObject || !labelContainer._nameText || !labelContainer._typeText) {
    if (labelContainer && !labelContainer.destroyed) {
      labelContainer.parent?.removeChild(labelContainer);
      labelContainer.destroy({ children: true });
    }

    labelContainer = new PIXI.Container();
    labelContainer.eventMode = "static";
    labelContainer.interactive = true;
    labelContainer.cursor = "help";

    const nameText = new PreciseTextClass("", getNameStyle());
    tuneOverlayText(nameText);
    nameText.anchor.set(0.5, 1);
    nameText.eventMode = "none";

    const typeText = new PreciseTextClass("", getNameTypeStyle());
    tuneOverlayText(typeText);
    typeText.anchor.set(0.5, 1);
    typeText.eventMode = "none";

    labelContainer.addChild(nameText);
    labelContainer.addChild(typeText);
    labelContainer._nameText = nameText;
    labelContainer._typeText = typeText;
    labelContainer[KEYS.nameLabelMarker] = true;
    labelContainer[KEYS.nameLabelTokenId] = tokenObject.id;

    tokenObject.addChild(labelContainer);
    tokenObject[KEYS.nameLabel] = labelContainer;
  }

  const nameText = labelContainer._nameText;
  const typeText = labelContainer._typeText;
  tuneOverlayText(nameText);
  tuneOverlayText(typeText);
  if (!labelContainer._towTypeTooltipBound) {
    labelContainer._towTypeTooltipBound = bindTooltipHandlers(labelContainer, () => getTypeTooltipData(actor));
  }
  nameText.text = tokenName;
  typeText.text = `<${typeLabel}>`;
  const tokenEdgePad = TOKEN_CONTROL_PAD;
  const lineGap = 0;
  const typeBounds = typeText.getLocalBounds();
  const typeBottom = typeBounds.y + typeBounds.height;
  const typeTop = typeBounds.y;
  typeText.position.set(0, Math.round(-(tokenEdgePad + typeBottom) + NAME_TYPE_TO_TOKEN_OFFSET_PX));

  const nameBounds = nameText.getLocalBounds();
  const nameBottom = nameBounds.y + nameBounds.height;
  nameText.position.set(0, Math.round((typeText.y + typeTop) + NAME_TYPE_STACK_OVERLAP_PX - lineGap - nameBottom));
  const combinedMinX = Math.min(nameBounds.x, typeBounds.x);
  const combinedMinY = Math.min(nameText.y + nameBounds.y, typeText.y + typeBounds.y);
  const combinedMaxX = Math.max(nameBounds.x + nameBounds.width, typeBounds.x + typeBounds.width);
  const combinedMaxY = Math.max(nameText.y + nameBounds.y + nameBounds.height, typeText.y + typeBounds.y + typeBounds.height);
  labelContainer.hitArea = new PIXI.Rectangle(
    Math.floor(combinedMinX - 4),
    Math.floor(combinedMinY - 2),
    Math.max(8, Math.ceil((combinedMaxX - combinedMinX) + 8)),
    Math.max(8, Math.ceil((combinedMaxY - combinedMinY) + 4))
  );
  labelContainer.position.set(Math.round(tokenObject.w / 2), 0);
  labelContainer.visible = tokenObject.visible;
}

function updateResilienceLabel(tokenObject) {
  if (!tokenObject || tokenObject.destroyed) return;

  const resilience = getResilienceValue(tokenObject.document);
  if (resilience === null || resilience === undefined) {
    const label = tokenObject[KEYS.resilienceLabel];
    if (!label) return;
    label.parent?.removeChild(label);
    label.destroy();
    delete tokenObject[KEYS.resilienceLabel];
    return;
  }

  let label = tokenObject[KEYS.resilienceLabel];
  const staleLabel = !!label && (
    label.destroyed ||
    label.parent == null ||
    label.parent !== tokenObject
  );
  if (staleLabel) {
    clearDisplayObject(label);
    delete tokenObject[KEYS.resilienceLabel];
    label = null;
  }

  if (!label) {
    label = new PIXI.Container();
    label.eventMode = "passive";
    label.interactiveChildren = true;

    const hitBox = new PIXI.Graphics();
    hitBox.eventMode = "static";
    hitBox.interactive = true;
    hitBox.buttonMode = true;
    hitBox.cursor = "help";

    const icon = createOverlayIconSprite(ICON_SRC_RES, OVERLAY_FONT_SIZE + 1);
    const valueText = new PreciseTextClass("", getIconValueStyle());
    tuneOverlayText(valueText);
    valueText.anchor.set(0, 0.5);
    valueText.eventMode = "none";

    label.addChild(hitBox);
    label.addChild(icon);
    label.addChild(valueText);
    label._hitBox = hitBox;
    label._icon = icon;
    label._valueText = valueText;
    tokenObject.addChild(label);
    tokenObject[KEYS.resilienceLabel] = label;

    bindTooltipHandlers(hitBox, () => ({
      title: "Resilience",
      description: "Resilience value used for durability and damage resolution thresholds."
    }));
  }

  const hitBox = label._hitBox;
  const icon = label._icon;
  const valueText = label._valueText;
  if (!hitBox || !icon || !valueText) {
    clearDisplayObject(label);
    delete tokenObject[KEYS.resilienceLabel];
    return updateResilienceLabel(tokenObject);
  }

  valueText.text = `${resilience}`;
  tuneOverlayText(valueText);
  const gap = 4;
  const padX = 3;
  const padY = 2;
  icon.position.set(0, Math.round(-icon.height / 2));
  valueText.position.set(Math.round(icon.width + gap), 0);
  const blockWidth = icon.width + gap + valueText.width;
  const blockHeight = Math.max(icon.height, valueText.height);
  drawHitBoxRect(
    hitBox,
    -padX,
    Math.round(-(blockHeight / 2) - padY),
    Math.round(blockWidth + (padX * 2)),
    Math.round(blockHeight + (padY * 2))
  );

  const rowGap = Math.max(18, Math.max(icon.height, valueText.height) + 4);
  const rightTopY = (tokenObject.h / 2) - (rowGap / 2);
  label.position.set(Math.round(tokenObject.w + TOKEN_CONTROL_PAD), Math.round(rightTopY));
  label.visible = tokenObject.visible;
}

function clearAllResilienceLabels() {
  forEachSceneToken((token) => {
    const label = token[KEYS.resilienceLabel];
    if (!label) return;
    label.parent?.removeChild(label);
    label.destroy();
    delete token[KEYS.resilienceLabel];
  });
}

function clearAllNameLabels() {
  forEachSceneToken((token) => {
    const labelContainer = token[KEYS.nameLabel];
    if (!labelContainer) return;
    labelContainer.parent?.removeChild(labelContainer);
    labelContainer.destroy({ children: true });
    delete token[KEYS.nameLabel];
  });

  const orphaned = [];
  for (const child of canvas.tokens.children ?? []) {
    if (child?.[KEYS.nameLabelMarker] === true) orphaned.push(child);
  }
  for (const labelContainer of orphaned) clearDisplayObject(labelContainer);
}


function getIconSrc(displayObject) {
  return (
    displayObject?.texture?.baseTexture?.resource?.source?.src ||
    displayObject?.texture?.baseTexture?.resource?.url ||
    displayObject?.texture?.baseTexture?.resource?.src ||
    ""
  );
}

function normalizeIconSrc(src) {
  return String(src ?? "").trim().toLowerCase().split("?")[0];
}

function extractConditionIdFromSrc(src) {
  const match = normalizeIconSrc(src).match(/\/conditions\/([a-z0-9_-]+)\.svg$/);
  return match?.[1] ?? null;
}

function getActorEffects(actor) {
  return Array.from(actor?.effects?.contents ?? []);
}

function getEffectIconSrc(effect) {
  return normalizeIconSrc(effect?.img ?? effect?.icon ?? "");
}

async function runActorOpLock(actor, opKey, operation) {
  const state = game[MODULE_KEY];
  if (!state || !actor || !opKey || typeof operation !== "function") return;
  if (!state.statusRemoveInFlight) state.statusRemoveInFlight = new Set();
  const actorKey = actor.uuid ?? actor.id;
  if (!actorKey) return;

  const lockKey = `${actorKey}:${String(opKey)}`;
  if (state.statusRemoveInFlight.has(lockKey)) return;
  state.statusRemoveInFlight.add(lockKey);
  try {
    await operation();
  } finally {
    state.statusRemoveInFlight.delete(lockKey);
  }
}

function getActorStatusSet(actor) {
  const statuses = new Set(Array.from(actor?.statuses ?? []).map((s) => String(s)));
  for (const effect of getActorEffects(actor)) {
    for (const status of Array.from(effect?.statuses ?? [])) {
      statuses.add(String(status));
    }
  }
  return statuses;
}

function getAllConditionEntries() {
  const conditions = game.oldworld?.config?.conditions ?? {};
  return Object.entries(conditions)
    .map(([id, data]) => ({
      id: String(id),
      img: String(data?.img ?? data?.icon ?? `/systems/whtow/assets/icons/conditions/${id}.svg`)
    }))
    .filter((entry) => !!entry.id && !!entry.img);
}

function getConditionTooltipData(conditionId) {
  const condition = game.oldworld?.config?.conditions?.[String(conditionId ?? "")] ?? {};
  const rawName = String(condition?.name ?? conditionId ?? "Condition");
  const rawDescription = String(condition?.description ?? "");
  const name = rawName.startsWith("TOW.") ? game.i18n.localize(rawName) : rawName;
  const localizedDescription = rawDescription.startsWith("TOW.")
    ? game.i18n.localize(rawDescription)
    : rawDescription;
  const shortDescription = localizedDescription
    ? (localizedDescription.split(/(?<=[.!?])\s+/)[0] ?? localizedDescription).trim()
    : "";
  return {
    name: String(name ?? conditionId ?? "Condition"),
    description: String(shortDescription ?? "")
  };
}

function getTypeTooltipData(actor) {
  const systemType = String(actor?.system?.type ?? "").trim().toLowerCase();
  const fallbackType = String(actor?.type ?? "actor").trim().toLowerCase();
  const typeKey = systemType || fallbackType;
  const npcTypeLabelKey = game.oldworld?.config?.npcType?.[typeKey] ?? null;
  const typeLabel = npcTypeLabelKey ? game.i18n.localize(npcTypeLabelKey) : getActorTypeLabel(actor);

  if (typeKey === "minion") {
    return { title: typeLabel, description: "Minions are defeated at 1 wound." };
  }
  if (["brute", "champion", "monstrosity"].includes(typeKey)) {
    const cap = getMaxWoundLimit(actor);
    const capText = Number.isFinite(cap) ? ` Defeated at ${cap} wounds.` : "";
    return { title: typeLabel, description: `Threshold-based NPC type.${capText}` };
  }
  return { title: typeLabel, description: "Actor type." };
}

function ensureStatusTooltip() {
  const state = game[MODULE_KEY];
  if (!state) return null;
  if (state.statusTooltip?.element instanceof HTMLElement && state.statusTooltip.element.isConnected) return state.statusTooltip;

  for (const stale of Array.from(document.querySelectorAll(`.${STATUS_TOOLTIP_DOM_CLASS}`))) {
    stale.remove();
  }

  const element = document.createElement("div");
  element.classList.add(STATUS_TOOLTIP_DOM_CLASS);
  element.style.position = "fixed";
  element.style.left = "0px";
  element.style.top = "0px";
  element.style.display = "none";
  element.style.pointerEvents = "none";
  element.style.zIndex = "10000";
  element.style.maxWidth = `${STATUS_TOOLTIP_MAX_WIDTH}px`;
  element.style.padding = `${STATUS_TOOLTIP_PAD_Y}px ${STATUS_TOOLTIP_PAD_X}px`;
  element.style.borderRadius = "5px";
  element.style.border = `1px solid rgba(193, 139, 44, ${STATUS_TOOLTIP_BORDER_ALPHA})`;
  element.style.background = "rgba(15, 12, 9, 0.94)";
  element.style.color = "#f2e7cc";
  element.style.fontFamily = "var(--font-primary, Signika)";
  element.style.fontSize = `${STATUS_TOOLTIP_FONT_SIZE}px`;
  element.style.fontWeight = "400";
  element.style.lineHeight = "1.3";
  element.style.whiteSpace = "normal";

  const title = document.createElement("div");
  title.style.fontSize = `${STATUS_TOOLTIP_FONT_SIZE + 1}px`;
  title.style.fontWeight = "600";
  title.style.color = "#fff4d8";
  title.style.marginBottom = "3px";

  const body = document.createElement("div");
  body.style.fontSize = `${STATUS_TOOLTIP_FONT_SIZE}px`;
  body.style.fontWeight = "400";
  body.style.color = "#f2e7cc";

  element.appendChild(title);
  element.appendChild(body);
  document.body.appendChild(element);
  const view = canvas?.app?.renderer?.events?.domElement ?? canvas?.app?.view ?? null;
  const hideOnLeave = () => hideStatusTooltip();
  const hideOnBlur = () => hideStatusTooltip();
  const hideOnPointerDown = () => hideStatusTooltip();
  const hideOnKeyDown = () => hideStatusTooltip();
  if (view?.addEventListener) view.addEventListener("mouseleave", hideOnLeave);
  window.addEventListener("blur", hideOnBlur);
  window.addEventListener("pointerdown", hideOnPointerDown, true);
  window.addEventListener("keydown", hideOnKeyDown, true);

  state.statusTooltip = { element, title, body, view, hideOnLeave, hideOnBlur, hideOnPointerDown, hideOnKeyDown };
  return state.statusTooltip;
}

function showOverlayTooltip(title, description, point, existingTooltip = null) {
  const tooltip = existingTooltip ?? ensureStatusTooltip();
  if (!tooltip || !point) return;
  tooltip.title.textContent = String(title ?? "");
  tooltip.body.textContent = String(description ?? "");

  const view = canvas?.app?.renderer?.events?.domElement ?? canvas?.app?.view;
  const rect = view?.getBoundingClientRect?.();
  const clientX = Number(point.x ?? 0) + Number(rect?.left ?? 0) + STATUS_TOOLTIP_OFFSET_X;
  const clientY = Number(point.y ?? 0) + Number(rect?.top ?? 0) + STATUS_TOOLTIP_OFFSET_Y;

  // Prevent showing canvas overlay tooltips when another UI element is on top (e.g. actor sheet).
  const topElement = document.elementFromPoint(clientX, clientY);
  const cursorOnCanvas = !!(view && topElement && (topElement === view || view.contains(topElement)));
  if (!cursorOnCanvas) {
    hideStatusTooltip();
    return;
  }

  tooltip.element.style.left = `${Math.round(clientX)}px`;
  tooltip.element.style.top = `${Math.round(clientY)}px`;
  tooltip.element.style.display = "block";
}

function hideStatusTooltip() {
  for (const element of Array.from(document.querySelectorAll(`.${STATUS_TOOLTIP_DOM_CLASS}`))) {
    if (element instanceof HTMLElement) element.style.display = "none";
  }
  const state = game[MODULE_KEY];
  const element = state?.statusTooltip?.element;
  if (element instanceof HTMLElement) element.style.display = "none";
}

function clearStatusTooltip() {
  const state = game[MODULE_KEY];
  if (!state?.statusTooltip) return;
  const view = state.statusTooltip.view;
  const hideOnLeave = state.statusTooltip.hideOnLeave;
  const hideOnBlur = state.statusTooltip.hideOnBlur;
  const hideOnPointerDown = state.statusTooltip.hideOnPointerDown;
  const hideOnKeyDown = state.statusTooltip.hideOnKeyDown;
  if (view?.removeEventListener && hideOnLeave) view.removeEventListener("mouseleave", hideOnLeave);
  if (hideOnBlur) window.removeEventListener("blur", hideOnBlur);
  if (hideOnPointerDown) window.removeEventListener("pointerdown", hideOnPointerDown, true);
  if (hideOnKeyDown) window.removeEventListener("keydown", hideOnKeyDown, true);
  const element = state.statusTooltip.element;
  if (element instanceof HTMLElement) element.remove();
  for (const stale of Array.from(document.querySelectorAll(`.${STATUS_TOOLTIP_DOM_CLASS}`))) {
    stale.remove();
  }
  delete state.statusTooltip;
}

function resolveEffectFromIcon(actor, sprite) {
  const spriteSrc = normalizeIconSrc(getIconSrc(sprite));
  if (!spriteSrc) return null;
  return getActorEffects(actor).find((effect) => getEffectIconSrc(effect) === spriteSrc) ?? null;
}

async function removeStatusIconEffect(tokenObject, sprite) {
  const actor = getActorFromToken(tokenObject);
  if (!actor) return;
  if (!canEditActor(actor)) {
    warnNoPermission(actor);
    return;
  }

  const effect = resolveEffectFromIcon(actor, sprite);
  const conditionId = extractConditionIdFromSrc(getIconSrc(sprite));
  const removeKey = effect?.id ?? conditionId ?? normalizeIconSrc(getIconSrc(sprite));
  if (!removeKey) return;

  await runActorOpLock(actor, `remove:${removeKey}`, async () => {
    if (effect) {
      if (actor.effects?.has?.(effect.id)) await effect.delete();
    } else if (conditionId && actor.hasCondition?.(conditionId)) {
      await actor.removeCondition(conditionId);
    }
  });
}

function clearStatusIconHandler(sprite) {
  const handler = sprite?.[KEYS.statusIconHandler];
  if (handler) {
    sprite.off("pointerdown", handler);
    sprite.off("contextmenu", handler);
    delete sprite[KEYS.statusIconHandler];
  }
  const overHandler = sprite?.[KEYS.statusIconTooltipOverHandler];
  if (overHandler) {
    sprite.off("pointerover", overHandler);
    delete sprite[KEYS.statusIconTooltipOverHandler];
  }
  const moveHandler = sprite?.[KEYS.statusIconTooltipMoveHandler];
  if (moveHandler) {
    sprite.off("pointermove", moveHandler);
    delete sprite[KEYS.statusIconTooltipMoveHandler];
  }
  const outHandler = sprite?.[KEYS.statusIconTooltipOutHandler];
  if (outHandler) {
    sprite.off("pointerout", outHandler);
    sprite.off("pointerupoutside", outHandler);
    sprite.off("pointercancel", outHandler);
    delete sprite[KEYS.statusIconTooltipOutHandler];
  }
}

function clearStatusPalette(tokenObject) {
  const layer = tokenObject?.[KEYS.statusPaletteLayer];
  if (!layer) return;
  for (const child of layer.children ?? []) clearStatusIconHandler(child);
  layer.removeChildren().forEach((child) => child.destroy());
  layer.parent?.removeChild(layer);
  layer.destroy();
  delete tokenObject[KEYS.statusPaletteLayer];
  delete tokenObject[KEYS.statusPaletteMetrics];
}

function hideDefaultStatusPanel(tokenObject) {
  const effects = tokenObject?.effects;
  if (!effects) return;
  if (typeof tokenObject[KEYS.defaultEffectsVisible] === "undefined") {
    tokenObject[KEYS.defaultEffectsVisible] = effects.visible !== false;
  }
  effects.visible = false;
}

function restoreDefaultStatusPanel(tokenObject) {
  const effects = tokenObject?.effects;
  if (!effects) return;
  const prior = tokenObject[KEYS.defaultEffectsVisible];
  effects.visible = (typeof prior === "boolean") ? prior : true;
  delete tokenObject[KEYS.defaultEffectsVisible];
}

function hideCoreTokenHoverVisuals(tokenObject) {
  if (!tokenObject || tokenObject.destroyed) return;
  const tooltip = tokenObject?.tooltip ?? null;
  if (tooltip) {
    if (typeof tokenObject[KEYS.coreTooltipVisible] === "undefined") {
      tokenObject[KEYS.coreTooltipVisible] = tooltip.visible !== false;
    }
    if (typeof tokenObject[KEYS.coreTooltipRenderable] === "undefined") {
      tokenObject[KEYS.coreTooltipRenderable] = tooltip.renderable !== false;
    }
    tooltip.visible = false;
    tooltip.renderable = false;
  }

  const nameplate = tokenObject?.nameplate ?? null;
  if (nameplate) {
    if (typeof tokenObject[KEYS.coreNameplateVisible] === "undefined") {
      tokenObject[KEYS.coreNameplateVisible] = nameplate.visible !== false;
    }
    if (typeof tokenObject[KEYS.coreNameplateRenderable] === "undefined") {
      tokenObject[KEYS.coreNameplateRenderable] = nameplate.renderable !== false;
    }
    nameplate.visible = false;
    nameplate.renderable = false;
  }

  const border = tokenObject.border ?? null;
  if (border) {
    if (typeof tokenObject[KEYS.coreBorderVisible] === "undefined") {
      tokenObject[KEYS.coreBorderVisible] = border.visible !== false;
    }
    if (typeof tokenObject[KEYS.coreBorderAlpha] === "undefined") {
      tokenObject[KEYS.coreBorderAlpha] = Number(border.alpha ?? 1);
    }
    border.visible = false;
    if ("alpha" in border) border.alpha = 0;
  }
}

function restoreCoreTokenHoverVisuals(tokenObject) {
  if (!tokenObject || tokenObject.destroyed) return;
  const tooltip = tokenObject?.tooltip ?? null;
  if (tooltip && typeof tokenObject[KEYS.coreTooltipVisible] === "boolean") {
    tooltip.visible = tokenObject[KEYS.coreTooltipVisible];
  }
  if (tooltip && typeof tokenObject[KEYS.coreTooltipRenderable] === "boolean") {
    tooltip.renderable = tokenObject[KEYS.coreTooltipRenderable];
  }
  delete tokenObject[KEYS.coreTooltipVisible];
  delete tokenObject[KEYS.coreTooltipRenderable];

  const nameplate = tokenObject?.nameplate ?? null;
  if (nameplate && typeof tokenObject[KEYS.coreNameplateVisible] === "boolean") {
    nameplate.visible = tokenObject[KEYS.coreNameplateVisible];
  }
  if (nameplate && typeof tokenObject[KEYS.coreNameplateRenderable] === "boolean") {
    nameplate.renderable = tokenObject[KEYS.coreNameplateRenderable];
  }
  delete tokenObject[KEYS.coreNameplateVisible];
  delete tokenObject[KEYS.coreNameplateRenderable];

  const border = tokenObject.border ?? null;
  if (border && typeof tokenObject[KEYS.coreBorderVisible] === "boolean") {
    border.visible = tokenObject[KEYS.coreBorderVisible];
  }
  if (border && typeof tokenObject[KEYS.coreBorderAlpha] === "number" && "alpha" in border) {
    border.alpha = tokenObject[KEYS.coreBorderAlpha];
  }
  delete tokenObject[KEYS.coreBorderVisible];
  delete tokenObject[KEYS.coreBorderAlpha];
}

async function toggleConditionFromPalette(actor, conditionId) {
  if (!actor || !conditionId) return;
  if (!canEditActor(actor)) {
    warnNoPermission(actor);
    return;
  }
  const hasCondition = !!actor.hasCondition?.(conditionId);
  if (hasCondition) {
    await runActorOpLock(actor, `condition:${conditionId}`, async () => {
      if (!actor.hasCondition?.(conditionId)) return;
      await actor.removeCondition(conditionId);
    });
  } else {
    await runActorOpLock(actor, `condition:${conditionId}`, async () => {
      if (actor.hasCondition?.(conditionId)) return;
      await actor.addCondition(conditionId);
    });
  }
}

function stylePaletteSprite(sprite, actor, conditionId, activeStatuses = null) {
  const statuses = activeStatuses instanceof Set ? activeStatuses : getActorStatusSet(actor);
  const active = statuses.has(String(conditionId ?? ""));
  const key = String(conditionId ?? "").toLowerCase();
  const iconSrc = normalizeIconSrc(getIconSrc(sprite));
  const conditionImgSrc = normalizeIconSrc(sprite?._towConditionImg ?? "");
  const specialKind = (() => {
    if (key.includes("stagger")) return "staggered";
    if (key.includes("dead")) return "dead";
    if (conditionImgSrc.includes("/conditions/staggered.svg")) return "staggered";
    if (conditionImgSrc.includes("/conditions/dead.svg")) return "dead";
    if (iconSrc.includes("/conditions/staggered.svg")) return "staggered";
    if (iconSrc.includes("/conditions/dead.svg")) return "dead";
    return null;
  })();
  const clearLegacySpecials = () => {
    const ring = sprite._towPaletteRing;
    if (ring) {
      ring.parent?.removeChild(ring);
      ring.destroy();
      delete sprite._towPaletteRing;
    }
    const filter = sprite._towPaletteFilter;
    if (filter) {
      filter.destroy?.();
      delete sprite._towPaletteFilter;
    }
    delete sprite._towPaletteFilterKind;
    sprite.filters = null;
  };

  const clearSpecialBg = () => {
    const bg = sprite._towPaletteBg;
    if (!bg) return;
    bg.parent?.removeChild(bg);
    bg.destroy();
    delete sprite._towPaletteBg;
  };

  const applySpecialBg = (color, alpha) => {
    let bg = sprite._towPaletteBg;
    if (!bg || bg.destroyed) {
      bg = new PIXI.Graphics();
      bg.eventMode = "none";
      bg._towPaletteHelper = true;
      sprite._towPaletteBg = bg;
      sprite.parent?.addChildAt(bg, 0);
    } else if (bg.parent !== sprite.parent) {
      bg.parent?.removeChild(bg);
      sprite.parent?.addChildAt(bg, 0);
    }
    const size = Number.isFinite(Number(sprite._towIconSize)) ? Number(sprite._towIconSize) : STATUS_PALETTE_ICON_SIZE;
    const pad = STATUS_PALETTE_SPECIAL_BG_PAD;
    bg.clear();
    bg.lineStyle({
      width: STATUS_PALETTE_SPECIAL_BG_OUTLINE_WIDTH,
      color: STATUS_PALETTE_SPECIAL_BG_OUTLINE,
      alpha: STATUS_PALETTE_SPECIAL_BG_OUTLINE_ALPHA,
      alignment: 0.5
    });
    bg.beginFill(color, alpha);
    bg.drawRoundedRect(
      sprite.x - pad,
      sprite.y - pad,
      Math.max(2, size + (pad * 2)),
      Math.max(2, size + (pad * 2)),
      STATUS_PALETTE_SPECIAL_BG_RADIUS
    );
    bg.endFill();
  };

  if (!active) {
    sprite.tint = STATUS_PALETTE_INACTIVE_TINT;
    sprite.alpha = 0.40;
    clearLegacySpecials();
    clearSpecialBg();
    return;
  }

  clearLegacySpecials();
  sprite.alpha = 0.98;

  if (specialKind === "staggered") {
    sprite.tint = STATUS_PALETTE_ACTIVE_TINT;
    applySpecialBg(STATUS_PALETTE_STAGGERED_RING, STATUS_PALETTE_SPECIAL_BG_STAGGERED_ALPHA);
    return;
  }

  if (specialKind === "dead") {
    sprite.tint = STATUS_PALETTE_ACTIVE_TINT;
    applySpecialBg(STATUS_PALETTE_DEAD_RING, STATUS_PALETTE_SPECIAL_BG_DEAD_ALPHA);
    return;
  }

  sprite.tint = STATUS_PALETTE_ACTIVE_TINT;
  clearSpecialBg();
}

function setupStatusPalette(tokenObject) {
  if (!tokenObject || tokenObject.destroyed) return;
  const actor = getActorFromToken(tokenObject);
  if (!actor) return;

  const conditions = getAllConditionEntries();
  if (!conditions.length) {
    clearStatusPalette(tokenObject);
    return;
  }

  const expectedCount = conditions.length;
  const iconSize = STATUS_PALETTE_ICON_SIZE;
  let layer = tokenObject[KEYS.statusPaletteLayer];
  const shouldRebuild = !layer
    || layer.destroyed
    || layer.parent !== tokenObject
    || (layer.children?.length ?? 0) !== expectedCount
    || tokenObject[KEYS.statusPaletteMetrics]?.iconSize !== iconSize;

  if (shouldRebuild) {
    clearStatusPalette(tokenObject);
    layer = new PIXI.Container();
    layer.eventMode = "static";
    layer.interactive = true;
    layer.interactiveChildren = true;
    layer[KEYS.statusPaletteMarker] = true;
    layer[KEYS.statusPaletteTokenId] = tokenObject.id;
    tokenObject.addChild(layer);
    tokenObject[KEYS.statusPaletteLayer] = layer;

    const columns = Math.max(1, Math.ceil(expectedCount / STATUS_PALETTE_ROWS));
    for (let i = 0; i < conditions.length; i++) {
      const condition = conditions[i];
      const sprite = PIXI.Sprite.from(condition.img);
      sprite.width = iconSize;
      sprite.height = iconSize;
      sprite.eventMode = "static";
      sprite.interactive = true;
      sprite.cursor = canEditActor(actor) ? "pointer" : "default";
      sprite._towConditionId = condition.id;
      sprite._towConditionImg = condition.img;
      sprite._towIconSize = iconSize;

      const col = i % columns;
      const row = Math.floor(i / columns);
      sprite.position.set(
        col * (iconSize + STATUS_PALETTE_ICON_GAP),
        row * (iconSize + STATUS_PALETTE_ICON_GAP)
      );

      const onDown = async (event) => {
        preventPointerDefault(event);
        if (getMouseButton(event) !== 0) return;
        await toggleConditionFromPalette(actor, condition.id);
      };
      sprite.on("pointerdown", onDown);
      sprite[KEYS.statusIconHandler] = onDown;
      bindTooltipHandlers(
        sprite,
        () => getConditionTooltipData(condition.id),
        {
          over: KEYS.statusIconTooltipOverHandler,
          move: KEYS.statusIconTooltipMoveHandler,
          out: KEYS.statusIconTooltipOutHandler
        }
      );

      layer.addChild(sprite);
    }
    tokenObject[KEYS.statusPaletteMetrics] = { iconSize };
  }

  const columns = Math.max(1, Math.ceil(expectedCount / STATUS_PALETTE_ROWS));
  const totalRows = Math.ceil(expectedCount / columns);
  const totalWidth = (columns * iconSize) + ((columns - 1) * STATUS_PALETTE_ICON_GAP);
  const totalHeight = (totalRows * iconSize) + ((totalRows - 1) * STATUS_PALETTE_ICON_GAP);
  const posX = Math.round((tokenObject.w - totalWidth) / 2);
  const posY = Math.round(tokenObject.h + STATUS_PALETTE_TOKEN_PAD);
  layer.position.set(posX, posY);
  layer.visible = tokenObject.visible;
  const activeStatuses = getActorStatusSet(actor);

  for (const sprite of layer.children?.filter((child) => child?._towConditionId) ?? []) {
    sprite.cursor = canEditActor(actor) ? "pointer" : "default";
    stylePaletteSprite(sprite, actor, sprite._towConditionId, activeStatuses);
  }
}

function clearAllStatusOverlays() {
  hideStatusTooltip();
  forEachSceneToken((token) => {
    for (const sprite of token.effects?.children ?? []) clearStatusIconHandler(sprite);
    clearStatusPalette(token);
    restoreDefaultStatusPanel(token);
    restoreCoreTokenHoverVisuals(token);
    clearDeadVisual(token);
    restoreTokenOverlayInteractivity(token);
    clearCustomLayoutBorder(token);
  });

  const orphaned = [];
  for (const child of canvas.tokens.children ?? []) {
    if (child?.[KEYS.statusPaletteMarker] === true) orphaned.push(child);
  }
  for (const layer of orphaned) clearDisplayObject(layer);
  clearStatusTooltip();
}

function refreshTokenOverlay(tokenObject) {
  primeDeadPresence(getActorFromToken(tokenObject));
  ensureTokenOverlayInteractivity(tokenObject);
  hideDefaultStatusPanel(tokenObject);
  hideCoreTokenHoverVisuals(tokenObject);
  setupStatusPalette(tokenObject);
  updateWoundControlUI(tokenObject);
  updateNameLabel(tokenObject);
  updateResilienceLabel(tokenObject);
  updateTokenOverlayHitArea(tokenObject);
  updateCustomLayoutBorderVisibility(tokenObject);
  ensureDeadVisual(tokenObject);
}

function refreshActorOverlays(actor) {
  primeDeadPresence(actor);
  queueWoundSyncFromDeadState(actor);
  for (const tokenObject of getActorTokenObjects(actor)) {
    refreshTokenOverlay(tokenObject);
  }
}

function queueActorOverlayResync(actor) {
  if (!actor) return;
  const state = game[MODULE_KEY];
  if (!state) return;
  if (!state.actorOverlayResyncTimers) state.actorOverlayResyncTimers = new Map();

  const key = actor.uuid ?? actor.id;
  if (!key) return;

  const existing = state.actorOverlayResyncTimers.get(key);
  if (Array.isArray(existing)) {
    for (const timer of existing) clearTimeout(timer);
  }

  const timers = ACTOR_OVERLAY_RESYNC_DELAYS_MS.map((delayMs) => setTimeout(() => {
    refreshActorOverlays(actor);
  }, delayMs));
  state.actorOverlayResyncTimers.set(key, timers);
}

function refreshAllOverlays() {
  forEachSceneToken((token) => {
    refreshTokenOverlay(token);
  });
}

function registerHooks() {
  return {
    canvasReady: Hooks.on("canvasReady", refreshAllOverlays),
    canvasPan: Hooks.on("canvasPan", (_canvas, viewPosition) => {
      const state = game[MODULE_KEY];
      if (!state) return;
      const nextScale = Number(viewPosition?.scale ?? canvas?.stage?.scale?.x ?? 1);
      const lastScale = Number(state.lastCanvasScale ?? NaN);
      if (Number.isFinite(lastScale) && Math.abs(nextScale - lastScale) < 0.01) return;
      state.lastCanvasScale = nextScale;
      refreshAllOverlays();
    }),
    refreshToken: Hooks.on("refreshToken", (token) => refreshTokenOverlay(token)),
    hoverToken: Hooks.on("hoverToken", (token, hovered) => {
      hideCoreTokenHoverVisuals(token);
      updateCustomLayoutBorderVisibility(token, { hovered });
    }),
    controlToken: Hooks.on("controlToken", (token, controlled) => {
      if (controlled) void bringTokenToFront(token);
      hideCoreTokenHoverVisuals(token);
      updateCustomLayoutBorderVisibility(token, { controlled });
    }),
    createItem: Hooks.on("createItem", (item) => {
      if (item.type !== WOUND_ITEM_TYPE) return;
      refreshActorOverlays(item.parent);
      queueActorOverlayResync(item.parent);
      queueDeadSyncFromWounds(item.parent);
    }),
    updateItem: Hooks.on("updateItem", (item) => {
      if (item.type !== WOUND_ITEM_TYPE) return;
      refreshActorOverlays(item.parent);
      queueActorOverlayResync(item.parent);
      queueDeadSyncFromWounds(item.parent);
    }),
    deleteItem: Hooks.on("deleteItem", (item) => {
      if (item.type !== WOUND_ITEM_TYPE) return;
      refreshActorOverlays(item.parent);
      queueActorOverlayResync(item.parent);
      queueDeadSyncFromWounds(item.parent);
    }),
    createActiveEffect: Hooks.on("createActiveEffect", (effect) => refreshActorOverlays(effect?.parent)),
    updateActiveEffect: Hooks.on("updateActiveEffect", (effect) => refreshActorOverlays(effect?.parent)),
    deleteActiveEffect: Hooks.on("deleteActiveEffect", (effect) => refreshActorOverlays(effect?.parent))
  };
}

function unregisterHooks(hookIds) {
  Hooks.off("canvasReady", hookIds.canvasReady);
  Hooks.off("canvasPan", hookIds.canvasPan);
  Hooks.off("refreshToken", hookIds.refreshToken);
  Hooks.off("hoverToken", hookIds.hoverToken);
  Hooks.off("controlToken", hookIds.controlToken);
  Hooks.off("createItem", hookIds.createItem);
  Hooks.off("updateItem", hookIds.updateItem);
  Hooks.off("deleteItem", hookIds.deleteItem);
  Hooks.off("createActiveEffect", hookIds.createActiveEffect);
  Hooks.off("updateActiveEffect", hookIds.updateActiveEffect);
  Hooks.off("deleteActiveEffect", hookIds.deleteActiveEffect);
}


function isOverlayEnabled() {
  return !!game[MODULE_KEY];
}

function enableOverlay() {
  if (game[MODULE_KEY]) return false;
  game[MODULE_KEY] = {
    ...registerHooks(),
    recentAttacks: new Map(),
    recentTargets: new Map(),
    autoApplyArmed: new Set(),
    actorOverlayResyncTimers: new Map(),
    deadSyncTimers: new Map(),
    deadToWoundSyncTimers: new Map(),
    deadPresenceByActor: new Map(),
    deadSyncInFlight: new Set(),
    statusRemoveInFlight: new Set(),
    lastCanvasScale: Number(canvas?.stage?.scale?.x ?? 1)
  };
  refreshAllOverlays();
  ui.notifications.info("Overlay enabled: wounds + resilience + status highlights.");
  return true;
}

function disableOverlay() {
  const state = game[MODULE_KEY];
  if (!state) return false;
  unregisterHooks(state);
  if (state?.actorOverlayResyncTimers instanceof Map) {
    for (const timers of state.actorOverlayResyncTimers.values()) {
      if (!Array.isArray(timers)) continue;
      for (const timer of timers) clearTimeout(timer);
    }
    state.actorOverlayResyncTimers.clear();
  }
  if (state?.deadSyncTimers instanceof Map) {
    for (const timer of state.deadSyncTimers.values()) clearTimeout(timer);
    state.deadSyncTimers.clear();
  }
  if (state?.deadToWoundSyncTimers instanceof Map) {
    for (const timer of state.deadToWoundSyncTimers.values()) clearTimeout(timer);
    state.deadToWoundSyncTimers.clear();
  }
  if (state?.deadPresenceByActor instanceof Map) state.deadPresenceByActor.clear();
  if (state?.deadSyncInFlight instanceof Set) state.deadSyncInFlight.clear();
  if (state?.staggerWaitPatch && typeof foundry.applications?.api?.Dialog?.wait === "function") {
    foundry.applications.api.Dialog.wait = state.staggerWaitPatch.originalWait;
  }
  delete game[MODULE_KEY];

  clearAllWoundControls();
  clearAllNameLabels();
  clearAllResilienceLabels();
  clearAllStatusOverlays();
  ui.notifications.info("Overlay disabled.");
  return true;
}

function toggleOverlay() {
  return isOverlayEnabled() ? disableOverlay() : enableOverlay();
}

const TOW_OVERLAY_API_KEY = "towOverlay";
const TOW_OVERLAY_VERSION = "1.0.0";

const api = game[TOW_OVERLAY_API_KEY] ?? {};
game[TOW_OVERLAY_API_KEY] = {
  ...api,
  version: TOW_OVERLAY_VERSION,
  isEnabled: isOverlayEnabled,
  enable: enableOverlay,
  disable: disableOverlay,
  toggle: toggleOverlay,
  refreshAll: refreshAllOverlays,
  refreshActor: refreshActorOverlays,
  refreshToken: refreshTokenOverlay
};

