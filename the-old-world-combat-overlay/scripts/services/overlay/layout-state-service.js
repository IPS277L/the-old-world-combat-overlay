function towCombatOverlayClearDisplayObject(displayObject) {
  if (!displayObject) return;
  displayObject.parent?.removeChild(displayObject);
  displayObject.destroy({ children: true });
}

function towCombatOverlayEnsureTokenOverlayInteractivity(tokenObject) {
  if (!tokenObject || tokenObject.destroyed) return;
  if (typeof tokenObject[KEYS.tokenInteractiveChildrenOriginal] === "undefined") {
    tokenObject[KEYS.tokenInteractiveChildrenOriginal] = tokenObject.interactiveChildren === true;
  }
  if (typeof tokenObject[KEYS.tokenHitAreaOriginal] === "undefined") {
    tokenObject[KEYS.tokenHitAreaOriginal] = tokenObject.hitArea ?? null;
  }
  tokenObject.interactiveChildren = true;
}

function towCombatOverlayUpdateTokenOverlayHitArea(tokenObject) {
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
  tokenObject.hitArea = new PIXI.Rectangle(hitBounds.x, hitBounds.y, hitBounds.width, hitBounds.height);
  tokenObject[KEYS.layoutBounds] = { ...hitBounds };
  drawCustomLayoutBorder(tokenObject);
}

function towCombatOverlayRestoreTokenOverlayInteractivity(tokenObject) {
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

function towCombatOverlayEnsureCustomLayoutBorder(tokenObject) {
  if (!tokenObject || tokenObject.destroyed) return null;
  let border = tokenObject[KEYS.layoutBorder];
  if (!border || border.destroyed || border.parent !== tokenObject) {
    if (border && !border.destroyed) towCombatOverlayClearDisplayObject(border);
    border = new PIXI.Graphics();
    border.eventMode = "none";
    tokenObject.addChild(border);
    tokenObject[KEYS.layoutBorder] = border;
  }
  return border;
}

function towCombatOverlayDrawCustomLayoutBorder(tokenObject) {
  if (!tokenObject || tokenObject.destroyed) return;
  const border = towCombatOverlayEnsureCustomLayoutBorder(tokenObject);
  if (!border) return;
  const bounds = tokenObject[KEYS.layoutBounds];
  border.clear();
  if (!bounds) return;
  const borderStyle = getLayoutBorderStyle(tokenObject);
  border.lineStyle({
    width: borderStyle.width,
    color: LAYOUT_BORDER_COLOR,
    alpha: borderStyle.alpha,
    alignment: 0.5,
    cap: "round",
    join: "round"
  });
  border.drawRoundedRect(bounds.x, bounds.y, bounds.width, bounds.height, borderStyle.radius);
}

function towCombatOverlayUpdateCustomLayoutBorderVisibility(tokenObject, { hovered = null, controlled = null } = {}) {
  if (!tokenObject || tokenObject.destroyed) return;
  const border = towCombatOverlayEnsureCustomLayoutBorder(tokenObject);
  if (!border) return;
  const isHovered = (typeof hovered === "boolean") ? hovered : (tokenObject.hover === true || tokenObject._hover === true);
  const isControlled = (typeof controlled === "boolean") ? controlled : (tokenObject.controlled === true || tokenObject._controlled === true);
  border.visible = tokenObject.visible && (isHovered || isControlled);
}

function towCombatOverlayClearCustomLayoutBorder(tokenObject) {
  const border = tokenObject?.[KEYS.layoutBorder];
  if (border) towCombatOverlayClearDisplayObject(border);
  delete tokenObject?.[KEYS.layoutBorder];
  delete tokenObject?.[KEYS.layoutBounds];
}

async function towCombatOverlayBringTokenToFront(tokenObject) {
  if (!tokenObject || tokenObject.destroyed) return;
  const tokenDocument = tokenObject.document ?? null;
  if (tokenDocument?.isOwner && typeof tokenDocument.update === "function") {
    const sorts = (canvas?.tokens?.placeables ?? [])
      .map((token) => Number(token?.document?.sort ?? NaN))
      .filter((value) => Number.isFinite(value));
    const highestSort = sorts.length ? Math.max(...sorts) : Number(tokenDocument.sort ?? 0);
    const currentSort = Number(tokenDocument.sort ?? 0);
    if (Number.isFinite(highestSort) && currentSort <= highestSort) {
      if (currentSort < highestSort) await tokenDocument.update({ sort: highestSort + 1 });
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
  const currentIndex = typeof parent.getChildIndex === "function" ? parent.getChildIndex(tokenObject) : -1;
  if (currentIndex === topIndex) return;
  parent.setChildIndex(tokenObject, topIndex);
}

function towCombatOverlayGetDeadFilterTargets(tokenObject) {
  return [tokenObject?.mesh, tokenObject?.icon].filter(Boolean);
}

function towCombatOverlayEnsureDeadVisual(tokenObject) {
  if (!tokenObject) return;
  const hasDead = !!tokenObject.document?.actor?.hasCondition?.("dead");
  if (!hasDead) {
    towCombatOverlayClearDeadVisual(tokenObject);
    return;
  }
  if (tokenObject[KEYS.deadVisualState]) towCombatOverlayClearDeadVisual(tokenObject);

  const targets = towCombatOverlayGetDeadFilterTargets(tokenObject);
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

function towCombatOverlayClearDeadVisual(tokenObject) {
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

function towCombatOverlayGetWoundCount(tokenDocument) {
  const actor = tokenDocument?.actor;
  if (!actor) return null;
  const liveItems = actor.items?.contents ?? [];
  const itemWounds = Array.isArray(liveItems)
    ? liveItems.filter((item) => item.type === WOUND_ITEM_TYPE).length
    : (Array.isArray(actor.itemTypes?.wound) ? actor.itemTypes.wound.length : 0);
  const isMinion = actor.type === "npc" && actor.system?.type === "minion";
  if (isMinion && actor.hasCondition?.("dead")) return Math.max(1, itemWounds);
  return itemWounds;
}

function towCombatOverlayGetActorWoundItemCount(actor) {
  if (!actor) return 0;
  const items = actor.items?.contents ?? [];
  if (Array.isArray(items)) return items.filter((item) => item.type === WOUND_ITEM_TYPE).length;
  if (Array.isArray(actor.itemTypes?.wound)) return actor.itemTypes.wound.length;
  return 0;
}

function towCombatOverlayGetMaxWoundLimit(actor) {
  if (!actor || actor.type !== "npc") return null;
  if (actor.system?.type === "minion") return 1;
  if (!actor.system?.hasThresholds) return null;
  const defeatedThreshold = Number(actor.system?.wounds?.defeated?.threshold ?? NaN);
  if (!Number.isFinite(defeatedThreshold) || defeatedThreshold <= 0) return null;
  return defeatedThreshold;
}

function towCombatOverlayIsAtWoundCap(actor) {
  const cap = towCombatOverlayGetMaxWoundLimit(actor);
  if (!Number.isFinite(cap)) return false;
  if (actor.system?.type === "minion" && actor.hasCondition?.("dead")) return true;
  return towCombatOverlayGetActorWoundItemCount(actor) >= cap;
}

async function towCombatOverlaySyncNpcDeadFromWounds(actor) {
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
    const woundCount = towCombatOverlayGetActorWoundItemCount(actor);
    const threshold = actor.system.thresholdAtWounds(woundCount);
    const shouldBeDead = threshold === "defeated";
    const hasDead = !!actor.hasCondition?.("dead");
    if (shouldBeDead === hasDead) return;

    if (shouldBeDead) {
      await runActorOpLock(actor, "condition:dead", async () => {
        if (actor.hasCondition?.("dead")) return;
        await addActorCondition(actor, "dead");
      });
    } else {
      await runActorOpLock(actor, "condition:dead", async () => {
        if (!actor.hasCondition?.("dead")) return;
        await removeActorCondition(actor, "dead");
      });
    }
  } finally {
    state.deadSyncInFlight.delete(actorKey);
  }
}

function towCombatOverlayQueueDeadSyncFromWounds(actor) {
  if (!actor) return;
  const state = game[MODULE_KEY];
  if (!state) return;
  if (!state.deadSyncTimers) state.deadSyncTimers = new Map();

  const actorKey = actor.uuid ?? actor.id;
  if (!actorKey) return;

  let debounced = state.deadSyncTimers.get(actorKey);
  if (typeof debounced !== "function") {
    debounced = foundry.utils.debounce((latestActor) => {
      void towCombatOverlaySyncNpcDeadFromWounds(latestActor).catch((error) => {
        console.error("[overlay-toggle] Failed to sync dead condition from wounds.", error);
      });
    }, DEAD_SYNC_DEBOUNCE_MS);
    state.deadSyncTimers.set(actorKey, debounced);
  }
  debounced(actor);
}

async function towCombatOverlaySyncWoundsFromDeadState(actor) {
  if (!actor || !canEditActor(actor)) return;
  const state = game[MODULE_KEY];
  if (!state) return;
  if (!state.deadPresenceByActor) state.deadPresenceByActor = new Map();

  const actorKey = actor.uuid ?? actor.id;
  if (!actorKey) return;

  const hasDead = !!actor.hasCondition?.("dead");
  const wasDead = state.deadPresenceByActor.get(actorKey) === true;
  state.deadPresenceByActor.set(actorKey, hasDead);

  const cap = towCombatOverlayGetMaxWoundLimit(actor);
  if (!Number.isFinite(cap) || cap <= 0) return;

  if (hasDead) {
    await runActorOpLock(actor, "dead-wound-sync", async () => {
      const current = towCombatOverlayGetActorWoundItemCount(actor);
      const missing = Math.max(0, cap - current);
      if (missing <= 0) return;
      for (let i = 0; i < missing; i++) {
        await actor.createEmbeddedDocuments("Item", [{ type: WOUND_ITEM_TYPE, name: "Wound" }]);
      }
    }).catch((error) => {
      console.error("[overlay-toggle] Failed to sync wounds from dead condition.", error);
    });
    return;
  }

  if (!wasDead) return;
  if (towCombatOverlayGetActorWoundItemCount(actor) < cap) return;
  await runActorOpLock(actor, "dead-wound-sync", async () => {
    const maxPasses = Math.max(1, towCombatOverlayGetActorWoundItemCount(actor) + 2);
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

function towCombatOverlayQueueWoundSyncFromDeadState(actor) {
  if (!actor) return;
  const state = game[MODULE_KEY];
  if (!state) return;
  if (!state.deadToWoundSyncTimers) state.deadToWoundSyncTimers = new Map();

  const actorKey = actor.uuid ?? actor.id;
  if (!actorKey) return;

  let debounced = state.deadToWoundSyncTimers.get(actorKey);
  if (typeof debounced !== "function") {
    debounced = foundry.utils.debounce((latestActor) => {
      void towCombatOverlaySyncWoundsFromDeadState(latestActor);
    }, DEAD_TO_WOUND_SYNC_DEBOUNCE_MS);
    state.deadToWoundSyncTimers.set(actorKey, debounced);
  }
  debounced(actor);
}

function towCombatOverlayPrimeDeadPresence(actor) {
  if (!actor) return;
  const state = game[MODULE_KEY];
  if (!state) return;
  if (!state.deadPresenceByActor) state.deadPresenceByActor = new Map();
  const actorKey = actor.uuid ?? actor.id;
  if (!actorKey || state.deadPresenceByActor.has(actorKey)) return;
  state.deadPresenceByActor.set(actorKey, !!actor.hasCondition?.("dead"));
}

function towCombatOverlayGetResilienceValue(tokenDocument) {
  return tokenDocument?.actor?.system?.resilience?.value ?? null;
}

async function towCombatOverlayAddWound(actor) {
  if (!canEditActor(actor)) {
    warnNoPermission(actor);
    return;
  }
  if (towCombatOverlayIsAtWoundCap(actor)) return;
  if (typeof actor.system?.addWound === "function") {
    await addActorWound(actor, { roll: false });
  } else {
    await actor.createEmbeddedDocuments("Item", [{ type: WOUND_ITEM_TYPE, name: "Wound" }]);
  }
}

async function towCombatOverlayRemoveWound(actor) {
  if (!canEditActor(actor)) {
    warnNoPermission(actor);
    return;
  }

  await runActorOpLock(actor, "remove-wound", async () => {
    const wounds = (actor.items?.contents ?? []).filter((item) => item.type === WOUND_ITEM_TYPE);
    const isMinion = actor.type === "npc" && actor.system?.type === "minion";
    if (!wounds.length) {
      if (isMinion && actor.hasCondition?.("dead")) {
        await removeActorCondition(actor, "dead");
      }
      return;
    }

    const toDelete = wounds.find((wound) => wound.system?.treated !== true) ?? wounds[wounds.length - 1];
    if (!toDelete?.id || !actor.items.get(toDelete.id)) return;
    await actor.deleteEmbeddedDocuments("Item", [toDelete.id]);

    if (isMinion && actor.hasCondition?.("dead")) {
      const remaining = towCombatOverlayGetActorWoundItemCount(actor);
      if (remaining <= 0) await removeActorCondition(actor, "dead");
    }
  });
}

globalThis.towCombatOverlayClearDisplayObject = towCombatOverlayClearDisplayObject;
globalThis.towCombatOverlayEnsureTokenOverlayInteractivity = towCombatOverlayEnsureTokenOverlayInteractivity;
globalThis.towCombatOverlayUpdateTokenOverlayHitArea = towCombatOverlayUpdateTokenOverlayHitArea;
globalThis.towCombatOverlayRestoreTokenOverlayInteractivity = towCombatOverlayRestoreTokenOverlayInteractivity;
globalThis.towCombatOverlayEnsureCustomLayoutBorder = towCombatOverlayEnsureCustomLayoutBorder;
globalThis.towCombatOverlayDrawCustomLayoutBorder = towCombatOverlayDrawCustomLayoutBorder;
globalThis.towCombatOverlayUpdateCustomLayoutBorderVisibility = towCombatOverlayUpdateCustomLayoutBorderVisibility;
globalThis.towCombatOverlayClearCustomLayoutBorder = towCombatOverlayClearCustomLayoutBorder;
globalThis.towCombatOverlayBringTokenToFront = towCombatOverlayBringTokenToFront;
globalThis.towCombatOverlayGetDeadFilterTargets = towCombatOverlayGetDeadFilterTargets;
globalThis.towCombatOverlayEnsureDeadVisual = towCombatOverlayEnsureDeadVisual;
globalThis.towCombatOverlayClearDeadVisual = towCombatOverlayClearDeadVisual;
globalThis.towCombatOverlayGetWoundCount = towCombatOverlayGetWoundCount;
globalThis.towCombatOverlayGetActorWoundItemCount = towCombatOverlayGetActorWoundItemCount;
globalThis.towCombatOverlayGetMaxWoundLimit = towCombatOverlayGetMaxWoundLimit;
globalThis.towCombatOverlayIsAtWoundCap = towCombatOverlayIsAtWoundCap;
globalThis.towCombatOverlaySyncNpcDeadFromWounds = towCombatOverlaySyncNpcDeadFromWounds;
globalThis.towCombatOverlayQueueDeadSyncFromWounds = towCombatOverlayQueueDeadSyncFromWounds;
globalThis.towCombatOverlaySyncWoundsFromDeadState = towCombatOverlaySyncWoundsFromDeadState;
globalThis.towCombatOverlayQueueWoundSyncFromDeadState = towCombatOverlayQueueWoundSyncFromDeadState;
globalThis.towCombatOverlayPrimeDeadPresence = towCombatOverlayPrimeDeadPresence;
globalThis.towCombatOverlayGetResilienceValue = towCombatOverlayGetResilienceValue;
globalThis.towCombatOverlayAddWound = towCombatOverlayAddWound;
globalThis.towCombatOverlayRemoveWound = towCombatOverlayRemoveWound;
