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

function clearDisplayObject(displayObject) {
  if (!displayObject) return;
  displayObject.parent?.removeChild(displayObject);
  displayObject.destroy({ children: true });
}

function getWoundCount(tokenDocument) {
  const actor = tokenDocument?.actor;
  if (!actor) return null;
  if (Array.isArray(actor.itemTypes?.wound)) return actor.itemTypes.wound.length;
  return actor.items.filter((item) => item.type === WOUND_ITEM_TYPE).length;
}

function getResilienceValue(tokenDocument) {
  return tokenDocument?.actor?.system?.resilience?.value ?? null;
}

async function addWound(actor) {
  if (!canEditActor(actor)) {
    warnNoPermission(actor);
    return;
  }
  await actor.createEmbeddedDocuments("Item", [{ type: WOUND_ITEM_TYPE, name: "Wound" }]);
}

async function removeWound(actor) {
  if (!canEditActor(actor)) {
    warnNoPermission(actor);
    return;
  }

  const wounds = actor.itemTypes?.wound ?? actor.items.filter((item) => item.type === WOUND_ITEM_TYPE);
  if (!wounds.length) return;

  const toDelete = wounds.find((wound) => wound.system?.treated !== true) ?? wounds[wounds.length - 1];
  if (!toDelete) return;

  await actor.deleteEmbeddedDocuments("Item", [toDelete.id]);
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
  const container = new PIXI.Container();
  container.eventMode = "passive";
  container.interactiveChildren = true;

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
  attackHitBox.cursor = "pointer";

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
    const actor = getActorFromToken(tokenObject);
    if (!actor) return;
    if (!(await ensureTowActions())) return;
    await game.towActions.attackActor(actor, { manual: game.towActions.isShiftHeld() });
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

  const ui = tokenObject[KEYS.woundUI] ?? createWoundControlUI(tokenObject);
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

  countText.text = `W:${count}`;
  staggerText.text = "STAG";
  attackText.text = "ATK";
  defenceText.text = "DEF";

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
  game[MODULE_KEY] = registerHooks();
  refreshAllOverlays();
  ui.notifications.info("Overlay enabled: wounds + resilience + status highlights.");
} else {
  unregisterHooks(game[MODULE_KEY]);
  delete game[MODULE_KEY];

  clearAllWoundControls();
  clearAllResilienceLabels();
  clearAllStaggerBackgrounds();
  ui.notifications.info("Overlay disabled.");
}
