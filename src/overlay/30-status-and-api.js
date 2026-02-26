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

async function setActorConditionState(actor, conditionId, active) {
  if (!actor || !conditionId) return;
  const id = String(conditionId);
  const keepCustomFlow = id === "staggered";
  if (!keepCustomFlow && typeof actor.toggleStatusEffect === "function") {
    try {
      await actor.toggleStatusEffect(id, { active });
      return;
    } catch (_error) {
      // Fall back to system helpers if status effect registry lookup fails.
    }
  }

  if (active) await actor.addCondition(id);
  else await actor.removeCondition(id);
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

function getActorEffectsByStatus(actor, conditionId) {
  const id = String(conditionId ?? "");
  if (!id) return [];
  return getActorEffects(actor).filter((effect) => {
    const statuses = Array.from(effect?.statuses ?? []).map((status) => String(status));
    return statuses.includes(id);
  });
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
      await setActorConditionState(actor, conditionId, false);
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
  const id = String(conditionId);
  const statusSet = getActorStatusSet(actor);
  const isActive = statusSet.has(id);
  await runActorOpLock(actor, `condition:${id}`, async () => {
    if (!isActive) {
      await setActorConditionState(actor, id, true);
      return;
    }

    await setActorConditionState(actor, id, false);
    const stillActive = getActorStatusSet(actor).has(id);
    if (!stillActive) return;

    // Some statuses can be provided by embedded effects without hasCondition linkage.
    for (const effect of getActorEffectsByStatus(actor, id)) {
      if (!effect?.id || !actor.effects?.has?.(effect.id)) continue;
      await effect.delete();
    }
  });
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
    for (const entry of state.deadSyncTimers.values()) {
      if (typeof entry?.cancel === "function") entry.cancel();
      else clearTimeout(entry);
    }
    state.deadSyncTimers.clear();
  }
  if (state?.deadToWoundSyncTimers instanceof Map) {
    for (const entry of state.deadToWoundSyncTimers.values()) {
      if (typeof entry?.cancel === "function") entry.cancel();
      else clearTimeout(entry);
    }
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
