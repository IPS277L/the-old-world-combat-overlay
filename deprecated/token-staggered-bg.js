// Toggle yellow background behind "staggered" status icon (runtime, safer mode).
// No sprite tinting or icon mutation.

const KEY = "towRuntimeStaggeredBgOnly";
const BG_MARKER = "_towStaggerBg";
const BG_LAYER_KEY = "_towStaggerBgLayer";
const APPLYING_MARKER = "_towStaggerApplying";
const SIG_KEY = "_towStaggerSig";
const STAGGERED_ICON_PART = "/conditions/staggered.svg";
const BG_COLOR = 0xFFD54A;
const BG_ALPHA = 0.9;
const REFRESH_DELAY_MS = 15;

function getIconSrc(displayObject) {
  return (
    displayObject?.texture?.baseTexture?.resource?.source?.src ||
    displayObject?.texture?.baseTexture?.resource?.url ||
    displayObject?.texture?.baseTexture?.resource?.src ||
    ""
  );
}

function isStaggeredSprite(sprite) {
  if (!sprite?.texture) return false;
  return String(getIconSrc(sprite)).toLowerCase().includes(STAGGERED_ICON_PART);
}

function clearStaggeredBg(token) {
  const layer = token?.[BG_LAYER_KEY];
  if (!layer) return;
  layer.removeChildren().forEach((child) => child.destroy());
}

function ensureBgLayer(token) {
  if (!token) return null;
  const effects = token.effects;
  if (!effects) return null;

  let layer = token[BG_LAYER_KEY];
  if (!layer) {
    layer = new PIXI.Container();
    layer.eventMode = "none";
    layer.interactiveChildren = false;
    token[BG_LAYER_KEY] = layer;
  }

  // Keep layer strictly behind status icons so icon always remains visible.
  const effectsIndex = token.getChildIndex(effects);
  const layerIndex = Math.max(0, effectsIndex - 1);
  if (layer.parent !== token) {
    token.addChildAt(layer, layerIndex);
  } else {
    token.setChildIndex(layer, layerIndex);
  }

  return layer;
}

function removeBgLayer(token) {
  const layer = token?.[BG_LAYER_KEY];
  if (!layer) return;
  layer.removeChildren().forEach((child) => child.destroy());
  layer.parent?.removeChild(layer);
  layer.destroy();
  delete token[BG_LAYER_KEY];
}

function applyStaggeredBg(token) {
  if (!token || token[APPLYING_MARKER]) return;
  const effects = token?.effects;
  if (!effects?.children) return;

  token[APPLYING_MARKER] = true;
  try {
    const staggeredSprites = effects.children.filter(isStaggeredSprite);
    const layer = ensureBgLayer(token);
    if (!layer) return;
    layer.position.set(effects.x, effects.y);

    if (staggeredSprites.length === 0) {
      if (token[SIG_KEY] !== "") {
        clearStaggeredBg(token);
        token[SIG_KEY] = "";
      }
      layer.visible = false;
      return;
    }

    const sig = staggeredSprites
      .map((s) => `${s.x},${s.y},${s.width},${s.height}`)
      .join("|");
    if (token[SIG_KEY] === sig) {
      layer.visible = true;
      return;
    }

    clearStaggeredBg(token);
    layer.visible = true;

    for (const child of staggeredSprites) {
      const bg = new PIXI.Graphics();
      bg[BG_MARKER] = true;
      bg.beginFill(BG_COLOR, BG_ALPHA);
      bg.drawRoundedRect(
        child.x - 1,
        child.y - 1,
        Math.max(2, child.width + 2),
        Math.max(2, child.height + 2),
        4
      );
      bg.endFill();
      layer.addChild(bg);
    }
    token[SIG_KEY] = sig;
  } finally {
    token[APPLYING_MARKER] = false;
  }
}

function refreshAll() {
  for (const token of canvas.tokens.placeables) {
    applyStaggeredBg(token);
  }
}

function scheduleTokenRefresh(token) {
  if (!token) return;
  const layer = token[BG_LAYER_KEY];
  if (layer) {
    clearStaggeredBg(token);
    layer.visible = false;
    token[SIG_KEY] = "";
  }
  if (!token._towStaggerTimers) {
    token._towStaggerTimers = [];
  }
  for (const timer of token._towStaggerTimers) {
    clearTimeout(timer);
  }
  token._towStaggerTimers = [];

  // Single trailing refresh after status icon layout settles.
  const timer = setTimeout(() => {
    applyStaggeredBg(token);
  }, REFRESH_DELAY_MS);
  token._towStaggerTimers.push(timer);
}

function refreshActorTokens(actor) {
  if (!actor) return;
  for (const token of actor.getActiveTokens(true)) {
    scheduleTokenRefresh(token.object ?? token);
  }
}

function clearAll() {
  for (const token of canvas.tokens.placeables) {
    if (Array.isArray(token._towStaggerTimers)) {
      for (const timer of token._towStaggerTimers) {
        clearTimeout(timer);
      }
      token._towStaggerTimers = [];
    }
    token[SIG_KEY] = "";
    removeBgLayer(token);
  }
}

if (!game[KEY]) {
  game[KEY] = {
    canvasReady: Hooks.on("canvasReady", () => refreshAll()),
    createActiveEffect: Hooks.on("createActiveEffect", (effect) => refreshActorTokens(effect?.parent)),
    updateActiveEffect: Hooks.on("updateActiveEffect", (effect) => refreshActorTokens(effect?.parent)),
    deleteActiveEffect: Hooks.on("deleteActiveEffect", (effect) => refreshActorTokens(effect?.parent))
  };

  refreshAll();
  ui.notifications.info("Staggered yellow background enabled.");
} else {
  Hooks.off("canvasReady", game[KEY].canvasReady);
  Hooks.off("createActiveEffect", game[KEY].createActiveEffect);
  Hooks.off("updateActiveEffect", game[KEY].updateActiveEffect);
  Hooks.off("deleteActiveEffect", game[KEY].deleteActiveEffect);
  delete game[KEY];

  clearAll();
  ui.notifications.info("Staggered yellow background disabled.");
}
