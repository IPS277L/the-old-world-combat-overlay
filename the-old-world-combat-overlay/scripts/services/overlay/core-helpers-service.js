function towCombatOverlayCanEditActor(actor) {
  return actor?.isOwner === true;
}

function towCombatOverlayWarnNoPermission(actor) {
  ui.notifications.warn(`No permission to edit ${actor?.name ?? "actor"}.`);
}

function towCombatOverlayGetActorFromToken(tokenObject) {
  return tokenObject?.document?.actor ?? null;
}

function towCombatOverlayAsTokenObject(tokenLike) {
  return tokenLike?.object ?? tokenLike ?? null;
}

function towCombatOverlayForEachSceneToken(callback) {
  for (const token of canvas.tokens.placeables) callback(token);
}

function towCombatOverlayForEachActorToken(actor, callback) {
  if (!actor) return;
  for (const token of actor.getActiveTokens(true)) {
    const tokenObject = towCombatOverlayAsTokenObject(token);
    if (tokenObject) callback(tokenObject);
  }
}

function towCombatOverlayGetActorTokenObjects(actor) {
  const seen = new Set();
  const tokens = [];
  towCombatOverlayForEachActorToken(actor, (tokenObject) => {
    if (!tokenObject?.id || seen.has(tokenObject.id)) return;
    seen.add(tokenObject.id);
    tokens.push(tokenObject);
  });

  const syntheticToken = towCombatOverlayAsTokenObject(actor?.token);
  if (syntheticToken?.id && !seen.has(syntheticToken.id)) {
    seen.add(syntheticToken.id);
    tokens.push(syntheticToken);
  }

  return tokens;
}

function towCombatOverlayGetTokenOverlayScale(tokenObject) {
  const width = Number(tokenObject?.w ?? NaN);
  const height = Number(tokenObject?.h ?? NaN);
  const tokenSize = Math.min(width, height);
  if (!Number.isFinite(tokenSize) || tokenSize <= 0) return 1;
  const ratio = tokenSize / OVERLAY_TOKEN_BASE_PX;
  const curvedScale = ratio < 1
    ? Math.pow(ratio, OVERLAY_SCALE_EXP_SMALL)
    : Math.pow(ratio, OVERLAY_SCALE_EXP_LARGE);
  return Math.max(OVERLAY_SCALE_MIN, Math.min(OVERLAY_SCALE_MAX, curvedScale));
}

function towCombatOverlayGetOverlayEdgePad(tokenObject) {
  const overlayScale = towCombatOverlayGetTokenOverlayScale(tokenObject);
  const scaledFactor = Math.pow(Math.max(overlayScale, 0.001), OVERLAY_EDGE_PAD_EXP);
  const factor = Math.max(OVERLAY_EDGE_PAD_MIN_FACTOR, Math.min(1, scaledFactor));
  return TOKEN_CONTROL_PAD * factor;
}

function towCombatOverlayGetOverlayEdgePadPx(tokenObject) {
  return Math.round(towCombatOverlayGetOverlayEdgePad(tokenObject));
}

function towCombatOverlayClampNumber(value, min, max) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return min;
  return Math.min(max, Math.max(min, numeric));
}

function towCombatOverlayRoundTo(value, digits = 2) {
  const factor = 10 ** Math.max(0, Number(digits) || 0);
  return Math.round(Number(value) * factor) / factor;
}

function towCombatOverlayPreventPointerDefault(event) {
  event.stopPropagation();
  event.nativeEvent?.preventDefault?.();
}

function towCombatOverlayGetMouseButton(event) {
  return event.button ?? event.data?.button ?? event.nativeEvent?.button ?? 0;
}

function towCombatOverlayIsShiftModifier(event) {
  const shiftKey = foundry.helpers?.interaction?.KeyboardManager?.MODIFIER_KEYS?.SHIFT
    ?? KeyboardManager?.MODIFIER_KEYS?.SHIFT;
  if (!shiftKey) return false;
  return game.keyboard?.isModifierActive?.(shiftKey) === true;
}

function towCombatOverlayCopyPoint(point) {
  if (!point) return null;
  return { x: Number(point.x ?? 0), y: Number(point.y ?? 0) };
}

function towCombatOverlayGetWorldPoint(event) {
  if (typeof event?.getLocalPosition === "function" && canvas?.stage) {
    return towCombatOverlayCopyPoint(event.getLocalPosition(canvas.stage));
  }
  if (typeof event?.data?.getLocalPosition === "function" && canvas?.stage) {
    return towCombatOverlayCopyPoint(event.data.getLocalPosition(canvas.stage));
  }
  const global = event?.global ?? event?.data?.global;
  if (global && canvas?.stage?.worldTransform) return towCombatOverlayCopyPoint(canvas.stage.worldTransform.applyInverse(global));
  return towCombatOverlayCopyPoint(canvas.mousePosition);
}

function towCombatOverlayGetScreenPoint(event) {
  return towCombatOverlayCopyPoint(event?.global ?? event?.data?.global ?? null);
}

function towCombatOverlayGetTooltipPointFromEvent(event) {
  return towCombatOverlayGetScreenPoint(event) ?? towCombatOverlayGetWorldPoint(event);
}

function towCombatOverlayBindTooltipHandlers(displayObject, getTooltipData, keyStore = null) {
  if (!displayObject || typeof getTooltipData !== "function") return null;

  const onShow = (event) => {
    const point = towCombatOverlayGetTooltipPointFromEvent(event);
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

function towCombatOverlayTokenAtPoint(point, { excludeTokenId } = {}) {
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

async function towCombatOverlayExecuteFirstMacroByNameCandidates(candidates) {
  const macro = candidates
    .map((name) => game.macros.getName(name))
    .find(Boolean);
  if (!macro) return false;
  await macro.execute();
  return true;
}

globalThis.towCombatOverlayCanEditActor = towCombatOverlayCanEditActor;
globalThis.towCombatOverlayWarnNoPermission = towCombatOverlayWarnNoPermission;
globalThis.towCombatOverlayGetActorFromToken = towCombatOverlayGetActorFromToken;
globalThis.towCombatOverlayAsTokenObject = towCombatOverlayAsTokenObject;
globalThis.towCombatOverlayForEachSceneToken = towCombatOverlayForEachSceneToken;
globalThis.towCombatOverlayForEachActorToken = towCombatOverlayForEachActorToken;
globalThis.towCombatOverlayGetActorTokenObjects = towCombatOverlayGetActorTokenObjects;
globalThis.towCombatOverlayGetTokenOverlayScale = towCombatOverlayGetTokenOverlayScale;
globalThis.towCombatOverlayGetOverlayEdgePad = towCombatOverlayGetOverlayEdgePad;
globalThis.towCombatOverlayGetOverlayEdgePadPx = towCombatOverlayGetOverlayEdgePadPx;
globalThis.towCombatOverlayClampNumber = towCombatOverlayClampNumber;
globalThis.towCombatOverlayRoundTo = towCombatOverlayRoundTo;
globalThis.towCombatOverlayPreventPointerDefault = towCombatOverlayPreventPointerDefault;
globalThis.towCombatOverlayGetMouseButton = towCombatOverlayGetMouseButton;
globalThis.towCombatOverlayIsShiftModifier = towCombatOverlayIsShiftModifier;
globalThis.towCombatOverlayCopyPoint = towCombatOverlayCopyPoint;
globalThis.towCombatOverlayGetWorldPoint = towCombatOverlayGetWorldPoint;
globalThis.towCombatOverlayGetScreenPoint = towCombatOverlayGetScreenPoint;
globalThis.towCombatOverlayGetTooltipPointFromEvent = towCombatOverlayGetTooltipPointFromEvent;
globalThis.towCombatOverlayBindTooltipHandlers = towCombatOverlayBindTooltipHandlers;
globalThis.towCombatOverlayTokenAtPoint = towCombatOverlayTokenAtPoint;
globalThis.towCombatOverlayExecuteFirstMacroByNameCandidates = towCombatOverlayExecuteFirstMacroByNameCandidates;
