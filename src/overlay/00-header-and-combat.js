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
  const shiftKey = foundry.helpers?.interaction?.KeyboardManager?.MODIFIER_KEYS?.SHIFT
    ?? KeyboardManager?.MODIFIER_KEYS?.SHIFT;
  if (!shiftKey) return false;
  return game.keyboard?.isModifierActive?.(shiftKey) === true;
}

function copyPoint(point) {
  if (!point) return null;
  return { x: Number(point.x ?? 0), y: Number(point.y ?? 0) };
}

function getWorldPoint(event) {
  if (typeof event?.getLocalPosition === "function" && canvas?.stage) {
    return copyPoint(event.getLocalPosition(canvas.stage));
  }
  if (typeof event?.data?.getLocalPosition === "function" && canvas?.stage) {
    return copyPoint(event.data.getLocalPosition(canvas.stage));
  }
  const global = event?.global ?? event?.data?.global;
  if (global && canvas?.stage?.worldTransform) return copyPoint(canvas.stage.worldTransform.applyInverse(global));
  return copyPoint(canvas.mousePosition);
}

function getScreenPoint(event) {
  return copyPoint(event?.global ?? event?.data?.global ?? null);
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
  const globalPoint = canvas?.stage?.worldTransform?.apply?.(point) ?? null;
  const placeables = [...canvas.tokens.placeables];
  for (let i = placeables.length - 1; i >= 0; i--) {
    const token = placeables[i];
    if (!token || token.destroyed || !token.visible) continue;
    if (token.id === excludeTokenId) continue;
    if (typeof token.containsPoint === "function") {
      if (token.containsPoint(point)) return token;
      if (globalPoint && token.containsPoint(globalPoint)) return token;
    }
    if (token.mesh?.containsPoint?.(point)) return token;
    if (globalPoint && token.mesh?.containsPoint?.(globalPoint)) return token;
    if (token.bounds?.contains?.(point.x, point.y)) return token;
    if (point.x >= token.x && point.x <= token.x + token.w && point.y >= token.y && point.y <= token.y + token.h) return token;
  }
  return null;
}

async function setSingleTarget(token) {
  if (!token) return false;
  const currentTargets = Array.from(game.user.targets ?? []);
  if (currentTargets.length === 1 && currentTargets[0]?.id === token.id) return true;

  const state = game[MODULE_KEY];
  if (state) {
    if (!state.recentTargets) state.recentTargets = new Map();
    const key = `${game.user.id}:${token.id}`;
    const now = Date.now();
    const last = Number(state.recentTargets.get(key) ?? 0);
    if (now - last < TARGET_DEDUPE_WINDOW_MS) return false;
    state.recentTargets.set(key, now);
  }

  if (typeof game.user?.updateTokenTargets === "function") {
    const result = game.user.updateTokenTargets([token.id]);
    if (result instanceof Promise) await result;
  }

  const updatedTargets = Array.from(game.user.targets ?? []);
  const applied = updatedTargets.some((target) => target?.id === token.id);
  if (applied) return true;

  // Recovery path for cases where target set propagation lags behind the roll call.
  if (typeof token.setTarget === "function") {
    token.setTarget(true, { releaseOthers: true, groupSelection: false });
    const fallbackTargets = Array.from(game.user.targets ?? []);
    return fallbackTargets.some((target) => target?.id === token.id);
  }

  return false;
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
